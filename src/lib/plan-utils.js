export const TRIAL_DAYS = 14;

// Mantener en sync con base44/shared/plan.ts (versión backend de esta misma lógica).
export const PLAN_PRICES = {
  basic: "$29.000",
  pro: "$49.000",
  clinic: "$69.000",
};

// Flag para ocultar el plan Premium (clinic) de TODA la UI: landing, centro de planes,
// pestaña Plan de Configuración, pestaña Equipo, panel de admin y CTAs sueltos. El
// backend sigue intacto (createMpPreference, canUseMultiProfessional, etc.); esto es
// solo visibilidad. Poner en true para volver a mostrarlo en todos lados.
//
// Se oculta para TODOS, sin excepción: las cuentas que estaban en clinic se migraron a
// pro (2026-09-03), así que no queda nadie que necesite verlo.
export const CLINIC_PLAN_VISIBLE = false;

// Se mantiene la firma con `plan` para no tocar los llamadores, pero hoy el plan Premium
// no se muestra a nadie, tenga el plan que tenga.
export function showClinicPlan(_plan) {
  return CLINIC_PLAN_VISIBLE;
}

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

// Resumen corto de lo que incluye cada plan, para mostrarlo en la tarjeta "Tu plan"
// (las listas largas de la comparativa viven en UpgradePlan.jsx).
export const PLAN_INCLUDES = {
  trial: [
    "Página pública de reservas",
    "Agenda, pacientes y recordatorios por email",
    "Simulador del bot (sin WhatsApp real)",
  ],
  basic: [
    "Página pública de reservas",
    "Agenda manual + calendario",
    "Gestión de pacientes",
    "Confirmaciones y recordatorios por email",
  ],
  pro: [
    "Todo lo del plan Básico",
    "Bot de WhatsApp con IA 24/7",
    "Recordatorios automáticos por WhatsApp",
    "Hasta 300 conversaciones mensuales",
  ],
  clinic: [
    "Todo lo del plan Pro",
    "Hasta 3 profesionales con agendas propias",
    "WhatsApp centralizado que reparte turnos",
    "Hasta 1.000 conversaciones mensuales",
  ],
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

// Ciclo de facturación. Espejo EXACTO de getCycleStart/getCycleEnd en
// base44/shared/plan.ts — mantener ambos en sync. El cupo se renueva en el aniversario
// de la suscripción (mismo día en que cobra Mercado Pago), no el 1º de cada mes.
export function getCycleAnchor(settings) {
  const raw = settings?.plan_cycle_anchor || settings?.whatsapp_usage_period_start || settings?.created_date;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

// Día `day` del mes indicado, recortado al último día real de ese mes (un aniversario 31
// cae el 28/29 en febrero y el 30 en abril).
// Todo el ciclo de facturacion se razona en HORA ARGENTINA (ver src/lib/timezone.js), que
// es la del negocio y la que usa el espejo del backend en base44/shared/plan.ts. Con los
// getters del navegador, la fecha de renovacion se mostraba corrida un dia para cualquiera
// que abriera la app desde otro huso.
function onDayOfMonth(year, month, day, ref) {
  const lastDay = argentinaDayOfMonth(argentinaEndOfMonth(argentinaDate(year, month, 1)));
  const r = argentinaParts(ref);
  return argentinaDate(year, month, Math.min(day, lastDay), r.hour, r.minute, r.second);
}

export function getCycleStart(settings, now = new Date()) {
  const anchor = getCycleAnchor(settings);
  if (!anchor) return now;
  if (anchor >= now) return anchor;
  const thisMonth = onDayOfMonth(argentinaYear(now), argentinaMonth(now), argentinaDayOfMonth(anchor), anchor);
  if (thisMonth <= now) return thisMonth;
  return onDayOfMonth(argentinaYear(now), argentinaMonth(now) - 1, argentinaDayOfMonth(anchor), anchor);
}

export function getCycleEnd(settings, now = new Date()) {
  const start = getCycleStart(settings, now);
  const anchor = getCycleAnchor(settings) || start;
  return onDayOfMonth(argentinaYear(start), argentinaMonth(start) + 1, argentinaDayOfMonth(anchor), anchor);
}

// Período de uso vigente, listo para mostrar: desde cuándo corre, cuándo se renueva el
// cupo y cuántos días faltan para eso.
export function getUsagePeriod(settings) {
  const now = new Date();
  const start = getCycleStart(settings, now);
  const resetsAt = getCycleEnd(settings, now);
  const daysToReset = Math.max(0, Math.ceil((resetsAt - now) / (1000 * 60 * 60 * 24)));
  return { start, resetsAt, daysToReset };
}

// Fecha corta en formato es-AR (ej. "3 de septiembre"). Devuelve "—" si no hay fecha.
export function formatDate(value, opts = { day: "numeric", month: "long" }) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return formatArDate(d, opts);
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
