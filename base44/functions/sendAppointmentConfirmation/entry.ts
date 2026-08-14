import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { appointment_id } = body;

    if (!appointment_id) {
      return Response.json({ error: 'appointment_id required' }, { status: 400 });
    }

    const appts = await base44.asServiceRole.entities.Appointment.filter({ id: appointment_id });
    const appt = appts?.[0];
    if (!appt) {
      return Response.json({ error: 'appointment not found' }, { status: 404 });
    }

    // Guarda anti-duplicados: si ya se envió o no está confirmada, salimos
    if (appt.confirmation_email_sent) {
      return Response.json({ skipped: true, reason: 'already sent' });
    }
    if (appt.status !== 'confirmed') {
      return Response.json({ skipped: true, reason: 'not confirmed' });
    }
    if (!appt.patient_id) {
      return Response.json({ skipped: true, reason: 'no patient' });
    }

    // Datos del paciente (email + nombre)
    let email = null;
    let patientName = appt.patient_name || "Paciente";
    try {
      const pats = await base44.asServiceRole.entities.Patient.filter({ id: appt.patient_id });
      const patient = pats?.[0];
      if (patient) {
        email = patient.email;
        patientName = `${patient.first_name} ${patient.last_name || ""}`.trim() || patientName;
      }
    } catch {}

    if (!email) {
      return Response.json({ skipped: true, reason: 'no patient email' });
    }

    // Configuración del profesional (nombre del consultorio)
    const professionalId = appt.professional_id || appt.created_by_id;
    let practiceName = "";
    try {
      const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
      const practice = practices?.find((p) => p.created_by_id === professionalId);
      if (practice?.practice_name) practiceName = practice.practice_name;
    } catch {}

    const startDate = new Date(appt.start_datetime);
    const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    const serviceName = appt.service_name || "Consulta";
    const signature = practiceName ? practiceName : "AgendaPro";

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: `Tu cita fue confirmada — ${serviceName}`,
      body: `Hola ${patientName},\n\nTu cita de ${serviceName} fue confirmada para el ${dateStr}.\n\nSi necesitás reprogramar o cancelar, contactanos respondiendo a este email.\n\n¡Te esperamos!\n\n${signature}`,
    });

    await base44.asServiceRole.entities.Appointment.update(appt.id, { confirmation_email_sent: true });

    return Response.json({ ok: true, sent: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}