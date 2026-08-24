// Integración con Google Calendar. Cada persona (el dueño de la cuenta, o cada
// profesional invitado por separado) conecta SU PROPIO Google Calendar — los tokens se
// guardan en su propio registro (PracticeSettings para el dueño, Professional para un
// invitado), nunca mezclados.
//
// Sincronización:
// - Kame Agenda -> Google: cada cita creada/editada/cancelada empuja (crea/actualiza/
//   borra) un evento real en el Google Calendar de quien la atiende.
// - Google -> Kame Agenda: en vez de duplicar cada evento de Google como una cita en
//   Kame (lo que traería líos de sincronización constante), se consulta en tiempo real
//   el freebusy de esa persona al generar los horarios disponibles para reservar — así
//   un evento personal en Google bloquea la reserva automáticamente, sin duplicar datos
//   ni necesitar webhooks complejos.

async function getPlatformCreds(base44) {
  const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
  const c = cfg?.[0];
  if (!c?.google_client_id || !c?.google_client_secret) {
    throw new Error('Google Calendar no está configurado en la plataforma');
  }
  return { clientId: c.google_client_id, clientSecret: c.google_client_secret };
}

export function buildAuthUrl({ clientId, redirectUri, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    // Antes pedíamos también calendar.readonly, pero no lo necesitábamos: freebusy.query
    // y events.list ya funcionan con el scope calendar.events (que da lectura Y escritura
    // sobre eventos). Pedir menos scope = revisión de Google más rápida y una pantalla de
    // permisos más chica para el profesional que conecta su cuenta.
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeCode(base44, code, redirectUri) {
  const { clientId, clientSecret } = await getPlatformCreds(base44);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'Error al canjear el código de Google');
  return data; // { access_token, refresh_token, expires_in, ... }
}

async function refreshAccessToken(base44, refreshToken) {
  const { clientId, clientSecret } = await getPlatformCreds(base44);
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || 'No se pudo renovar el token de Google');
  return data.access_token;
}

export async function getUserEmail(accessToken) {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.email || null;
}

// Resuelve el registro (PracticeSettings o Professional) que guarda la conexión de
// Google para un profesional_ref_id dado (null/undefined = el dueño de la cuenta).
export async function resolveGoogleTarget(base44, practiceOwnerId, professionalRefId) {
  if (professionalRefId) {
    const rows = await base44.asServiceRole.entities.Professional.filter({ id: professionalRefId });
    const p = rows?.[0];
    if (!p || !p.google_refresh_token || p.google_sync_enabled === false) return null;
    return { kind: 'professional', record: p };
  }
  const rows = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: practiceOwnerId });
  const s = rows?.[0];
  if (!s || !s.google_refresh_token || s.google_sync_enabled === false) return null;
  return { kind: 'practice', record: s };
}

async function getValidAccessToken(base44, target) {
  return refreshAccessToken(base44, target.record.google_refresh_token);
}

// Crea o actualiza el evento de Google correspondiente a una cita. Devuelve el
// google_event_id para guardarlo en la Appointment.
export async function pushAppointmentToGoogle(base44, appointment, practiceOwnerId) {
  try {
    const target = await resolveGoogleTarget(base44, practiceOwnerId, appointment.professional_ref_id);
    if (!target) return null;
    const accessToken = await getValidAccessToken(base44, target);

    const event = {
      summary: `${appointment.service_name || 'Cita'} — ${appointment.patient_name || ''}`.trim(),
      description: `Reservado por Kame Agenda.${appointment.notes ? `\n\n${appointment.notes}` : ''}`,
      start: { dateTime: appointment.start_datetime },
      end: { dateTime: appointment.end_datetime },
    };

    const existingId = appointment.google_event_id;
    const url = existingId
      ? `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingId}`
      : `https://www.googleapis.com/calendar/v3/calendars/primary/events`;
    const res = await fetch(url, {
      method: existingId ? 'PATCH' : 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    });
    const data = await res.json();
    if (!res.ok) {
      // Si el evento ya no existe del lado de Google (lo borraron a mano), lo recreamos
      // en vez de fallar en silencio.
      if (existingId && res.status === 404) {
        const retryRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event),
        });
        const retryData = await retryRes.json();
        if (retryRes.ok) return retryData.id;
      }
      console.error('[pushAppointmentToGoogle] error', data);
      return existingId || null;
    }
    return data.id;
  } catch (e) {
    console.error('[pushAppointmentToGoogle] excepción', e?.message || e);
    return appointment.google_event_id || null;
  }
}

export async function deleteGoogleEvent(base44, appointment, practiceOwnerId) {
  try {
    if (!appointment.google_event_id) return;
    const target = await resolveGoogleTarget(base44, practiceOwnerId, appointment.professional_ref_id);
    if (!target) return;
    const accessToken = await getValidAccessToken(base44, target);
    await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${appointment.google_event_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (e) {
    console.error('[deleteGoogleEvent] excepción', e?.message || e);
  }
}

// Franjas ocupadas en el Google Calendar de la persona, para excluirlas de los horarios
// que se ofrecen al reservar — así un evento personal en Google bloquea la reserva sin
// necesidad de duplicarlo como una cita en Kame Agenda.
export async function getGoogleBusyRanges(base44, practiceOwnerId, professionalRefId, timeMin, timeMax) {
  try {
    const target = await resolveGoogleTarget(base44, practiceOwnerId, professionalRefId);
    if (!target) return [];
    const accessToken = await getValidAccessToken(base44, target);
    const res = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ timeMin, timeMax, items: [{ id: 'primary' }] }),
    });
    const data = await res.json();
    if (!res.ok) return [];
    return (data.calendars?.primary?.busy || []).map((b) => ({ start: b.start, end: b.end }));
  } catch (e) {
    console.error('[getGoogleBusyRanges] excepción', e?.message || e);
    return [];
  }
}
