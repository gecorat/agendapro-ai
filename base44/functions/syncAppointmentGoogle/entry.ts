import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { pushAppointmentToGoogle, deleteGoogleEvent } from '../../shared/google-calendar.ts';

// Punto único de sincronización con Google Calendar para una cita: crea/actualiza el
// evento si está activa, lo borra si se canceló. Se llama como efecto secundario después
// de cualquier alta/edición/cancelación de cita, desde cualquier pantalla o flujo (bot,
// reserva pública, agenda manual). Si Google Calendar no está conectado para esa persona,
// simplemente no hace nada — no rompe el flujo normal de la cita.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { appointmentId } = body || {};
    if (!appointmentId) return Response.json({ error: 'appointmentId requerido' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.Appointment.filter({ id: appointmentId });
    const appointment = rows?.[0];
    if (!appointment) return Response.json({ synced: false, reason: 'not_found' });

    if (appointment.status === 'cancelled') {
      await deleteGoogleEvent(base44, appointment, appointment.professional_id);
      if (appointment.google_event_id) {
        await base44.asServiceRole.entities.Appointment.update(appointment.id, { google_event_id: null });
      }
      return Response.json({ synced: true, action: 'deleted' });
    }

    const eventId = await pushAppointmentToGoogle(base44, appointment, appointment.professional_id);
    if (eventId && eventId !== appointment.google_event_id) {
      await base44.asServiceRole.entities.Appointment.update(appointment.id, { google_event_id: eventId });
    }
    return Response.json({ synced: !!eventId, action: eventId ? 'upserted' : 'skipped' });
  } catch (error) {
    // Nunca dejamos que un fallo de Google rompa el flujo de la cita en sí -- solo se
    // loguea, la cita en Kame Agenda queda bien de cualquier forma.
    console.error('[syncAppointmentGoogle] error', error?.message || error);
    return Response.json({ synced: false, error: error.message });
  }
}
