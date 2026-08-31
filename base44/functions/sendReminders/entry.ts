import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendEmail, replyToFor } from "../../shared/email-sender.ts";
import { sendWhatsAppMessage } from "../../shared/whatsapp-providers.ts";
import { buildEmailHtml, getAppUrl } from "../../shared/email-template.ts";
import { getAppointmentContext } from "../../shared/appointment-context.ts";
import { buildMapsLink } from "../../shared/zernio.ts";
import { buildWhenLabel, formatApptDate, resolveChannels } from "../../shared/reminders.ts";
import { logNotification, logWhatsAppToConversation, notifyProfessionalOfDeliveryFailure } from "../../shared/notification-log.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();

    // Base44 guarda created_date en UTC pero SIN el sufijo "Z" (confirmado en vivo con la
    // hora del chat) — sin forzarla acá, `new Date(...)` la interpretaría mal.
    function parseServerDate(dateStr) {
      if (!dateStr) return new Date(NaN);
      const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(dateStr);
      return new Date(hasTz ? dateStr : `${dateStr}Z`);
    }

    const appUrl = await getAppUrl(base44, req);

    // Qué recordatorio le toca a esta cita AHORA, o null si ninguno.
    //
    //  - "24h": solo para citas reservadas con al menos 48hs de anticipación (si se reservó
    //    con menos margen que eso, un aviso de "24hs antes" no tiene sentido real). Exige
    //    ADEMÁS que falten más de 3hs: antes esta ventana era solo `start <= now + 24h`, así
    //    que una cita reservada con mucha anticipación pero confirmada recién sobre la hora
    //    recibía un mail diciendo "tu cita es en 24 horas" cuando faltaba 1.
    //  - "3h": el aviso final. Lo recibe toda cita confirmada, haya tenido el de 24hs o no
    //    (incluido el caso de la confirmación tardía, que entra directo acá).
    function reminderStage(appt) {
      if (appt.is_demo) return null; // cita de prueba del simulador /bot — nunca recordatorios reales
      const start = new Date(appt.start_datetime);
      if (isNaN(start.getTime())) return null;
      const hoursUntil = (start.getTime() - now.getTime()) / 3600000;
      if (hoursUntil <= 0) return null;

      const created = parseServerDate(appt.created_date);
      const bookedWithMargin = !isNaN(created.getTime())
        && (start.getTime() - created.getTime()) >= 48 * 60 * 60 * 1000;
      const reminders = appt.reminders_sent || 0;

      if (bookedWithMargin && reminders === 0 && hoursUntil > 3 && hoursUntil <= 24) return "24h";
      if (hoursUntil <= 3 && (reminders === 0 || (bookedWithMargin && reminders === 1))) return "3h";
      return null;
    }

    const all = await base44.asServiceRole.entities.Appointment.filter({ status: "confirmed" });
    const toRemind = (all || [])
      .map((a) => ({ appt: a, stage: reminderStage(a) }))
      .filter((x) => x.stage !== null);

    // Cache de PracticeSettings para evitar consultas repetidas
    let practices = null;
    const getPracticeFor = async (appt) => {
      if (!practices) {
        practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
      }
      const profId = appt.professional_id || appt.created_by_id;
      return (practices || []).find((p) => p.created_by_id === profId) || null;
    };

    let sent = 0;
    let skipped = 0;
    const errors = [];
    const sentDetail = [];

    for (const { appt, stage } of toRemind) {
      try {
        // Paciente
        let patient = null;
        if (appt.patient_id) {
          try {
            const pats = await base44.asServiceRole.entities.Patient.filter({ id: appt.patient_id });
            patient = pats?.[0];
          } catch {}
        }
        // Respeta consentimiento explícito
        if (patient && patient.consent_reminders === false) { skipped++; continue; }

        const patientName = patient
          ? `${patient.first_name} ${patient.last_name || ""}`.trim() || appt.patient_name || ""
          : appt.patient_name || "";

        const startDate = new Date(appt.start_datetime);
        const dateStr = formatApptDate(startDate);
        const serviceName = appt.service_name || "consulta";

        // El texto se ancla a la HORA REAL de la cita ("hoy a las 09:30"), no a un margen
        // relativo hardcodeado. El cron corre cada 15 minutos, así que el margen efectivo
        // nunca es exactamente 3hs ni 24hs — decirlo en horas relativas garantizaba un
        // mensaje desfasado (llegaba 2h30 antes diciendo "en 3 horas").
        const whenLabel = buildWhenLabel(startDate, now);

        const practice = await getPracticeFor(appt);
        const { professionalName, address } = await getAppointmentContext(base44, appt, practice);
        const mapsLink = buildMapsLink(practice);
        // Si el paciente responde el recordatorio, que le llegue al profesional.
        const replyTo = replyToFor(practice);

        // Aseguramos un cancel_token para poder ofrecer los mismos botones de la
        // confirmación (reagendar / cancelar) también acá, no solo texto plano. OJO: no lo
        // guardamos todavía con un update aparte — dos updates seguidos sobre el mismo
        // registro en la misma corrida pisaban el cambio (se probó y el cancel_token
        // volvía a null). Lo combinamos en un único update al final, junto a reminders_sent.
        let cancelToken = appt.cancel_token;
        const needsTokenSave = !cancelToken;
        if (!cancelToken) cancelToken = crypto.randomUUID();
        const rescheduleUrl = practice?.handle ? `${appUrl}/reschedule/${cancelToken}` : null;
        const cancelUrl = `${appUrl}/x/${cancelToken}`;

        const subject = patientName
          ? `${patientName}, tu cita es ${whenLabel}`
          : `Tu cita es ${whenLabel} — ${serviceName}`;
        const emailBody = buildEmailHtml({
          title: `Tu cita es ${whenLabel}`,
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
        });

        // Mensaje de entrada corto que se manda ANTES de los datos completos, para que la
        // conversación se sienta en dos tiempos naturales — igual que hace el bot cuando
        // agenda o reagenda un turno (buildBookAckMessage/buildRescheduleAckMessage en
        // zernio.ts) — en vez de tirarle al paciente un bloque grande de una.
        const waIntroText = `Hola${patientName ? ` ${patientName}` : ""}! Quería recordarte que tu cita es ${whenLabel}${professionalName ? `, con ${professionalName}` : ""}. Te paso los detalles...`;

        // Mismo formato enriquecido (negrita nativa de WhatsApp + emojis) que el mensaje de
        // confirmación del bot. Sin link de reagendar/cancelar (se pide avisar por el mismo
        // medio) y SIN el link de Google Maps — ese va solo en la confirmación inicial de la
        // cita; acá alcanza con la dirección completa en texto.
        const waReminderText = [
          `⏰ *Tu cita es ${whenLabel}*`,
          `📅 *Día y horario:* ${dateStr}`,
          `🩺 *Servicio:* ${serviceName}`,
          professionalName ? `👤 *Profesional:* ${professionalName}` : null,
          address ? `📍 *Dirección:* ${address}` : null,
          "",
          "🔁 *Si necesitás reagendar o cancelar, avisanos por este mismo medio* 😊",
        ].filter(Boolean).join("\n");

        // Canales. "both" ahora manda por LOS DOS. Antes era un if/else: si el consultorio
        // tenía WhatsApp conectado se mandaba solo WhatsApp y el email no salía nunca,
        // aunque el paciente hubiera elegido "ambos" — el mail solo aparecía como fallback
        // si WhatsApp fallaba.
        const channels = resolveChannels(practice, patient);
        const kind = stage === "24h" ? "reminder_24h" : "reminder_3h";
        const logArgs = { appointment: appt, practice, patient, kind };

        let waOk = false;
        let mailOk = false;

        if (channels.whatsapp) {
          try {
            // Dos mensajes seguidos (intro + detalles), igual que el flujo de agendamiento
            // del bot, en vez de un único bloque grande de texto.
            await sendWhatsAppMessage(base44, practice, patient.phone, waIntroText);
            await sendWhatsAppMessage(base44, practice, patient.phone, waReminderText);
            waOk = true;
            // Que el recordatorio quede visible en el chat con el paciente: el profesional
            // veía la conversación sin rastro de los avisos automáticos que sí se mandaron.
            await logWhatsAppToConversation(base44, { practice, phone: patient.phone, text: waIntroText });
            await logWhatsAppToConversation(base44, { practice, phone: patient.phone, text: waReminderText });
          } catch (e) {
            console.error("sendReminders WhatsApp error:", e?.message || e);
            await logNotification(base44, { ...logArgs, channel: "whatsapp", status: "failed", error: e });
          }
          if (waOk) await logNotification(base44, { ...logArgs, channel: "whatsapp", status: "sent" });
        }

        if (channels.email) {
          try {
            await sendEmail(base44, { to: patient.email, subject, body: emailBody, replyTo });
            mailOk = true;
            await logNotification(base44, { ...logArgs, channel: "email", status: "sent" });
          } catch (e) {
            console.error("sendReminders email error:", e?.message || e);
            await logNotification(base44, { ...logArgs, channel: "email", status: "failed", error: e });
          }
        }

        // Último recurso: el canal preferido no estaba disponible o falló, pero hay email
        // cargado. Mejor que le llegue por el otro medio a que no le llegue nada.
        if (!waOk && !mailOk && channels.emailFallback) {
          try {
            await sendEmail(base44, { to: patient.email, subject, body: emailBody, replyTo });
            mailOk = true;
            await logNotification(base44, { ...logArgs, channel: "email", status: "sent" });
          } catch (e) {
            console.error("sendReminders email fallback error:", e?.message || e);
            await logNotification(base44, { ...logArgs, channel: "email", status: "failed", error: e });
          }
        }

        if (!waOk && !mailOk) {
          // No salió por ningún lado. Este es EL caso que antes pasaba en silencio total:
          // el paciente se queda sin saber de su turno y nadie se entera hasta que falta.
          await notifyProfessionalOfDeliveryFailure(base44, {
            practice, appointment: appt, patientName, kind,
          });
          skipped++; continue;
        }

        await base44.asServiceRole.entities.Appointment.update(appt.id, {
          // 1 = ya salió el de 24hs (falta el de 3hs). 2 = esta cita agotó sus recordatorios.
          reminders_sent: stage === "24h" ? 1 : 2,
          ...(needsTokenSave ? { cancel_token: cancelToken } : {}),
        });
        sent++;
        sentDetail.push({
          appointment_id: appt.id,
          stage,
          when: whenLabel,
          channels: [waOk ? "whatsapp" : null, mailOk ? "email" : null].filter(Boolean),
        });
      } catch (e) {
        errors.push({ appointment_id: appt.id, error: e?.message || String(e) });
      }
    }

    return Response.json({ sent, skipped, total: toRemind.length, sentDetail, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
