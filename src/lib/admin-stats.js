import {
  argentinaDate, argentinaStartOfWeek, argentinaStartOfMonth, argentinaYear,
  argentinaMonth, addArgentinaDays, formatArDate,
} from "@/lib/timezone";

// Agregados del panel de admin (planes, trials y facturación). Se mantienen como
// funciones puras, separadas del componente, para poder probarlas sin renderizar nada.
import { PLAN_PRICES, getCycleEnd, getCycleAnchor } from "@/lib/plan-utils";
import { ownerIdOf } from "@/lib/ownership";

export const PLAN_ORDER = ["trial", "basic", "pro", "clinic"];

// Separa los consultorios REALES de las fichas huérfanas: filas cuyo usuario dueño ya no
// existe (se borró la cuenta y quedó el consultorio). Contarlas infla los totales y los
// trials con gente que no está — pero tampoco se ocultan: se devuelven aparte para poder
// avisar y limpiarlas.
export function splitOrphanPractices(practices, users) {
  const validIds = new Set((users || []).map((u) => u?.id).filter(Boolean));
  // Sin lista de usuarios (por ejemplo si esa consulta falló) no se descarta nada: es
  // preferible un total de más antes que esconder cuentas reales por un error de red.
  if (validIds.size === 0) return { real: practices || [], orphans: [] };

  const real = [];
  const orphans = [];
  for (const p of practices || []) {
    (validIds.has(ownerIdOf(p)) ? real : orphans).push(p);
  }
  return { real, orphans };
}

// Colores de los planes. En hex porque recharts necesita un color real, no una clase de
// Tailwind (mismo criterio que Analytics.jsx). Validados como paleta categórica: la
// separación entre pares adyacentes está por encima del piso para daltonismo, y como el
// contraste contra el fondo claro queda por debajo de 3:1, SIEMPRE se acompañan de la
// etiqueta con el número al lado — nunca el color solo.
export const PLAN_COLORS = {
  trial: "#f59e0b",  // amber-500
  basic: "#0ea5e9",  // sky-500
  pro: "#10b981",    // emerald-500
  clinic: "#8b5cf6", // violet-500
};

// Los precios viven como texto ("$49.000") para mostrarlos; acá hace falta el número.
function priceOf(plan) {
  const raw = PLAN_PRICES[plan];
  if (!raw) return 0;
  return Number(String(raw).replace(/[^\d]/g, "")) || 0;
}

const DAY = 24 * 60 * 60 * 1000;

// Lunes como primer día de la semana (convención local, no la de EE.UU.).
// Los periodos son ARGENTINOS (ver src/lib/timezone.js): la facturacion de una semana
// tiene que dar lo mismo abra quien abra el panel, desde donde lo abra.
export function startOfWeek(d) { return argentinaStartOfWeek(d, { mondayStart: true }); }
export function startOfMonth(d) { return argentinaStartOfMonth(d); }
export function startOfYear(d) { return argentinaDate(argentinaYear(d), 0, 1); }

// Estado de la cartera de cuentas. `suspended` y el vencimiento del trial se miran acá
// igual que en getPlanStatus, para que el panel no cuente como activa una cuenta que la
// app ya está bloqueando.
//
// OJO con el MRR y las "pagas activas": NO cuentan las cuentas con plan asignado a mano
// por un admin (plan_granted_by_admin). Esas no tienen medio de pago adherido ni
// suscripción detrás — son cortesías — y sumarlas daría un ingreso que no existe. Se
// devuelven aparte en `adminGranted` para poder mostrarlas sin mezclarlas con la plata.
export function summarizePlans(practices, now = new Date()) {
  const byPlan = { trial: 0, basic: 0, pro: 0, clinic: 0 };
  let suspended = 0;
  let trialsActive = 0;
  let trialsExpiring = 0; // vencen dentro de 3 días
  let trialsExpired = 0;
  let activePaid = 0;
  let adminGranted = 0;
  let mrr = 0;

  for (const p of practices || []) {
    const plan = p?.plan || "trial";
    if (byPlan[plan] === undefined) byPlan[plan] = 0;
    byPlan[plan]++;

    const isSuspended = p?.suspended === true;
    if (isSuspended) suspended++;

    if (plan === "trial") {
      const ends = p?.trial_ends_at ? new Date(p.trial_ends_at) : null;
      if (ends && ends < now) {
        trialsExpired++;
      } else {
        trialsActive++;
        if (ends && ends - now <= 3 * DAY) trialsExpiring++;
      }
    } else if (p?.plan_granted_by_admin === true) {
      adminGranted++;
    } else if (!isSuspended) {
      activePaid++;
      mrr += priceOf(plan);
    }
  }

  return {
    total: (practices || []).length,
    byPlan,
    suspended,
    trialsActive,
    trialsExpiring,
    trialsExpired,
    activePaid,
    adminGranted,
    mrr,
  };
}

// ¿Esta cuenta genera un cobro real? Tienen que darse las tres condiciones:
//  - plan pago (un trial no se cobra),
//  - no suspendida,
//  - no asignada a mano por un admin (esas no tienen suscripción de Mercado Pago detrás,
//    así que contarlas inflaría lo esperado con plata que nunca va a entrar).
export function isBillable(p) {
  const plan = p?.plan;
  if (plan !== "basic" && plan !== "pro" && plan !== "clinic") return false;
  if (p?.suspended === true) return false;
  if (p?.plan_granted_by_admin === true) return false;
  return true;
}

// Detalle por plan: cuántas cuentas lo tienen y cuánto factura por mes. Separa el total de
// cuentas (que incluye suspendidas y regaladas) de las que efectivamente facturan, para
// que el detalle no prometa plata que no entra.
export function planRevenue(practices) {
  const out = {};
  const ensure = (plan) => {
    if (!out[plan]) out[plan] = { accounts: 0, billable: 0, monthly: 0, price: priceOf(plan) };
    return out[plan];
  };
  for (const plan of PLAN_ORDER) ensure(plan);

  for (const p of practices || []) {
    const row = ensure(p?.plan || "trial");
    row.accounts++;
    if (isBillable(p)) {
      row.billable++;
      row.monthly += priceOf(p.plan);
    }
  }
  return out;
}

// Cobros que todavía faltan en el mes en curso. La fecha sale de getCycleEnd (el próximo
// aniversario de la suscripción), que es exactamente el día en que cobra Mercado Pago.
//
// Si la cuenta todavía no tiene plan_cycle_anchor, getCycleEnd cae en su fallback y la
// fecha es una ESTIMACIÓN: se marca como tal (`estimated`) en vez de mostrarla como si
// fuera certera. El sync horario completa el ancla sola, así que se corrige con el tiempo.
export function upcomingCharges(practices, now = new Date()) {
  const monthEnd = argentinaDate(argentinaYear(now), argentinaMonth(now) + 1, 1);
  const rows = [];
  const byPlan = {};
  let total = 0;
  let estimatedCount = 0;

  for (const p of practices || []) {
    if (!isBillable(p)) continue;
    // Caso borde: si el ancla todavía no llegó (recién suscripto, el primer cobro está
    // agendado), el próximo cobro ES el ancla — no el aniversario siguiente. Sin esto ese
    // primer cobro se saltaba y quedaba fuera de lo esperado del mes.
    const anchor = getCycleAnchor(p);
    const next = anchor && anchor > now ? anchor : getCycleEnd(p, now);
    if (!(next < monthEnd)) continue; // el próximo cobro cae recién el mes que viene

    const amount = priceOf(p.plan);
    const estimated = !p?.plan_cycle_anchor;
    if (estimated) estimatedCount++;

    rows.push({
      id: p.id,
      practice_name: p.practice_name || "Sin nombre",
      plan: p.plan,
      amount,
      date: next,
      estimated,
    });
    total += amount;
    if (!byPlan[p.plan]) byPlan[p.plan] = { count: 0, amount: 0 };
    byPlan[p.plan].count++;
    byPlan[p.plan].amount += amount;
  }

  rows.sort((a, b) => a.date - b.date);
  return { rows, total, count: rows.length, byPlan, estimatedCount };
}

// Solo los cobros efectivamente acreditados entran en la facturación: un pago pendiente o
// rechazado no es plata que entró.
function approved(payments) {
  return (payments || []).filter((p) => p?.status === "approved");
}

function bucketStart(date, granularity) {
  if (granularity === "week") return startOfWeek(date);
  if (granularity === "year") return startOfYear(date);
  return startOfMonth(date);
}

function shiftBucket(date, granularity, steps) {
  if (granularity === "week") return addArgentinaDays(date, steps * 7);
  if (granularity === "year") return argentinaDate(argentinaYear(date) + steps, 0, 1);
  return argentinaDate(argentinaYear(date), argentinaMonth(date) + steps, 1);
}

function bucketLabel(date, granularity) {
  if (granularity === "week") return formatArDate(date, { day: "numeric", month: "short" });
  if (granularity === "year") return String(argentinaYear(date));
  return formatArDate(date, { month: "short", year: "2-digit" });
}

// Serie temporal lista para graficar. Devuelve SIEMPRE los `count` períodos completos
// (con 0 donde no hubo cobros), así el gráfico no miente sobre los huecos ni cambia de
// ancho según los datos.
export function bucketRevenue(payments, granularity = "month", now = new Date(), count = 12) {
  const buckets = [];
  const current = bucketStart(now, granularity);
  for (let i = count - 1; i >= 0; i--) {
    const start = shiftBucket(current, granularity, -i);
    buckets.push({ start, key: start.toISOString(), label: bucketLabel(start, granularity), total: 0, count: 0 });
  }
  const first = buckets[0].start;

  for (const p of approved(payments)) {
    const when = p?.paid_at ? new Date(p.paid_at) : null;
    if (!when || Number.isNaN(when.getTime()) || when < first) continue;
    const start = bucketStart(when, granularity);
    const hit = buckets.find((b) => b.start.getTime() === start.getTime());
    if (!hit) continue;
    hit.total += Number(p.amount) || 0;
    hit.count += 1;
  }
  return buckets;
}

// Totales del período EN CURSO (esta semana, este mes, este año), que es lo que se lee
// como titular arriba del gráfico.
export function revenueTotals(payments, now = new Date()) {
  const rows = approved(payments);
  const sumSince = (from) => rows.reduce((acc, p) => {
    const when = p?.paid_at ? new Date(p.paid_at) : null;
    if (!when || Number.isNaN(when.getTime()) || when < from) return acc;
    return acc + (Number(p.amount) || 0);
  }, 0);

  return {
    week: sumSince(startOfWeek(now)),
    month: sumSince(startOfMonth(now)),
    year: sumSince(startOfYear(now)),
    all: rows.reduce((acc, p) => acc + (Number(p.amount) || 0), 0),
  };
}

export function formatARS(n) {
  return `$${Math.round(Number(n) || 0).toLocaleString("es-AR")}`;
}
