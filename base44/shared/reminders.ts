import { sendWhatsAppMessage } from "./whatsapp-providers.ts";
import { sendEmail, replyToFor } from "./email-sender.ts";
import { buildEmailHtml } from "./email-template.ts";
import { canSendWhatsApp } from "./plan.ts";

export const PRACTICE_TZ = "America/Argentina/Buenos_Aires";

// Día calendario (YYYY-MM-DD) de una fecha, visto desde la zona horaria del consultorio.
// Sirve para decidir "hoy"/"mañana" sin que el corte de medianoche UTC lo desalinee.
function localDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PRACTICE_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function localTime(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: PRACTICE_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

// Cuándo es la cita, en texto ANCLADO A LA HORA REAL en vez de a un margen relativo:
// "hoy a las 09:30", "mañana a las 09:30", "el martes 2 de septiembre a las 09:30".
//
// Por qué: el aviso de "3 horas antes" lo dispara un cron que corre cada tantos minutos,
// así que el margen real nunca es exactamente 3hs — antes el texto decía "tu cita es en 3
// horas" hardcodeado y llegaba, por ejemplo, 2h30 antes (cita 09:30, tick de las 10:00 con
// el cron horario viejo). La hora exacta no puede quedar desfasada nunca, sin importar en
// qué tick del cron salga el mensaje.
export function buildWhenLabel(start: Date, now: Date = new Date()): string {
  const startKey = localDayKey(start);
  const todayKey = localDayKey(now);
  const tomorrowKey = localDayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const time = localTime(start);
  if (startKey === todayKey) return `hoy a las ${time}`;
  if (startKey === tomorrowKey) return `mañana a las ${time}`;
  const day = start.toLocaleString("es-AR", {
    weekday: "long", day: "numeric", month: "long", timeZone: PRACTICE_TZ,
  });
  return `el ${day} a las ${time}`;
}

// Fecha larga completa para la fila "Día y horario" de la tabla de detalles.
export function formatApptDate(d: Date): string {
  return d.toLocaleString("es-AR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    timeZone: PRACTICE_TZ,
  });
}

// Qué canales corresponden para este paciente. "both" significa BOTH: antes esto era un
// if/else — si WhatsApp estaba conectado se mandaba SOLO WhatsApp y el email nunca salía,
// aunque el paciente hubiera pedido explícitamente los dos. El email solo aparecía como
// fallback cuando WhatsApp tiraba error.
export function resolveChannels(practice, patient) {
  const pref = patient?.contact_preference || "email";
  const wantsWhatsApp = pref === "whatsapp" || pref === "both";
  const wantsEmail = pref === "email" || pref === "both";
  return {
    whatsapp: wantsWhatsApp && !!patient?.phone && canSendWhatsApp(practice),
    email: wantsEmail && !!patient?.email,
    // Si el canal preferido no está disponible (sin WhatsApp conectado, o sin teléfono),
    // igual le mandamos por el otro con tal de que el aviso llegue.
    emailFallback: !!patient?.email,
  };
}

// Si una cita queda confirmada con MENOS de 3 horas de anticipación, el cron de
// recordatorios puede llegar a agarrarla recién en su próxima pasada — ya dentro de la
// ventana de "menos de 3hs antes". Para ese caso puntual mandamos el aviso de una sola vez
// al confirmar la cita, en vez de esperar al próximo tick.
//
// Devuelve true si mandó el aviso. Quien llama debe marcar reminders_sent = 2 en ese caso.
// OJO: 2, no 1. Con 1, una cita reservada con +48hs de anticipación que se confirma sobre
// la hora volvía a entrar en la ventana de 3hs del cron (que busca justamente
// reminders_sent === 1) y el paciente recibía el MISMO recordatorio dos veces. 2 = "esta
// cita ya agotó todos sus recordatorios".
export async function maybeSendImmediateReminder(base44, practice, appointment, patient) {
  try {
    if (!patient) return false;
    // Anti-duplicado: si esta cita ya recibió un recordatorio (sea del cron o de otro
    // envio inmediato), no mandamos otro. Hace falta porque varios flujos llaman a esta
    // función para la MISMA cita — por ejemplo la reserva pública auto-confirmada la
    // llama directo y además invoca sendAppointmentConfirmation, que también la llama.
    if ((appointment.reminders_sent || 0) > 0) return false;
    const start = new Date(appointment.start_datetime);
    const now = new Date();
    const hoursUntil = (start.getTime() - now.getTime()) / 3600000;
    // Fuera de la ventana de "menos de 3hs antes" (ya pasó, o todavía falta más de 3hs
    // — en ese caso el cron de sendReminders ya tiene margen de sobra para agarrarla con
    // buena precisión más adelante, no hace falta el envío inmediato).
    if (hoursUntil <= 0 || hoursUntil > 3) return false;

    const whenLabel = buildWhenLabel(start, now);
    const dateStr = formatApptDate(start);
    const serviceName = appointment.service_name || "consulta";
    const professionalName = appointment.professional_name || practice?.practice_name || undefined;
    const address = practice?.address ? `${practice.address}${practice.address_city ? `, ${practice.address_city}` : ""}` : "";
    const patientName = (patient.first_name || "").trim();

    const channels = resolveChannels(practice, patient);

    const waIntroText = `Hola${patientName ? ` ${patientName}` : ""}! Quería recordarte que tu cita es ${whenLabel}${professionalName ? `, con ${professionalName}` : ""}. Te paso los detalles...`;
    // Mismo formato (sin link de maps, con dirección completa) que el recordatorio
    // normal del cron — para que sea indistinguible del que hubiera mandado más tarde.
    const waReminderText = [
      `⏰ *Tu cita es ${whenLabel}*`,
      `📅 *Día y horario:* ${dateStr}`,
      `🩺 *Servicio:* ${serviceName}`,
      professionalName ? `👤 *Profesional:* ${professionalName}` : null,
      address ? `📍 *Dirección:* ${address}` : null,
      "",
      "🔁 *Si necesitás reagendar o cancelar, avisanos por este mismo medio* 😊",
    ].filter(Boolean).join("\n");

    const emailSubject = patientName ? `${patientName}, tu cita es ${whenLabel}` : `Tu cita es ${whenLabel} — ${serviceName}`;
    const emailBody = buildEmailHtml({
      title: `Tu cita es ${whenLabel}`,
      greeting: `Hola ${patientName || ""}`.trim(),
      lines: ["Quisimos recordarte tu cita, que es en las próximas horas."],
      details: [
        { label: "Día y horario", value: dateStr },
        { label: "Servicio", value: serviceName },
        ...(professionalName ? [{ label: "Profesional", value: professionalName }] : []),
        ...(address ? [{ label: "Dirección", value: address }] : []),
      ],
    });

    // Si el paciente responde el recordatorio, que le llegue al profesional.
    const replyTo = replyToFor(practice);

    let waOk = false;
    let mailOk = false;

    if (channels.whatsapp) {
      try {
        await sendWhatsAppMessage(base44, practice, patient.phone, waIntroText);
        await sendWhatsAppMessage(base44, practice, patient.phone, waReminderText);
        waOk = true;
      } catch (e) {
        console.error("maybeSendImmediateReminder WhatsApp error:", e?.message || e);
      }
    }

    if (channels.email) {
      try {
        await sendEmail(base44, { to: patient.email, subject: emailSubject, body: emailBody, replyTo });
        mailOk = true;
      } catch (e) {
        console.error("maybeSendImmediateReminder email error:", e?.message || e);
      }
    }

    // Último recurso: no salió por ningún canal pero hay un email cargado.
    if (!waOk && !mailOk && channels.emailFallback) {
      try {
        await sendEmail(base44, { to: patient.email, subject: emailSubject, body: emailBody, replyTo });
        mailOk = true;
      } catch (e) {
        console.error("maybeSendImmediateReminder email fallback error:", e?.message || e);
      }
    }

    return waOk || mailOk;
  } catch (e) {
    console.error("maybeSendImmediateReminder error:", e?.message || e);
    return false;
  }
}
