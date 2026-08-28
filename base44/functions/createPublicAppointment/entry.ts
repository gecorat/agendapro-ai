import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findPatientByCanonicalPhone } from '../../shared/phone-utils.ts';
import { pushAppointmentToGoogle } from '../../shared/google-calendar.ts';
import { sendPushToUsers, getPracticeRecipientUserIds } from '../../shared/push.ts';
import { sendWhatsAppMessage } from '../../shared/whatsapp-providers.ts';
import { buildConfirmationMessage } from '../../shared/zernio.ts';
import { getAppointmentContext } from '../../shared/appointment-context.ts';
import { argentinaDayBounds } from '../../shared/scheduling.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const {
      professional_id,
      professional_ref_id, // opcional: a que profesional puntual del equipo (plan Clinic) va esta cita
      service_id,
      start_datetime,
      first_name,
      last_name,
      phone,
      email,
    } = body;

    if (!professional_id || !service_id || !start_datetime || !first_name || !phone || !email) {
      return Response.json({ error: 'Faltan datos requeridos.' }, { status: 400 });
    }

    const services = await base44.asServiceRole.entities.Service.filter({ id: service_id });
    const service = services?.[0];
    if (!service || service.created_by_id !== professional_id || service.active === false) {
      return Response.json({ error: 'El servicio no está disponible.' }, { status: 400 });
    }

    const start = new Date(start_datetime);
    if (isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return Response.json({ error: 'El horario seleccionado ya no es válido.' }, { status: 400 });
    }
    const end = new Date(start.getTime() + (service.duration_minutes || 30) * 60000);

    // Re-chequeo server-side de solapamiento justo antes de crear. Si la reserva es para
    // un profesional PUNTUAL del equipo (plan Clinic), el choque se chequea SOLO contra
    // las citas de ESE profesional — dos personas del mismo equipo pueden tener citas a
    // la misma hora sin problema, cada uno con su propia agenda.
    // OJO ZONA HORARIA: usamos argentinaDayBounds (mismo helper que ya usa scheduling.ts
    // para el bot) en vez de `.setHours()` directo sobre el Date — `.setHours()` corre en
    // el huso horario del PROCESO (Deno, probablemente UTC), no en el de Argentina. Con
    // `.setHours()` crudo, una reserva entre las 21:00 y 23:59 hora Argentina calculaba mal
    // la ventana del día (desplazada ~3hs) y podía no traer una cita cercana ya existente
    // para el chequeo de solapamiento — riesgo real de doble reserva en ese horario.
    const { start: dayStart, end: dayEnd } = argentinaDayBounds(start);
    const existingAppts = await base44.asServiceRole.entities.Appointment.filter({
      professional_id,
      status: { $ne: 'cancelled' },
      start_datetime: { $gte: dayStart.toISOString(), $lte: dayEnd.toISOString() },
    });
    const relevantAppts = professional_ref_id
      ? (existingAppts || []).filter((a) => a.professional_ref_id === professional_ref_id)
      : (existingAppts || []).filter((a) => !a.professional_ref_id);
    const overlaps = relevantAppts.some((a) => {
      const aStart = new Date(a.start_datetime).getTime();
      const aEnd = new Date(a.end_datetime).getTime();
      return start.getTime() < aEnd && aStart < end.getTime();
    });
    if (overlaps) {
      return Response.json(
        { error: 'slot_taken', message: 'Ese horario ya fue reservado. Por favor elegí otro.' },
        { status: 409 }
      );
    }

    // Buscar paciente existente por teléfono, comparando por teléfono CANÓNICO (últimos
    // 10 dígitos), no texto exacto.
    const allPatients = await base44.asServiceRole.entities.Patient.filter({ professional_id });
    let patient = findPatientByCanonicalPhone(allPatients, phone);
    if (!patient) {
      patient = await base44.asServiceRole.entities.Patient.create({
        first_name,
        last_name: last_name || '',
        phone,
        email,
        contact_preference: 'whatsapp',
        consent_reminders: true,
        professional_id,
        professional_ref_id: professional_ref_id || undefined,
      });
    } else {
      const updates = {};
      if (first_name && first_name !== patient.first_name) updates.first_name = first_name;
      if ((last_name || '') !== (patient.last_name || '')) updates.last_name = last_name || '';
      if (email && email !== patient.email) updates.email = email;
      // Si esta reserva puntual es con un profesional del equipo, el paciente "pasa a
      // ser" de ese profesional en la lista (el más reciente con quien reservó).
      if (professional_ref_id && professional_ref_id !== patient.professional_ref_id) {
        updates.professional_ref_id = professional_ref_id;
      }
      if (Object.keys(updates).length) {
        patient = await base44.asServiceRole.entities.Patient.update(patient.id, updates);
      }
    }

    // En planes Pro/Clinic con WhatsApp conectado, la reserva por la página pública queda
    // CONFIRMADA directo (no "pending") — ya le avisamos al paciente por WhatsApp al toque
    // (más abajo), así que no hace falta el paso manual de "vos la confirmás desde la
    // Agenda" que sí sigue existiendo en planes sin WhatsApp. Antes esto SIEMPRE quedaba
    // pending y al paciente no le llegaba ningún aviso automático de la reserva.
    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: professional_id });
    const practice = practices?.[0];
    const isProOrClinic = practice?.plan === 'pro' || practice?.plan === 'clinic';
    const autoConfirm = isProOrClinic && !!practice?.whatsapp_connected;

    const appointment = await base44.asServiceRole.entities.Appointment.create({
      patient_id: patient.id,
      patient_name: `${patient.first_name} ${patient.last_name || ''}`.trim(),
      service_id: service.id,
      service_name: service.name,
      start_datetime: start.toISOString(),
      end_datetime: end.toISOString(),
      status: autoConfirm ? 'confirmed' : 'pending',
      origin: 'public_link',
      professional_id,
      professional_ref_id: professional_ref_id || undefined,
    });

    // Empuja el evento a Google Calendar de quien atiende esta cita, si tiene la
    // sincronización conectada. Si falla o no está conectado, no rompe la reserva.
    const googleEventId = await pushAppointmentToGoogle(base44, appointment, professional_id);
    if (googleEventId) {
      await base44.asServiceRole.entities.Appointment.update(appointment.id, { google_event_id: googleEventId });
      appointment.google_event_id = googleEventId;
    }

    if (autoConfirm) {
      // Email: el workflow "Email de confirmación al paciente" solo dispara en un UPDATE
      // de status a "confirmed", no en un CREATE que ya nace confirmado — así que acá lo
      // invocamos a mano, igual que hace el bot de WhatsApp al agendar.
      try {
        await base44.asServiceRole.functions.invoke('sendAppointmentConfirmation', { appointment_id: appointment.id });
      } catch (e) {
        console.error('sendAppointmentConfirmation invoke error (createPublicAppointment):', e?.message || e);
      }
      // WhatsApp: mismo formato (negrita + emojis) que usa el bot al confirmar un turno,
      // para que el paciente reciba exactamente el mismo tipo de mensaje sin importar si
      // reservó charlando con el bot o solo desde la página.
      try {
        const { professionalName } = await getAppointmentContext(base44, appointment, practice);
        const waText = buildConfirmationMessage({ practice, service, start, professionalName });
        await sendWhatsAppMessage(base44, practice, patient.phone, waText);
      } catch (e) {
        console.error('sendWhatsAppMessage error (createPublicAppointment):', e?.message || e);
      }
    }

    // Push al dueño (y a cualquier profesional del equipo) — no bloquea la respuesta de la
    // reserva si falla o si todavía no hay VAPID configurado.
    try {
      if (practice) {
        const recipients = await getPracticeRecipientUserIds(base44, practice);
        await sendPushToUsers(base44, recipients, {
          title: autoConfirm ? 'Nueva reserva confirmada' : 'Nueva reserva pendiente',
          body: `${patient.first_name} ${patient.last_name || ''}`.trim() + ` — ${service.name}`,
          url: '/agenda',
          tag: `appt-${appointment.id}`,
        });
      }
    } catch (e) {
      console.error('push createPublicAppointment error:', e?.message || e);
    }

    return Response.json({ appointment, patient });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
