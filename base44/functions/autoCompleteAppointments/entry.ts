import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Corre cada hora (ver workflow AutoCompleteAppointments): cualquier cita que sigue
// "confirmed" y ya pasó su horario de fin pasa sola a "completed" — antes solo pasaba a
// completada si alguien la marcaba a mano en la Agenda. También dispara la misma
// solicitud de reseña que se crea al completar manualmente, para no duplicar esa lógica
// en dos lugares.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Margen para las citas cargadas A MANO en la agenda. Las de la pagina publica y las del
    // bot se completan apenas pasa el horario, como siempre: ahi no hay nadie manejando el
    // estado, que es justo para lo que existe esta funcion.
    //
    // Las manuales son distintas: el profesional esta ahi y es el unico que sabe si el
    // paciente vino o no. Desde que las citas manuales nacen 'confirmed', esta funcion las
    // barria dentro de la hora siguiente, asi que una AUSENCIA quedaba marcada sola como
    // 'completed' (existe el estado 'no_show' y ya no llegaba a usarse) y encima le mandaba
    // al paciente el pedido de resena de una visita que nunca ocurrio.
    //
    // Con 12 horas de margen el profesional tiene el resto del dia para marcar la ausencia, y
    // lo que se olvide de tocar igual se completa solo — no se acumula para siempre.
    const MANUAL_GRACE_HOURS = 12;
    const manualCutoff = new Date(now.getTime() - MANUAL_GRACE_HOURS * 60 * 60 * 1000);

    const appts = await base44.asServiceRole.entities.Appointment.filter({ status: 'confirmed' });

    // Red de seguridad para las citas del simulador del bot. Se borran solas por dos
    // caminos (un temporizador en el frontend a los 5 minutos, y una limpieza en cada
    // mensaje nuevo de botPreviewMessage), pero los dos dependen de que el profesional
    // siga en la app: si cerraba la pestana justo despues de probar y no volvia mas, la
    // cita de prueba se quedaba en su Agenda para siempre. Ahora tambien la barre este
    // proceso, que ya corre solo.
    let demosDeleted = 0;
    for (const a of (appts || [])) {
      if (!a.is_demo || !a.demo_expires_at) continue;
      const expires = new Date(a.demo_expires_at);
      if (isNaN(expires.getTime()) || expires > now) continue;
      try {
        await base44.asServiceRole.entities.Appointment.delete(a.id);
        demosDeleted++;
      } catch { /* best-effort: nunca puede frenar el completado de citas reales */ }
    }

    const due = (appts || []).filter((a) => {
      if (a.is_demo || !a.end_datetime) return false;
      const end = new Date(a.end_datetime);
      if (isNaN(end.getTime())) return false;
      return a.origin === 'manual' ? end < manualCutoff : end < now;
    });

    let completed = 0;
    let reviewRequestsCreated = 0;

    for (const appt of due) {
      try {
        await base44.asServiceRole.entities.Appointment.update(appt.id, { status: 'completed' });
        completed++;

        // Evitar duplicar la solicitud de reseña si ya existe una para este turno (por
        // ejemplo, si alguien ya la había creado manualmente antes de que corriera esto).
        const existingReview = await base44.asServiceRole.entities.ReviewRequest.filter({ appointment_id: appt.id });
        if (existingReview && existingReview.length > 0) continue;

        const patients = await base44.asServiceRole.entities.Patient.filter({ id: appt.patient_id });
        const patient = patients?.[0];
        const firstName = patient?.first_name || '';

        await base44.asServiceRole.entities.ReviewRequest.create({
          patient_id: appt.patient_id,
          patient_name: appt.patient_name || `${patient?.first_name || ''} ${patient?.last_name || ''}`.trim(),
          patient_phone: patient?.phone || '',
          patient_email: patient?.email || '',
          appointment_id: appt.id,
          service_name: appt.service_name,
          appointment_date: appt.start_datetime,
          status: 'pending',
          request_message: `¡Hola ${firstName}! Gracias por tu visita. ¿Nos dejarías una reseña? Tu opinión nos ayuda mucho.`,
          token: crypto.randomUUID(),
          disabled: false,
          professional_id: appt.professional_id,
        });
        reviewRequestsCreated++;
      } catch (e) {
        console.error('autoCompleteAppointments item error:', appt.id, e?.message || e);
      }
    }

    return Response.json({ ok: true, checked: due.length, completed, reviewRequestsCreated, demosDeleted });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
