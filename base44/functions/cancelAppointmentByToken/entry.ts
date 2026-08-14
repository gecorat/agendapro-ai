import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPlatformConfig, sendWhatsApp } from "../../shared/zernio.ts";
import { buildEmailHtml } from "../../shared/email-template.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token) {
      return Response.json({ error: 'token required' }, { status: 400 });
    }

    const appts = await base44.asServiceRole.entities.Appointment.filter({ cancel_token: token });
    const appt = appts?.[0];
    if (!appt) {
      return Response.json({ error: 'invalid token' }, { status: 404 });
    }

    const professionalId = appt.professional_id || appt.created_by_id;
    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices?.find((p) => p.created_by_id === professionalId);
    const handle = practice?.handle || "";

    if (appt.status !== 'pending') {
      return Response.json({ ok: true, already_resolved: true, status: appt.status, handle });
    }

    await base44.asServiceRole.entities.Appointment.update(appt.id, { status: 'cancelled' });

    // Notificar al profesional por email y WhatsApp
    if (practice) {
      const startDate = new Date(appt.start_datetime);
      const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
      const patientName = appt.patient_name || "Paciente";
      const serviceName = appt.service_name || "Consulta";

      if (practice.professional_email) {
        try {
          await base44.asServiceRole.integrations.Core.SendEmail({
            to: practice.professional_email,
            subject: `Cita cancelada por el paciente — ${patientName}`,
            body: buildEmailHtml({
              title: "Cita cancelada",
              greeting: `Hola${practice.practice_name ? " " + practice.practice_name : ""}`,
              lines: [
                `${patientName} canceló la siguiente cita:`,
                `Servicio: ${serviceName}`,
                `Fecha: ${dateStr}`,
              ],
              footer: "AgendaPro",
            }),
          });
        } catch { /* notificación no interrumpe la cancelación */ }
      }

      if (practice.whatsapp_connected && practice.zernio_phone && practice.zernio_account_id) {
        try {
          const plat = await getPlatformConfig(base44);
          await sendWhatsApp(base44, {
            apiKey: plat?.zernio_api_key,
            accountId: practice.zernio_account_id,
            phone: practice.zernio_phone,
            message: `❌ Cita cancelada por el paciente\n\nPaciente: ${patientName}\nServicio: ${serviceName}\nFecha: ${dateStr}`,
          });
        } catch { /* notificación no interrumpe la cancelación */ }
      }
    }

    return Response.json({ ok: true, resolved: true, status: 'cancelled', handle });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}