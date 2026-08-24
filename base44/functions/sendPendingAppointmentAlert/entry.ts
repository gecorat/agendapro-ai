import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildEmailHtml, getAppUrl } from "../../shared/email-template.ts";
import { sendEmail } from "../../shared/email-sender.ts";
import { sendWhatsAppMessage } from "../../shared/whatsapp-providers.ts";

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

    // Generar tokens si no existen
    let confirmToken = appt.confirm_token;
    let cancelToken = appt.cancel_token;
    const tokenUpdate = {};
    if (!confirmToken) {
      confirmToken = crypto.randomUUID();
      tokenUpdate.confirm_token = confirmToken;
    }
    if (!cancelToken) {
      cancelToken = crypto.randomUUID();
      tokenUpdate.cancel_token = cancelToken;
    }
    if (Object.keys(tokenUpdate).length > 0) {
      await base44.asServiceRole.entities.Appointment.update(appt.id, tokenUpdate);
    }

    const appUrl = await getAppUrl(base44, req);
    const startDate = new Date(appt.start_datetime);
    const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
    const patientName = appt.patient_name || "Paciente";
    const serviceName = appt.service_name || "Consulta";
    const originLabel = appt.origin === "whatsapp" ? "WhatsApp" : "Link público";

    const confirmUrl = `${appUrl}/c/${confirmToken}`;

    let emailSent = false;
    if (practice.professional_email) {
      await sendEmail(base44, {
        to: practice.professional_email,
        subject: `Nueva cita pendiente — ${patientName}`,
        body: buildEmailHtml({
          title: "Nueva cita pendiente",
          greeting: `Hola${practice.practice_name ? " " + practice.practice_name : ""}`,
          lines: [
            "Tenés una nueva cita pendiente de confirmar:",
            `Paciente: ${patientName}`,
            `Servicio: ${serviceName}`,
            `Fecha: ${dateStr}`,
            `Origen: ${originLabel}`,
          ],
          primaryButton: { label: "Confirmar cita", url: confirmUrl },
          footer: "Kame Agenda",
        }),
      });
      emailSent = true;
    }

    let waSent = false;
    // Antes solo chequeaba zernio_phone + zernio_account_id — una cuenta conectada por QR
    // (Evolution API) nunca tiene esos dos campos cargados, así que este aviso al
    // profesional NUNCA le llegaba por WhatsApp si estaba conectado por QR (que hoy es el
    // camino recomendado). Usamos whatsapp_phone_number (genérico, lo llenan los dos
    // proveedores) y la función de envío genérica, para que mande el mensaje a la propia
    // cuenta conectada sea cual sea el proveedor.
    if (practice.whatsapp_connected && practice.whatsapp_phone_number) {
      try {
        await sendWhatsAppMessage(base44, practice, practice.whatsapp_phone_number, `🔔 Nueva cita pendiente

Paciente: ${patientName}
Servicio: ${serviceName}
Fecha: ${dateStr}
Origen: ${originLabel}

Confirmá desde el email o ingresá a Kame Agenda.`);
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