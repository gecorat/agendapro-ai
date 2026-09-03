// Registro de cobros. Hasta 2026-09-03 la app NO guardaba ningún pago: el webhook de
// Mercado Pago solo actualizaba el plan y el flag de suspendido, así que la facturación
// histórica era imposible de reconstruir. Acá se centraliza el alta de Payment para que
// todos los caminos (webhook de suscripción, webhook de pack adicional, y en el futuro
// dLocal) escriban igual.

// Mercado Pago tiene bastantes más estados que los que le importan al panel. Todo lo que
// no reconocemos cae en "other" y queda fuera de la facturación, que solo suma "approved".
const MP_STATUS_MAP: Record<string, string> = {
  approved: "approved",
  authorized: "approved",
  accredited: "approved",
  pending: "pending",
  in_process: "pending",
  in_mediation: "pending",
  rejected: "rejected",
  cancelled: "rejected",
  refunded: "refunded",
  charged_back: "charged_back",
};

export function normalizeMpStatus(raw) {
  return MP_STATUS_MAP[String(raw || "").toLowerCase()] || "other";
}

// Alta idempotente. El webhook de Mercado Pago puede notificar varias veces el mismo
// cobro (y para una suscripción llegan DOS avisos por el mismo dinero: el de
// subscription_authorized_payment y el de payment). Sin esta guarda, la facturación
// contaría el mismo peso dos o tres veces.
//
// Si el registro ya existe pero cambió de estado (pending -> approved, approved ->
// refunded), se ACTUALIZA en vez de duplicar.
export async function recordPayment(base44, data) {
  const providerPaymentId = String(data.provider_payment_id || "");
  if (!providerPaymentId) return { ok: false, reason: "missing_provider_payment_id" };

  const existing = await base44.asServiceRole.entities.Payment.filter({
    provider_payment_id: providerPaymentId,
  });
  const found = existing?.[0];

  if (found) {
    const changed = found.status !== data.status || Number(found.amount) !== Number(data.amount);
    if (!changed) return { ok: true, created: false, updated: false, id: found.id };
    await base44.asServiceRole.entities.Payment.update(found.id, {
      status: data.status,
      provider_status_raw: data.provider_status_raw,
      amount: data.amount,
      paid_at: data.paid_at,
    });
    return { ok: true, created: false, updated: true, id: found.id };
  }

  const created = await base44.asServiceRole.entities.Payment.create({
    provider: data.provider || "mercadopago",
    provider_payment_id: providerPaymentId,
    subscription_id: data.subscription_id || null,
    practice_id: data.practice_id || null,
    practice_name: data.practice_name || null,
    kind: data.kind || "subscription",
    plan: data.plan || null,
    amount: Number(data.amount) || 0,
    currency: data.currency || "ARS",
    status: data.status || "pending",
    provider_status_raw: data.provider_status_raw || null,
    paid_at: data.paid_at || new Date().toISOString(),
    description: data.description || null,
  });
  return { ok: true, created: true, updated: false, id: created?.id };
}

// Busca a qué consultorio pertenece una suscripción del proveedor. Devuelve null si no
// hay match (por ejemplo, una suscripción de prueba que quedó colgada sin cuenta).
export async function findPracticeBySubscription(base44, subscriptionId) {
  if (!subscriptionId) return null;
  const rows = await base44.asServiceRole.entities.PracticeSettings.filter({
    mercadopago_subscription_id: subscriptionId,
  });
  return rows?.[0] || null;
}
