import { normalizePhone } from "./whatsapp-providers.ts";
import { ownerIdOf } from "./ownership.ts";

// OJO: `push.ts` importa `npm:web-push`, que es pesado y solo hace falta en el camino de
// "falló todo". Se carga con `await import(...)` DENTRO de la función, no arriba: al
// importarlo a nivel de módulo, esta cadena entraba en sendAppointmentConfirmation y en
// sendReminders, y una confirmación de turno pasó a no dispararse más. Mismo criterio que
// usa whatsapp-providers.ts con zernio/evolution.

// Registro de avisos al paciente. Existe por dos razones:
//
//  1. El profesional necesita PODER VER que el aviso salió — el chat de WhatsApp solo
//     mostraba los mensajes del bot, y del email no había rastro en ningún lado.
//  2. Diagnóstico. Cuando el envío por WhatsApp fallaba, el error moría en un
//     console.error que nadie leía: desde afuera se veía como "llegó el mail pero nunca
//     el WhatsApp", sin ninguna pista. Esto pasó en vivo el 31/08 (el teléfono iba con
//     "+" a Evolution API y el JID quedaba inválido) y costó bastante encontrarlo.
//
// Todo acá es best-effort: registrar un aviso NUNCA puede romper el envío en sí.

export const KIND_LABELS = {
  confirmation: "Confirmación de turno",
  reminder_24h: "Recordatorio de 24 horas",
  reminder_3h: "Recordatorio de 3 horas",
  rescheduled: "Aviso de reprogramación",
  cancelled: "Aviso de cancelación",
};

export async function logNotification(base44, { appointment, practice, patient, kind, channel, status, error }) {
  try {
    await base44.asServiceRole.entities.NotificationLog.create({
      appointment_id: appointment?.id || undefined,
      patient_id: patient?.id || undefined,
      professional_id: ownerIdOf(practice) || appointment?.professional_id || undefined,
      kind,
      channel,
      status,
      to: channel === "whatsapp" ? (patient?.phone || "") : (patient?.email || ""),
      error: error ? String(error?.message || error).slice(0, 500) : undefined,
      sent_at: new Date().toISOString(),
    });
  } catch (e) {
    console.error("logNotification error:", e?.message || e);
  }
}

// Deja el mensaje automático en el historial del chat de WhatsApp, igual que cualquier
// mensaje del bot, para que la bandeja del profesional no tenga un hueco donde en
// realidad SÍ le hablamos al paciente. `sent_by: "system"` lo distingue del bot ("IA") y
// de los mensajes escritos a mano por el profesional ("Vos") — y además hace que estos
// mensajes se salteen al armar el contexto del bot y al contar los no leídos.
export async function logWhatsAppToConversation(base44, { practice, phone, text }) {
  try {
    const normalized = normalizePhone(phone);
    if (!normalized) return;
    await base44.asServiceRole.entities.Conversation.create({
      phone: normalized,
      professional_id: ownerIdOf(practice),
      role: "assistant",
      text,
      conversation_id: normalized,
      account_id: practice?.whatsapp_connection_type === "qr"
        ? practice?.evolution_instance_name
        : practice?.zernio_account_id,
      sent_by: "system",
    });
  } catch (e) {
    console.error("logWhatsAppToConversation error:", e?.message || e);
  }
}

// Push al profesional cuando un aviso no salió por NINGÚN canal. Es el caso que más
// importa y el único que antes pasaba en absoluto silencio: el paciente se queda sin
// saber de su turno y nadie se entera hasta que no aparece.
//
// UN SOLO push por turno, no uno por intento. El cron corre cada 15 minutos y una cita
// puede reintentar durante horas: sin este control, un turno con un teléfono mal cargado
// producía decenas de pushes idénticos. Si ya hay un fallo registrado para esta cita,
// asumimos que el profesional ya fue avisado.
export async function notifyProfessionalOfDeliveryFailure(base44, { practice, appointment, patientName, kind }) {
  try {
    if (!practice) return;

    if (appointment?.id) {
      try {
        const previos = await base44.asServiceRole.entities.NotificationLog.filter({
          appointment_id: appointment.id,
          status: "failed",
        });
        // > 0 y no >= 1 a propósito: el fallo de ESTA corrida ya se registró antes de
        // llamar acá, así que "1" es el primero y recién a partir del segundo repetimos.
        if ((previos || []).length > 1) return;
      } catch { /* si no se puede chequear, mejor avisar de más que de menos */ }
    }

    const start = new Date(appointment?.start_datetime);
    const when = isNaN(start.getTime())
      ? ""
      : start.toLocaleString("es-AR", {
          day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
          timeZone: "America/Argentina/Buenos_Aires",
        });

    const { sendPushToUsers, getPracticeRecipientUserIds } = await import("./push.ts");
    const userIds = await getPracticeRecipientUserIds(base44, practice);
    await sendPushToUsers(base44, userIds, {
      title: "No se pudo avisar al paciente",
      body: `${KIND_LABELS[kind] || "Aviso"}: no salió por ningún canal para ${patientName || "el paciente"}${when ? ` (turno del ${when})` : ""}. Convendría avisarle a mano.`,
      url: "/agenda",
      tag: `delivery-failed-${appointment?.id || ""}`,
    });
  } catch (e) {
    console.error("notifyProfessionalOfDeliveryFailure error:", e?.message || e);
  }
}
