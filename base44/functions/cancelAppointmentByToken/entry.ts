import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildEmailHtml } from "../../shared/email-template.ts";
import { deleteGoogleEvent } from "../../shared/google-calendar.ts";
import { sendWhatsAppMessage } from "../../shared/whatsapp-providers.ts";
import { sendPushToUsers, getPracticeRecipientUserIds } from "../../shared/push.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token, confirm } = body;

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

    const terminalStatuses = ["cancelled", "completed", "no_show"];

    // Vista previa: el paciente puede haber tocado el botón por error, así que primero
    // mostramos los datos de la cita y le pedimos confirmación explícita antes de cancelar
    // nada. Solo cancelamos de verdad cuando confirm === true.
    if (!confirm) {
      return Response.json({
        ok: true,
        preview: true,
        status: appt.status,
        handle,
        service_name: appt.service_name,
        start_datetime: appt.start_datetime,
        patient_name: appt.patient_name,
        can_cancel: !terminalStatuses.includes(appt.status),
      });
    }

    // El paciente recibe el link de cancelar recién cuando el turno pasa a "confirmed"
    // (sendAppointmentConfirmation es lo que genera el cancel_token), así que restringir
    // esto solo a "pending" dejaba el botón prácticamente inutilizable en la práctica.
    // Solo bloqueamos si la cita ya llegó a un estado terminal.
    if (terminalStatuses.includes(appt.status)) {
      return Response.json({ ok: true, already_resolved: true, status: appt.status, handle });
    }

    await base44.asServiceRole.entities.Appointment.update(appt.id, { status: 'cancelled' });

    // Borra el evento del Google Calendar de quien atendía esta cita, si estaba
    // sincronizado. No debe romper el flujo de cancelación si Google falla.
    try {
      await deleteGoogleEvent(base44, appt, professionalId);
      if (appt.google_event_id) {
        await base44.asServiceRole.entities.Appointment.update(appt.id, { google_event_id: null });
      }
    } catch (e) {
      console.error('[cancelAppointmentByToken] error al borrar evento de Google:', e?.message || e);
    }

    // Notificar al profesional por email y WhatsApp
    if (practice) {
      const startDate = new Date(appt.start_datetime);
      const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
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
              footer: "Kame Agenda",
            }),
          });
        } catch { /* notificación no interrumpe la cancelación */ }
      }

      // Push al profesional (y al equipo en plan Clinic): una cancelación libera un
      // horario y conviene enterarse en el momento, no al abrir la Agenda. El resto de los
      // avisos (nueva reserva, el bot agendó) ya mandaban push; este flujo se había
      // quedado solo con email + WhatsApp.
      try {
        const recipients = await getPracticeRecipientUserIds(base44, practice);
        await sendPushToUsers(base44, recipients, {
          title: 'Cita cancelada por el paciente',
          body: `${patientName} — ${serviceName}`,
          url: '/agenda',
          tag: `appt-${appt.id}`,
        });
      } catch (e) {
        console.error('push cancelAppointmentByToken error:', e?.message || e);
      }

      // Antes solo chequeaba zernio_phone + zernio_account_id — nunca le llegaba este
      // aviso al profesional si estaba conectado por QR (Evolution API). Usamos el mismo
      // patrón genérico que en sendPendingAppointmentAlert.
      if (practice.whatsapp_connected && practice.whatsapp_phone_number) {
        try {
          await sendWhatsAppMessage(base44, practice, practice.whatsapp_phone_number, `❌ Cita cancelada por el paciente\n\nPaciente: ${patientName}\nServicio: ${serviceName}\nFecha: ${dateStr}`);
        } catch { /* notificación no interrumpe la cancelación */ }
      }
    }

    return Response.json({ ok: true, resolved: true, status: 'cancelled', handle });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}