import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    // Confirmed appointments within the next 24h (reminders_sent === 0)
    // or the next 3h (reminders_sent === 1).
    const all = await base44.asServiceRole.entities.Appointment.filter({ status: "confirmed" });
    const toRemind = (all || []).filter((a) => {
      const start = new Date(a.start_datetime);
      const reminders = a.reminders_sent || 0;
      const in24Window = reminders === 0 && start >= now && start <= in24h;
      const in3Window = reminders === 1 && start >= now && start <= in3h;
      return in24Window || in3Window;
    });

    let sent = 0;
    let skipped = 0;
    for (const appt of toRemind) {
      let email = null;
      let patientName = appt.patient_name || "";
      if (appt.patient_id) {
        try {
          const pats = await base44.asServiceRole.entities.Patient.filter({ id: appt.patient_id });
          const patient = pats?.[0];
          if (patient) {
            email = patient.email;
            patientName = `${patient.first_name} ${patient.last_name || ""}`.trim() || patientName;
          }
        } catch {}
      }
      if (!email) { skipped++; continue; }

      const startDate = new Date(appt.start_datetime);
      const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      const is3h = (appt.reminders_sent || 0) >= 1;

      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: is3h ? "Recordatorio: tu cita es en 3 horas" : "Recordatorio de tu cita",
        body: `Hola ${patientName},\n\nTe recordamos tu cita de ${appt.service_name || "consulta"} para el ${dateStr}.\n\nSi necesitás reprogramar, respondí a este email.\n\n¡Te esperamos!\n\nAgendaPro`,
      });

      await base44.asServiceRole.entities.Appointment.update(appt.id, { reminders_sent: (appt.reminders_sent || 0) + 1 });
      sent++;
    }

    return Response.json({ sent, skipped, total: toRemind.length });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}