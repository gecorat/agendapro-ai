// Lógica de conteo de uso del bot de WhatsApp por período de facturación, con avisos
// progresivos (90% / 95% / 100%) y oferta de packs adicionales. Se llama una vez por
// mensaje entrante que el webhook decide procesar.
import { sendEmail } from "./email-sender.ts";
import { buildEmailHtml } from "./email-template.ts";
import { canUseWhatsApp, getWhatsAppQuota, getCycleStart, ADDON_PACKS } from "./plan.ts";

// ¿El período contado quedó atrás del ciclo vigente? El ciclo va del aniversario de la
// suscripción al siguiente (ver getCycleStart en plan.ts), NO del 1º al 1º: así el cupo
// se renueva el mismo día en que Mercado Pago cobra.
function isNewBillingPeriod(practice, now) {
  if (!practice?.whatsapp_usage_period_start) return true;
  return new Date(practice.whatsapp_usage_period_start) < getCycleStart(practice, now);
}

// Resetea el contador si arrancó un ciclo nuevo. Devuelve la práctica ya al día (con el
// período actual), para que los cálculos de cupo de esta misma llamada sean correctos.
async function ensureCurrentPeriod(base44, practice) {
  const now = new Date();
  if (!isNewBillingPeriod(practice, now)) return practice;
  const updated = await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
    whatsapp_usage_count: 0,
    // Se guarda el inicio REAL del ciclo (el aniversario), no el momento del reset: si el
    // primer mensaje del ciclo llega tres días tarde, el período igual arranca el día que
    // corresponde y el próximo corte cae donde tiene que caer.
    whatsapp_usage_period_start: getCycleStart(practice, now).toISOString(),
    whatsapp_usage_alert_90_sent: false,
    whatsapp_usage_alert_95_sent: false,
    whatsapp_usage_alert_100_sent: false,
  });
  return { ...practice, ...updated };
}

const ADDON_PITCH = Object.values(ADDON_PACKS)
  .map((p) => `${p.label} por $${p.price.toLocaleString("es-AR")} ARS`)
  .join(" o ");

async function notifyProfessional(base44, practice, { subject, lines }) {
  if (!practice.professional_email) return;
  try {
    const html = buildEmailHtml({ title: subject, lines });
    await sendEmail(base44, { to: practice.professional_email, subject, body: html });
  } catch (e) {
    console.error("notifyProfessional error:", e?.message || e);
  }
}

// Se llama ANTES de procesar un mensaje entrante. Devuelve:
// - { allowed: true }                        → seguir con el flujo normal del bot
// - { allowed: false, autoReplyToPatient }    → no llamar al LLM; mandarle este texto al
//                                                paciente en su lugar (plan vencido o
//                                                cupo agotado)
export async function checkWhatsAppUsage(base44, practiceIn) {
  const practice = await ensureCurrentPeriod(base44, practiceIn);

  if (!canUseWhatsApp(practice)) {
    return {
      allowed: false,
      autoReplyToPatient:
        "¡Hola! En este momento no podemos procesar tu mensaje automáticamente. El consultorio te va a contactar a la brevedad.",
    };
  }

  const quota = getWhatsAppQuota(practice);

  if (quota.remaining <= 0) {
    if (!practice.whatsapp_usage_alert_100_sent) {
      await base44.asServiceRole.entities.PracticeSettings.update(practice.id, { whatsapp_usage_alert_100_sent: true });
      await notifyProfessional(base44, practice, {
        subject: "Llegaste al límite de conversaciones de WhatsApp",
        lines: [
          `Tu plan ${practice.plan} procesó ${quota.used}/${quota.total} conversaciones este mes.`,
          "El bot le está avisando a tus pacientes que el consultorio los va a contactar directamente, para no dejarlos sin respuesta.",
          `Sumá cupo con un pack adicional: ${ADDON_PITCH}.`,
        ],
      });
    }
    return {
      allowed: false,
      autoReplyToPatient:
        "¡Hola! En este momento estamos con alta demanda y no podemos responderte automáticamente. El consultorio te va a contactar a la brevedad, ¡gracias por tu paciencia!",
    };
  }

  // Todavía hay cupo: contamos este mensaje y, si corresponde, disparamos el aviso de
  // 90% o 95% (una sola vez por período, por eso el flag).
  const updatedCount = quota.used + 1;
  await base44.asServiceRole.entities.PracticeSettings.update(practice.id, { whatsapp_usage_count: updatedCount });
  const newRatio = quota.total > 0 ? updatedCount / quota.total : 0;
  const remaining = Math.max(0, quota.total - updatedCount);

  if (newRatio >= 0.95 && !practice.whatsapp_usage_alert_95_sent) {
    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, { whatsapp_usage_alert_95_sent: true });
    await notifyProfessional(base44, practice, {
      subject: `Últimas ${remaining} conversaciones de WhatsApp disponibles`,
      lines: [
        `Te quedan ${remaining} conversaciones de tu cupo mensual (${quota.total}).`,
        "Cuando se agote, el bot le va a avisar a tus pacientes que el consultorio los contacta directo, pero es mejor sumar cupo antes de llegar a ese punto.",
        `Packs disponibles: ${ADDON_PITCH}.`,
      ],
    });
  } else if (newRatio >= 0.90 && !practice.whatsapp_usage_alert_90_sent) {
    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, { whatsapp_usage_alert_90_sent: true });
    await notifyProfessional(base44, practice, {
      subject: `Te quedan ${remaining} conversaciones de WhatsApp este mes`,
      lines: [
        `Ya usaste el 90% de tu cupo mensual (${quota.total} conversaciones).`,
        `Si querés asegurarte de no quedarte sin bot, podés sumar un pack: ${ADDON_PITCH}.`,
      ],
    });
  }

  return { allowed: true };
}
