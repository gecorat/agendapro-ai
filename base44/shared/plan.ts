// Lógica de planes compartida entre funciones de backend. Es la contraparte de
// src/lib/plan-utils.js (que es la versión para el frontend) — mantener ambas en sync
// si cambian precios o límites.

export const PLAN_PRICES = {
  basic: 29000,
  pro: 49000,
  clinic: 69000,
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

// Tope de profesionales incluidos en plan Clinic (sin cobro automático por adicional
// todavía). Mantener en sync con src/lib/plan-utils.js.
export const CLINIC_MAX_PROFESSIONALS = 3;

// ── Ciclo de facturación ──────────────────────────────────────────────────────────
// El cupo de conversaciones se renueva en el ANIVERSARIO de la suscripción: quien se
// suscribió un día 15 renueva todos los 15, el mismo día en que Mercado Pago le cobra
// (las suscripciones se crean con frequency: 1 / months y sin billing_day, ver
// mercadopago.ts). Hasta 2026-09-03 el contador se reiniciaba el 1º de cada mes, lo que
// desalineaba cupo y cobro: el que se suscribía a mitad de mes recibía dos cupos
// completos dentro del mismo mes pagado.
//
// El ancla del ciclo es plan_cycle_anchor (fecha de alta de la suscripción en Mercado
// Pago, que es el día de cobro). Si falta — cuentas viejas, o planes asignados a mano por
// un admin — se cae al arranque del último período contado y, en última instancia, a la
// fecha de creación de la cuenta. Mantener en sync con src/lib/plan-utils.js.
function cycleAnchor(practice) {
  const raw = practice?.plan_cycle_anchor || practice?.whatsapp_usage_period_start || practice?.created_date;
  const d = raw ? new Date(raw) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

// Día `day` del mes (year, month), recortado al último día real de ese mes: un aniversario
// 31 cae el 28/29 en febrero y el 30 en abril. Conserva la hora del ancla.
function onDayOfMonth(year, month, day, ref) {
  const lastDay = new Date(year, month + 1, 0).getDate();
  const d = new Date(year, month, Math.min(day, lastDay));
  d.setHours(ref.getHours(), ref.getMinutes(), ref.getSeconds(), 0);
  return d;
}

// Inicio del ciclo vigente: la última vez que se cumplió el aniversario.
export function getCycleStart(practice, now = new Date()) {
  const anchor = cycleAnchor(practice);
  if (!anchor) return now;
  if (anchor >= now) return anchor; // recién suscripto: el ciclo arranca ahí
  const thisMonth = onDayOfMonth(now.getFullYear(), now.getMonth(), anchor.getDate(), anchor);
  if (thisMonth <= now) return thisMonth;
  return onDayOfMonth(now.getFullYear(), now.getMonth() - 1, anchor.getDate(), anchor);
}

// Cuándo se renueva el cupo: el próximo aniversario después del ciclo vigente.
export function getCycleEnd(practice, now = new Date()) {
  const start = getCycleStart(practice, now);
  const anchor = cycleAnchor(practice) || start;
  return onDayOfMonth(start.getFullYear(), start.getMonth() + 1, anchor.getDate(), anchor);
}

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

// Criterio ÚNICO para "¿puedo mandarle un WhatsApp a esta persona ahora mismo?": el plan
// tiene que habilitarlo Y el número tiene que estar efectivamente conectado. Antes cada
// flujo chequeaba una cosa distinta — los recordatorios miraban el plan, pero las
// confirmaciones solo miraban whatsapp_connected. La diferencia importa en un downgrade:
// al bajar de Pro a Basic el flag whatsapp_connected queda en true (nadie lo apaga al
// cambiar de plan), así que las confirmaciones seguían saliendo por WhatsApp aunque el
// plan ya no lo incluyera, mientras los recordatorios de esa misma cita sí lo bloqueaban.
export function canSendWhatsApp(practice) {
  return canUseWhatsApp(practice) && !!practice?.whatsapp_connected;
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
