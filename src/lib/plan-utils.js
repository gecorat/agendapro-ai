export const TRIAL_DAYS = 14;

// Mantener en sync con base44/shared/plan.ts (versión backend de esta misma lógica).
export const PLAN_PRICES = {
  basic: "$29.000",
  pro: "$49.000",
  clinic: "$69.000",
};

export const PLAN_LABELS = {
  trial: "Prueba",
  basic: "Básico",
  pro: "Pro",
  clinic: "Premium",
};

// Cupo de conversaciones/turnos procesados por el bot de WhatsApp, por período de
// facturación. "basic" no tiene bot de WhatsApp, por eso no aparece acá.
export const PLAN_WHATSAPP_LIMIT = {
  pro: 300,
  clinic: 1000,
};

export const ADDON_PACKS = {
  pack_100: { conversations: 100, price: 15000, label: "+100 conversaciones" },
  pack_250: { conversations: 250, price: 30000, label: "+250 conversaciones" },
};

// Tope de profesionales incluidos en plan Clinic. Más allá de este número se cobra un
// addon fijo mensual (ver PROFESSIONAL_ADDON_PRICE en base44/shared/professional-billing.ts)
// que se aplica automáticamente al monto real de la suscripción en Mercado Pago.
export const CLINIC_MAX_PROFESSIONALS = 3;

export function getPlanStatus(settings) {
  if (!settings) {
    return { plan: null, isTrial: false, trialExpired: false, hasPaidPlan: false, daysLeft: 0, canUseWhatsApp: false, canUseMultiProfessional: false, active: false, loaded: false };
  }
  const plan = settings.plan || "trial";
  const isTrial = plan === "trial";
  const hasPaidPlan = plan === "basic" || plan === "pro" || plan === "clinic";
  let trialExpired = false;
  let daysLeft = 0;
  if (isTrial && settings.trial_ends_at) {
    const end = new Date(settings.trial_ends_at);
    const now = new Date();
    trialExpired = end < now;
    daysLeft = Math.max(0, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }
  const suspended = settings.suspended === true;
  const active = (!isTrial || !trialExpired) && !suspended;
  const canUseWhatsApp = (plan === "pro" || plan === "clinic") && active;
  const canUseMultiProfessional = plan === "clinic" && active;
  return { plan, isTrial, trialExpired, hasPaidPlan, daysLeft, canUseWhatsApp, canUseMultiProfessional, active, suspended, loaded: true };
}

// Cupo total (límite del plan + packs adicionales comprados) y cuánto se usó en el
// período actual. Se usa tanto para el medidor visual como para saber si mostrar el
// aviso de "te queda poco cupo".
export function getWhatsAppUsage(settings) {
  const plan = settings?.plan;
  const base = PLAN_WHATSAPP_LIMIT[plan] || 0;
  const addon = settings?.whatsapp_addon_conversations || 0;
  const total = base + addon;
  const used = settings?.whatsapp_usage_count || 0;
  const ratio = total > 0 ? used / total : 0;
  return { base, addon, total, used, ratio, remaining: Math.max(0, total - used) };
}
