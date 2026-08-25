import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { exchangeCode, getUserEmail } from '../../shared/google-calendar.ts';
import { setPracticeSecrets, setProfessionalSecrets } from '../../shared/secrets.ts';

// Recibe el "code" que Google manda de vuelta después de que la persona autoriza el
// acceso a su Calendar. Canjea ese código por tokens reales y los guarda en el registro
// correcto (PracticeSettings del dueño, o el Professional del invitado que conectó SU
// PROPIO calendario — nunca se mezclan entre personas distintas).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { code, state, origin } = body || {};
    if (!code || !state) return Response.json({ error: 'Faltan datos de la respuesta de Google' }, { status: 400 });

    let statePayload;
    try {
      statePayload = JSON.parse(atob(state));
    } catch {
      return Response.json({ error: 'Respuesta de Google inválida' }, { status: 400 });
    }
    if (statePayload.userId !== user.id) {
      return Response.json({ error: 'La sesión no coincide con quien inició la conexión' }, { status: 400 });
    }
    // El state vence a los 10 minutos — evita reintentos con un code viejo.
    if (Date.now() - (statePayload.ts || 0) > 10 * 60 * 1000) {
      return Response.json({ error: 'El enlace de conexión venció, intentá de nuevo' }, { status: 400 });
    }

    const redirectUri = `${origin || 'https://kameagenda.com'}/google-calendar-callback`;
    const tokens = await exchangeCode(base44, code, redirectUri);
    if (!tokens.refresh_token) {
      // Pasa si la persona ya había autorizado antes y Google no reemite el refresh
      // token — le pedimos que revoque el acceso desde su cuenta de Google y reintente,
      // ya que sin refresh token no podemos sincronizar sin que vuelva a loguearse cada rato.
      return Response.json({
        error: 'Google no devolvió un token de renovación. Si ya habías conectado esta cuenta antes, entrá a myaccount.google.com/permissions, quitale el acceso a Kame Agenda, y volvé a intentar.',
      }, { status: 400 });
    }
    const email = await getUserEmail(tokens.access_token);

    if (statePayload.professionalRefId) {
      await base44.asServiceRole.entities.Professional.update(statePayload.professionalRefId, {
        google_calendar_connected: true,
        google_calendar_email: email,
        google_sync_enabled: true,
      });
      await setProfessionalSecrets(base44, statePayload.professionalRefId, { google_refresh_token: tokens.refresh_token });
    } else {
      const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user.id });
      const practice = practices?.[0];
      if (!practice) return Response.json({ error: 'No se encontró tu consultorio' }, { status: 400 });
      await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
        google_calendar_connected: true,
        google_calendar_email: email,
        google_sync_enabled: true,
      });
      await setPracticeSecrets(base44, practice.id, { google_refresh_token: tokens.refresh_token });
    }

    return Response.json({ ok: true, email });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
