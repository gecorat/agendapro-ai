import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildEmailHtml, getAppUrl } from "../../shared/email-template.ts";
import { sendEmail } from "../../shared/email-sender.ts";
import { getAppointmentContext } from "../../shared/appointment-context.ts";
import { buildMapsLink, buildConfirmationMessage, buildBookAckMessage } from "../../shared/zernio.ts";
import { sendWhatsAppMessage } from "../../shared/whatsapp-providers.ts";
import { maybeSendImmediateReminder } from "../../shared/reminders.ts";
import { canSendWhatsApp } from "../../shared/plan.ts";

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
    } catch {}

    // Configuración del profesional (nombre del consultorio + handle + teléfono/dirección)
    const professionalId = appt.professional_id || appt.created_by_id;
    let practiceName = "";
    let handle = "";
    let practice = null;
    try {
      const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
      practice = practices?.find((p) => p.created_by_id === professionalId) || null;
      if (practice?.practice_name) practiceName = practice.practice_name;
      if (practice?.handle) handle = practice.handle;
    } catch {}

    const { professionalName, address } = await getAppointmentContext(base44, appt, practice);
    const mapsLink = buildMapsLink(practice);
    const startDate = new Date(appt.start_datetime);

    // WhatsApp al paciente. Va ANTES del early-return por falta de email: si el paciente
    // no tiene mail cargado (típico de los que llegan por WhatsApp), igual tiene que
    // recibir el aviso por el canal que sí usa. Antes esta función mandaba SOLO email, así
    // que cuando el profesional confirmaba una cita a mano desde la campanita, al paciente
    // no le llegaba nada por WhatsApp — solo un mail (o nada, si no tenía mail cargado).
    let waSent = false;
    if (!skip_whatsapp && canSendWhatsApp(practice) && patient?.phone) {
      try {
        await sendWhatsAppMessage(base44, practice, patient.phone, buildBookAckMessage());
        await sendWhatsAppMessage(base44, practice, patient.phone, buildConfirmationMessage({
          practice,
          service: { name: appt.service_name || "Consulta" },
          start: startDate,
          professionalName,
        }));
        waSent = true;
      } catch (e) {
        console.error('sendWhatsAppMessage error (sendAppointmentConfirmation):', e?.message || e);
      }
    }

    // Si la cita queda confirmada faltando menos de 3hs (típico cuando el profesional la
    // aprueba a mano recién sobre la fecha), el cron de recordatorios ya no llega a
    // avisarle con margen — y si estuvo en "pending" hasta ahora, nunca recibió ninguno,
    // porque sendReminders solo mira citas confirmadas. Mandamos el recordatorio de una.
    try {
      if (patient) {
        const sentNow = await maybeSendImmediateReminder(
          base44, practice,
          { start_datetime: appt.start_datetime, service_name: appt.service_name, professional_name: professionalName, reminders_sent: appt.reminders_sent },
          patient
        );
        if (sentNow) {
          await base44.asServiceRole.entities.Appointment.update(appt.id, { reminders_sent: 1 });
        }
      }
    } catch (e) {
      console.error('maybeSendImmediateReminder error (sendAppointmentConfirmation):', e?.message || e);
    }

    if (!email) {
      // Sin mail no hay nada más que mandar, pero si ya avisamos por WhatsApp marcamos la
      // confirmación como enviada igual, para no reintentar en cada update posterior.
      if (waSent) {
        await base44.asServiceRole.entities.Appointment.update(appt.id, { confirmation_email_sent: true });
      }
      return Response.json({ skipped: !waSent, reason: waSent ? undefined : 'no patient email', waSent });
    }

    // Asegurar cancel_token para el botón de cancelar/reagendar. No lo guardamos con un
    // update aparte: dos updates seguidos sobre el mismo turno en la misma corrida pueden
    // pisarse entre sí (ya pasó con reminders_sent). Se combina en un único update al final.
    let cancelToken = appt.cancel_token;
    const needsTokenSave = !cancelToken;
    if (!cancelToken) cancelToken = crypto.randomUUID();

    const appUrl = await getAppUrl(base44, req);
    const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
    const serviceName = appt.service_name || "Consulta";
    const signature = practiceName ? practiceName : "Kame Agenda";

    const rescheduleUrl = handle ? `${appUrl}/reschedule/${cancelToken}` : null;
    const cancelUrl = `${appUrl}/x/${cancelToken}`;

    await sendEmail(base44, {
      to: email,
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
        footer: signature,
      }),
    });

    await base44.asServiceRole.entities.Appointment.update(appt.id, {
      confirmation_email_sent: true,
      ...(needsTokenSave ? { cancel_token: cancelToken } : {}),
    });

    return Response.json({ ok: true, sent: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}