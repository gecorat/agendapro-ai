import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendEmail } from "../../shared/email-sender.ts";
import { sendWhatsAppMessage } from "../../shared/whatsapp-providers.ts";
import { buildEmailHtml, getAppUrl } from "../../shared/email-template.ts";
import { getAppointmentContext } from "../../shared/appointment-context.ts";
import { buildMapsLink } from "../../shared/zernio.ts";

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

    // Recordatorio de 24hs: vuelve a existir, pero SOLO para citas reservadas con al menos
    // 48hs de anticipación (diferencia entre cuándo se reservó la cita y cuándo es). Si se
    // reservó con menos margen que eso, un aviso de "24hs antes" no tiene sentido real (a
    // veces ni pasan 24hs entre que se reserva y la cita en sí) y esas citas solo reciben
    // el recordatorio de 3hs. Esto evita además el bug viejo: antes la ventana de 24hs
    // atrapaba CUALQUIER cita del día apenas se creaba, con el texto mal etiquetado.
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const appUrl = await getAppUrl(base44, req);

    const all = await base44.asServiceRole.entities.Appointment.filter({ status: "confirmed" });
    const toRemind = (all || []).filter((a) => {
      if (a.is_demo) return false; // cita de prueba del simulador /bot — nunca recordatorios reales
      const start = new Date(a.start_datetime);
      const created = parseServerDate(a.created_date);
      const reminders = a.reminders_sent || 0;
      const bookedWithMargin = !isNaN(created.getTime()) && (start.getTime() - created.getTime()) >= 48 * 60 * 60 * 1000;
      if (bookedWithMargin) {
        const in24Window = reminders === 0 && start >= now && start <= in24h;
        const in3Window = reminders === 1 && start >= now && start <= in3h;
        return in24Window || in3Window;
      }
      // Reservada con menos de 48hs de anticipación: sin recordatorio de 24hs, directo al de 3hs.
      return reminders === 0 && start >= now && start <= in3h;
    });

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

    for (const appt of toRemind) {
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
        const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
        const serviceName = appt.service_name || "consulta";

        // Misma cuenta que en el filtro de arriba: si esta cita se reservó con al menos
        // 48hs de anticipación Y todavía no se mandó ningún recordatorio, este es el de
        // 24hs (el primero de dos); si no, es directamente el de 3hs (único o segundo).
        // Usamos "en 24 horas" en vez de "mañana" a propósito: es relativo a AHORA, no a un
        // cálculo de fecha que pueda desalinearse con la hora real en la que corre el cron.
        const createdAt = parseServerDate(appt.created_date);
        const bookedWithMargin = !isNaN(createdAt.getTime()) && (startDate.getTime() - createdAt.getTime()) >= 48 * 60 * 60 * 1000;
        const is24hReminder = bookedWithMargin && (appt.reminders_sent || 0) === 0;
        const windowLabel = is24hReminder ? "24 horas" : "3 horas";

        const practice = await getPracticeFor(appt);
        const { professionalName, address } = await getAppointmentContext(base44, appt, practice);
        const mapsLink = buildMapsLink(practice);

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

        const subject = patientName ? `${patientName}, tu cita es en ${windowLabel}` : `Tu cita es en ${windowLabel} — ${serviceName}`;
        const emailBody = buildEmailHtml({
          title: `Tu cita es en ${windowLabel}`,
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
          footer: practice?.practice_name || "Kame Agenda",
        });

        // Mensaje de entrada corto que se manda ANTES de los datos completos, para que la
        // conversación se sienta en dos tiempos naturales — igual que hace el bot cuando
        // agenda o reagenda un turno (buildBookAckMessage/buildRescheduleAckMessage en
        // zernio.ts) — en vez de tirarle al paciente un bloque grande de una.
        const waIntroText = `Hola${patientName ? ` ${patientName}` : ""}! Quería recordarte que en ${windowLabel} es tu cita programada${professionalName ? ` con ${professionalName}` : ""}. Te paso los detalles...`;

        // Mismo formato enriquecido (negrita nativa de WhatsApp + emojis) que el mensaje de
        // confirmación del bot. Sin link de reagendar/cancelar (se pide avisar por el mismo
        // medio) y SIN el link de Google Maps — ese va solo en la confirmación inicial de la
        // cita; acá alcanza con la dirección completa en texto.
        const waReminderText = [
          `⏰ *Tu cita es en ${windowLabel}*`,
          `📅 *Día y horario:* ${dateStr}`,
          `🩺 *Servicio:* ${serviceName}`,
          professionalName ? `👤 *Profesional:* ${professionalName}` : null,
          address ? `📍 *Dirección:* ${address}` : null,
          "",
          "🔁 *Si necesitás reagendar o cancelar, avisanos por este mismo medio* 😊",
        ].filter(Boolean).join("\n");

        // Decidir canal
        const plan = practice?.plan || "trial";
        const pref = patient?.contact_preference || "email";
        // Bug corregido: comparaba contra "premium", que ya no existe (el plan se llama
        // "clinic" desde el rediseño de precios) — los recordatorios por WhatsApp nunca se
        // disparaban para cuentas Clinic.
        const whatsappAllowed = plan === "pro" || plan === "clinic";
        const wantsWhatsApp = pref === "whatsapp" || pref === "both";

        let channelUsed = "email";
        if (whatsappAllowed && wantsWhatsApp && patient?.phone) {
          // Antes esto solo chequeaba `zernio_account_id` para decidir si había WhatsApp
          // conectado — una cuenta conectada por QR (Evolution API) nunca tiene ese campo
          // cargado, así que NUNCA le llegaban recordatorios por WhatsApp a sus pacientes,
          // sin ningún error visible (caía derecho al fallback de email en silencio). Ahora
          // usamos la misma función genérica que ya sabe elegir Zernio o Evolution según
          // corresponda, igual que el bot y las respuestas manuales.
          const whatsAppConnected = !!practice?.whatsapp_connected;
          if (whatsAppConnected) {
            try {
              // Dos mensajes seguidos (intro + detalles), igual que el flujo de agendamiento
              // del bot, en vez de un único bloque grande de texto.
              await sendWhatsAppMessage(base44, practice, patient.phone, waIntroText);
              await sendWhatsAppMessage(base44, practice, patient.phone, waReminderText);
              channelUsed = "whatsapp";
            } catch (e) {
              // Fallback a email si WhatsApp falla y el paciente acepta email
              if (pref === "both" && patient.email) {
                await sendEmail(base44, { to: patient.email, subject, body: emailBody });
                channelUsed = "email";
              } else {
                throw e;
              }
            }
          } else if (patient.email) {
            await sendEmail(base44, { to: patient.email, subject, body: emailBody });
          } else {
            skipped++; continue;
          }
        } else if (patient?.email) {
          await sendEmail(base44, { to: patient.email, subject, body: emailBody });
        } else {
          skipped++; continue;
        }

        await base44.asServiceRole.entities.Appointment.update(appt.id, {
          reminders_sent: (appt.reminders_sent || 0) + 1,
          ...(needsTokenSave ? { cancel_token: cancelToken } : {}),
        });
        sent++;
      } catch (e) {
        errors.push({ appointment_id: appt.id, error: e?.message || String(e) });
      }
    }

    return Response.json({ sent, skipped, total: toRemind.length, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
