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

    const appts = await base44.asServiceRole.entities.Appointment.filter({ status: 'confirmed' });
    const due = (appts || []).filter((a) => a.end_datetime && new Date(a.end_datetime) < now);

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

    return Response.json({ ok: true, checked: due.length, completed, reviewRequestsCreated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
