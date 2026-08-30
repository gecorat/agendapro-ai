import { sendWhatsAppMessage } from "./whatsapp-providers.ts";
import { sendEmail } from "./email-sender.ts";
import { buildEmailHtml } from "./email-template.ts";

// Si una cita queda confirmada con MENOS de 3 horas de anticipación, el cron de
// recordatorios (que corre una vez por hora, en punto) puede llegar a agarrarla recién en
// su próxima pasada — hasta una hora después de que ya había entrado en la ventana de
// "menos de 3hs antes". Confirmado en vivo: una cita reservada a las 20:02 para las 22:46
// (2h44 de anticipación real) recién recibió el aviso a las 21:04, con apenas 1h42 de
// margen en vez de estar cerca de las 3hs completas.
//
// Para este caso puntual (poca anticipación), mandamos el aviso de una sola vez al
// confirmar la cita, en vez de esperar al próximo tick del cron. Devuelve true si mandó
// el aviso — quien llama debe marcar reminders_sent=1 en ese caso, para que el cron no lo
// repita más tarde.
export async function maybeSendImmediateReminder(base44, practice, appointment, patient) {
  try {
    if (!patient) return false;
    const start = new Date(appointment.start_datetime);
    const now = new Date();
    const hoursUntil = (start.getTime() - now.getTime()) / 3600000;
    // Fuera de la ventana de "menos de 3hs antes" (ya pasó, o todavía falta más de 3hs
    // — en ese caso el cron horario de sendReminders ya tiene margen de sobra para
    // agarrarla con buena precisión más adelante, no hace falta el envío inmediato).
    if (hoursUntil <= 0 || hoursUntil > 3) return false;

    const dateStr = start.toLocaleString("es-AR", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
    const serviceName = appointment.service_name || "consulta";
    const professionalName = appointment.professional_name || practice?.practice_name || undefined;
    const address = practice?.address ? `${practice.address}${practice.address_city ? `, ${practice.address_city}` : ""}` : "";
    const patientName = (patient.first_name || "").trim();

    const pref = patient?.contact_preference || "email";
    const plan = practice?.plan || "trial";
    const whatsappAllowed = plan === "pro" || plan === "clinic";
    const wantsWhatsApp = pref === "whatsapp" || pref === "both";

    if (whatsappAllowed && wantsWhatsApp && patient?.phone && practice?.whatsapp_connected) {
      const waIntroText = `Hola${patientName ? ` ${patientName}` : ""}! Quería recordarte que en 3 horas es tu cita programada${professionalName ? ` con ${professionalName}` : ""}. Te paso los detalles...`;
      // Mismo formato (sin link de maps, con dirección completa) que el recordatorio
      // normal del cron — para que sea indistinguible del que hubiera mandado más tarde.
      const waReminderText = [
        `⏰ *Tu cita es en 3 horas*`,
        `📅 *Día y horario:* ${dateStr}`,
        `🩺 *Servicio:* ${serviceName}`,
        professionalName ? `👤 *Profesional:* ${professionalName}` : null,
        address ? `📍 *Dirección:* ${address}` : null,
        "",
        "🔁 *Si necesitás reagendar o cancelar, avisanos por este mismo medio* 😊",
      ].filter(Boolean).join("\n");
      await sendWhatsAppMessage(base44, practice, patient.phone, waIntroText);
      await sendWhatsAppMessage(base44, practice, patient.phone, waReminderText);
      return true;
    }

    if (patient?.email) {
      const emailBody = buildEmailHtml({
        title: "Tu cita es en 3 horas",
        greeting: `Hola ${patientName || ""}`.trim(),
        lines: ["Quisimos recordarte tu cita, que es en las próximas horas."],
        details: [
          { label: "Día y horario", value: dateStr },
          { label: "Servicio", value: serviceName },
          ...(professionalName ? [{ label: "Profesional", value: professionalName }] : []),
          ...(address ? [{ label: "Dirección", value: address }] : []),
        ],
        footer: practice?.practice_name || "Kame Agenda",
      });
      await sendEmail(base44, { to: patient.email, subject: patientName ? `${patientName}, tu cita es en 3 horas` : `Tu cita es en 3 horas — ${serviceName}`, body: emailBody });
      return true;
    }

    return false;
  } catch (e) {
    console.error("maybeSendImmediateReminder error:", e?.message || e);
    return false;
  }
}
