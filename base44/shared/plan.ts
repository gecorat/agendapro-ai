// Lógica de planes compartida entre funciones de backend. Es la contraparte de
// src/lib/plan-utils.js (que es la versión para el frontend) — mantener ambas en sync
// si cambian precios o límites.

export const PLAN_PRICES = {
  basic: 39000,
  pro: 69000,
  clinic: 119000,
};

export const PLAN_LABELS = {
  trial: "Prueba",
  basic: "Básico",
  pro: "Pro",
  clinic: "Clinic",
};

// Cupo de conversaciones/turnos procesados por el bot de WhatsApp, por período de
// facturación (se resetea mensualmente). No aplica a "basic" porque ese plan no tiene
// bot de WhatsApp habilitado.
export const PLAN_WHATSAPP_LIMIT = {
  pro: 300,
  clinic: 1000,
};

// Packs adicionales de conversaciones que se pueden comprar al acercarse al límite.
export const ADDON_PACKS = {
  pack_100: { conversations: 100, price: 15000, label: "+100 conversaciones" },
  pack_250: { conversations: 250, price: 30000, label: "+250 conversaciones" },
};

export function isPlanActive(practice) {
  if (!practice) return false;
  if (practice.suspended) return false;
  const plan = practice.plan || "trial";
  if (plan === "trial") {
    if (!practice.trial_ends_at) return true;
    return new Date(practice.trial_ends_at) >= new Date();
  }
  return true;
}

// El bot de WhatsApp (conectar número, o que el webhook siga procesando mensajes)
// requiere plan Pro o Clinic activos, ni Básico ni un trial expirado alcanzan.
export function canUseWhatsApp(practice) {
  if (!isPlanActive(practice)) return false;
  const plan = practice?.plan;
  return plan === "pro" || plan === "clinic";
}

export function canUseMultiProfessional(practice) {
  return isPlanActive(practice) && practice?.plan === "clinic";
}

// Devuelve el cupo total disponible en el período actual (límite del plan + packs
// adicionales comprados), y cuánto se usó, para poder calcular el % de uso.
export function getWhatsAppQuota(practice) {
  const plan = practice?.plan;
  const base = PLAN_WHATSAPP_LIMIT[plan] || 0;
  const addon = practice?.whatsapp_addon_conversations || 0;
  const total = base + addon;
  const used = practice?.whatsapp_usage_count || 0;
  const ratio = total > 0 ? used / total : 1;
  return { base, addon, total, used, ratio, remaining: Math.max(0, total - used) };
}
