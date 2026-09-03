// Agregados del panel de admin (planes, trials y facturación). Se mantienen como
// funciones puras, separadas del componente, para poder probarlas sin renderizar nada.
import { PLAN_PRICES } from "@/lib/plan-utils";

export const PLAN_ORDER = ["trial", "basic", "pro", "clinic"];

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
export function startOfWeek(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = (x.getDay() + 6) % 7; // 0 = lunes
  x.setDate(x.getDate() - dow);
  return x;
}
export function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
export function startOfYear(d) { return new Date(d.getFullYear(), 0, 1); }

// Estado de la cartera de cuentas. `suspended` y el vencimiento del trial se miran acá
// igual que en getPlanStatus, para que el panel no cuente como activa una cuenta que la
// app ya está bloqueando.
export function summarizePlans(practices, now = new Date()) {
  const byPlan = { trial: 0, basic: 0, pro: 0, clinic: 0 };
  let suspended = 0;
  let trialsActive = 0;
  let trialsExpiring = 0; // vencen dentro de 3 días
  let trialsExpired = 0;
  let activePaid = 0;
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
    mrr,
  };
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
  if (granularity === "week") return new Date(date.getFullYear(), date.getMonth(), date.getDate() + steps * 7);
  if (granularity === "year") return new Date(date.getFullYear() + steps, 0, 1);
  return new Date(date.getFullYear(), date.getMonth() + steps, 1);
}

function bucketLabel(date, granularity) {
  if (granularity === "week") return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
  if (granularity === "year") return String(date.getFullYear());
  return date.toLocaleDateString("es-AR", { month: "short", year: "2-digit" });
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
