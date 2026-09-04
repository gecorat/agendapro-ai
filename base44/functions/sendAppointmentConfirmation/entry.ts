import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildEmailHtml, getAppUrl } from "../../shared/email-template.ts";
import { sendEmail, replyToFor } from "../../shared/email-sender.ts";
import { getAppointmentContext } from "../../shared/appointment-context.ts";
import { buildMapsLink, buildConfirmationMessage, buildBookAckMessage } from "../../shared/zernio.ts";
import { sendWhatsAppMessage } from "../../shared/whatsapp-providers.ts";
import { remindersCoveredByNotice } from "../../shared/reminders.ts";
import { canSendWhatsApp } from "../../shared/plan.ts";
import { logNotification, logWhatsAppToConversation } from "../../shared/notification-log.ts";
import { findPracticeByOwner } from "../../shared/ownership.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    // skip_whatsapp: lo pasan los flujos que YA le mandaron su propia confirmación por
    // WhatsApp al paciente (el bot al agendar, y la reserva pública auto-confirmada), para
    // no mandarle el mismo mensaje dos veces.
    const { appointment_id, skip_whatsapp } = body;

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

    // RESERVA el envío antes de mandar nada. Esta función la pueden invocar dos caminos
    // casi al mismo tiempo para la misma cita: el formulario de la Agenda la llama directo
    // al crear el turno, y el workflow "Email de confirmación al paciente" se dispara ante
    // cualquier `update` de Appointment — y syncAppointmentGoogle escribe google_event_id
    // justo ahí en el medio. Marcando el flag ARRIBA, el segundo en entrar lee
    // confirmation_email_sent = true y sale por la guarda de más arriba. Antes el flag se
    // escribía recién al final, después de mandar los WhatsApp (decenas de segundos de
    // ventana), y el paciente podía recibir la confirmación dos veces.
    // Si al final no sale absolutamente nada, se libera abajo.
    try {
      await base44.asServiceRole.entities.Appointment.update(appt.id, { confirmation_email_sent: true });
    } catch (e) {
      console.error('sendAppointmentConfirmation claim error:', e?.message || e);
    }

    // Datos del paciente (email + nombre)
    let email = null;
    let patient = null;
    let patientName = appt.patient_name || "Paciente";
    try {
      const pats = await base44.asServiceRole.entities.Patient.filter({ id: appt.patient_id });
      patient = pats?.[0] || null;
      if (patient) {
        email = patient.email;
        patientName = `${patient.first_name} ${patient.last_name || ""}`.trim() || patientName;
      }
    } catch (e) {
      // Se loguea: con el catch vacio, una falla al leer el paciente dejaba la confirmacion
      // sin email ni telefono y el envio degradaba en silencio, sin rastro en ningun lado.
      console.error("sendAppointmentConfirmation: no se pudo leer el paciente:", e?.message || e);
    }

    // Configuración del profesional (nombre del consultorio + handle + teléfono/dirección)
    const professionalId = appt.professional_id || appt.created_by_id;
    let handle = "";
    let practice = null;
    try {
      // findPracticeByOwner en vez de comparar created_by_id: en las cuentas creadas por el
      // onboarding ese campo es el id del servicio, asi que la practice salia null y no se
      // enviaba nada. Ver base44/shared/ownership.ts.
      practice = await findPracticeByOwner(base44, professionalId);
      if (practice?.handle) handle = practice.handle;
    } catch (e) {
      // Idem: sin practice no hay WhatsApp ni remitente correcto, y con el catch vacio eso
      // se veia igual que "el consultorio no tiene WhatsApp conectado".
      console.error("sendAppointmentConfirmation: no se pudo leer el consultorio:", e?.message || e);
    }

    const { professionalName, address } = await getAppointmentContext(base44, appt, practice);
    const mapsLink = buildMapsLink(practice);
    const startDate = new Date(appt.start_datetime);

    // WhatsApp al paciente. Va ANTES del early-return por falta de email: si el paciente
    // no tiene mail cargado (típico de los que llegan por WhatsApp), igual tiene que
    // recibir el aviso por el canal que sí usa. Antes esta función mandaba SOLO email, así
    // que cuando el profesional confirmaba una cita a mano desde la campanita, al paciente
    // no le llegaba nada por WhatsApp — solo un mail (o nada, si no tenía mail cargado).
    const logArgs = { appointment: appt, practice, patient, kind: "confirmation" };

    let waSent = false;
    if (!skip_whatsapp && canSendWhatsApp(practice) && patient?.phone) {
      try {
        // Se arman DENTRO del try a propósito: si alguna tirara, el catch local lo absorbe y
        // el email de confirmación igual sale.
        const ackText = buildBookAckMessage();
        const confirmText = buildConfirmationMessage({
          practice,
          service: { name: appt.service_name || "Consulta" },
          start: startDate,
          professionalName,
        });
        await sendWhatsAppMessage(base44, practice, patient.phone, ackText);
        await sendWhatsAppMessage(base44, practice, patient.phone, confirmText);
        waSent = true;
        // Que la confirmación quede en el chat con el paciente, no solo en su WhatsApp.
        await logWhatsAppToConversation(base44, { practice, phone: patient.phone, text: ackText });
        await logWhatsAppToConversation(base44, { practice, phone: patient.phone, text: confirmText });
        await logNotification(base44, { ...logArgs, channel: "whatsapp", status: "sent" });
      } catch (e) {
        console.error('sendWhatsAppMessage error (sendAppointmentConfirmation):', e?.message || e);
        await logNotification(base44, { ...logArgs, channel: "whatsapp", status: "failed", error: e });
      }
    }

    // Si la cita queda confirmada faltando menos de 3hs (típico cuando el profesional la
    // aprueba a mano recién sobre la fecha), esta confirmación ES el aviso: ya lleva día,
    // hora, servicio y dirección. Damos los recordatorios por cubiertos para que el cron no
    // mande, minutos después, un segundo mensaje diciendo lo mismo.
    try {
      if (patient && remindersCoveredByNotice(appt)) {
        // 2 = esta cita agotó sus recordatorios (ver nota en reminders.ts).
        await base44.asServiceRole.entities.Appointment.update(appt.id, { reminders_sent: 2 });
        await logNotification(base44, {
          ...logArgs, kind: "reminder_3h", channel: "whatsapp", status: "skipped",
          error: "Cubierto por la confirmación, que salió con menos de 3hs de anticipación",
        });
      }
    } catch (e) {
      console.error('remindersCoveredByNotice error (sendAppointmentConfirmation):', e?.message || e);
    }

    if (!email) {
      // Sin mail no hay nada más que mandar. Si tampoco salió el WhatsApp, LIBERAMOS la
      // reserva de arriba: no se avisó nada, así que si el turno se vuelve a tocar (o el
      // paciente carga un email después) tiene que poder intentarse de nuevo.
      if (!waSent) {
        try {
          await base44.asServiceRole.entities.Appointment.update(appt.id, { confirmation_email_sent: false });
        } catch (e) {
          console.error('sendAppointmentConfirmation release error:', e?.message || e);
        }
      }
      return Response.json({ skipped: !waSent, reason: waSent ? undefined : 'no patient email', waSent });
    }

    // Asegurar cancel_token para los botones de cancelar/reagendar. Se guarda ANTES de
    // mandar el mail, no despues: si el guardado fallaba (o la funcion moria en el medio),
    // el paciente recibia un mail con botones que apuntaban a un token que no existia en
    // ninguna cita, y al tocarlos veia "el enlace no es valido".
    let cancelToken = appt.cancel_token;
    if (!cancelToken) {
      cancelToken = crypto.randomUUID();
      try {
        await base44.asServiceRole.entities.Appointment.update(appt.id, { cancel_token: cancelToken });
      } catch (e) {
        console.error('sendAppointmentConfirmation cancel_token save error:', e?.message || e);
      }
    }

    const appUrl = await getAppUrl(base44, req);
    const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
    const serviceName = appt.service_name || "Consulta";

    const rescheduleUrl = handle ? `${appUrl}/reschedule/${cancelToken}` : null;
    const cancelUrl = `${appUrl}/x/${cancelToken}`;

    try {
      await sendEmail(base44, {
      to: email,
      // Si el paciente responde la confirmación, que le llegue al profesional.
      replyTo: replyToFor(practice),
      subject: `Tu cita fue confirmada — ${serviceName}`,
      body: buildEmailHtml({
        title: "Cita confirmada",
        greeting: `Hola ${patientName}`,
        lines: [
          `Tu cita fue confirmada. ¡Te esperamos!`,
          "Si necesitás reagendar o cancelar, usá los botones de abajo.",
        ],
        details: [
          { label: "Servicio", value: serviceName },
          { label: "Día y horario", value: dateStr },
          { label: "Profesional", value: professionalName || "—" },
          ...(address ? [{ label: "Dirección", value: address }] : []),
        ],
        primaryButton: rescheduleUrl ? { label: "Reagendar", url: rescheduleUrl } : null,
        secondaryButton: { label: "Cancelar cita", url: cancelUrl },
        mapsButton: mapsLink ? { label: "Cómo llegar", url: mapsLink } : null,
      }),
      });
    } catch (e) {
      // El envio fallo (Resend caido, remitente sin verificar, direccion rebotada). Antes
      // esto salia por el catch general como un 500 mudo y, peor, dejaba
      // confirmation_email_sent en true: la cita quedaba marcada como avisada para siempre
      // y ningun reintento volvia a mandar nada. Ahora queda registrado como envio fallido
      // y, si tampoco salio el WhatsApp, se libera la marca para poder reintentar.
      console.error('sendAppointmentConfirmation email error:', e?.message || e);
      await logNotification(base44, { ...logArgs, channel: "email", status: "failed", error: e });
      if (!waSent) {
        try {
          await base44.asServiceRole.entities.Appointment.update(appt.id, { confirmation_email_sent: false });
        } catch (releaseError) {
          console.error('sendAppointmentConfirmation release error:', releaseError?.message || releaseError);
        }
      }
      return Response.json({ ok: false, sent: false, waSent, error: 'email_failed' });
    }

    await logNotification(base44, { ...logArgs, channel: "email", status: "sent" });

    return Response.json({ ok: true, sent: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}