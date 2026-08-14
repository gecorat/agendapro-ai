import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPlatformConfig, sendWhatsApp } from "../../shared/zernio.ts";

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

    // Solo reservas externas pendientes disparan el respaldo
    if (appt.status !== 'pending' || !['whatsapp', 'public_link'].includes(appt.origin)) {
      return Response.json({ skipped: true, reason: 'not external pending' });
    }

    const professionalId = appt.professional_id || appt.created_by_id;
    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices?.find((p) => p.created_by_id === professionalId);

    if (!practice) {
      return Response.json({ skipped: true, reason: 'no practice settings' });
    }

    const startDate = new Date(appt.start_datetime);
    const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
    const patientName = appt.patient_name || "Paciente";
    const serviceName = appt.service_name || "Consulta";
    const originLabel = appt.origin === "whatsapp" ? "WhatsApp" : "Link público";

    let emailSent = false;
    if (practice.professional_email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: practice.professional_email,
        subject: `Nueva cita pendiente — ${patientName}`,
        body: `Hola${practice.practice_name ? " " + practice.practice_name : ""},\n\nTenés una nueva cita pendiente de confirmar:\n\nPaciente: ${patientName}\nServicio: ${serviceName}\nFecha: ${dateStr}\nOrigen: ${originLabel}\n\nIngresá a AgendaPro para confirmar o cancelar la cita.\n\nAgendaPro`,
      });
      emailSent = true;
    }

    let waSent = false;
    if (practice.whatsapp_connected && practice.zernio_phone && practice.zernio_account_id) {
      const plat = await getPlatformConfig(base44);
      try {
        await sendWhatsApp(base44, {
          apiKey: plat?.zernio_api_key,
          accountId: practice.zernio_account_id,
          phone: practice.zernio_phone,
          message: `🔔 Nueva cita pendiente\n\nPaciente: ${patientName}\nServicio: ${serviceName}\nFecha: ${dateStr}\nOrigen: ${originLabel}\n\nIngresá a AgendaPro para confirmar.`,
        });
        waSent = true;
      } catch (e) {
        // WhatsApp fail shouldn't fail the whole function
      }
    }

    return Response.json({ ok: true, emailSent, waSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}