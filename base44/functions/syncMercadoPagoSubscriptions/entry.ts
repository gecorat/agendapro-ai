import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncSubscriptionStatus } from '../../shared/mercadopago.ts';
import { recordPayment, normalizeMpStatus } from '../../shared/payments.ts';

// Rescata los cobros de una suscripción que el webhook no haya registrado. Misma lógica
// que la del plan: ya se confirmó en vivo que Mercado Pago puede no mandar el aviso, y un
// cobro no registrado es facturación que después no se puede reconstruir. recordPayment es
// idempotente, así que volver a ver un cobro ya guardado no lo duplica.
async function syncPaymentsOf(base44, accessToken, practice) {
  const res = await fetch(
    `https://api.mercadopago.com/authorized_payments/search?preapproval_id=${practice.mercadopago_subscription_id}`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) return 0;
  const data = await res.json();
  const results = data?.results || [];

  let recorded = 0;
  for (const ap of results) {
    const rawStatus = ap.payment?.status || ap.status;
    const out = await recordPayment(base44, {
      provider: 'mercadopago',
      provider_payment_id: String(ap.payment?.id || ap.id),
      subscription_id: practice.mercadopago_subscription_id,
      practice_id: practice.id,
      practice_name: practice.practice_name,
      kind: 'subscription',
      plan: practice.plan,
      amount: ap.transaction_amount,
      currency: ap.currency_id || 'ARS',
      status: normalizeMpStatus(rawStatus),
      provider_status_raw: String(rawStatus || ''),
      paid_at: ap.date_created || ap.debit_date,
      description: 'Cuota mensual de la suscripción',
    });
    if (out.created || out.updated) recorded++;
  }
  return recorded;
}

// Red de seguridad: corre cada hora y revisa TODAS las suscripciones activas contra el
// estado real de Mercado Pago, sin depender de que el webhook haya avisado. Confirmado en
// vivo que el webhook de MP puede simplemente no llegar (un pago se acreditó y nunca
// mandó la notificación) — sin esto, un profesional podía pagar y quedar sin el plan
// actualizado indefinidamente, sin que nadie se entere.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) return Response.json({ ok: true, skipped: 'not_configured' });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const withSubscription = (practices || []).filter((p) => p.mercadopago_subscription_id);

    let checked = 0;
    let changed = 0;
    let paymentsRecorded = 0;
    const errors: any[] = [];

    for (const practice of withSubscription) {
      checked++;
      try {
        const result = await syncSubscriptionStatus(base44, accessToken, practice.mercadopago_subscription_id);
        if (result.changed) changed++;
      } catch (e) {
        errors.push({ practice_id: practice.id, error: e?.message || String(e) });
      }
      // En su propio try: que fallar rescatando cobros NUNCA impida sincronizar el plan
      // de las cuentas siguientes (el plan es lo que le da o le saca servicio a la gente).
      try {
        paymentsRecorded += await syncPaymentsOf(base44, accessToken, practice);
      } catch (e) {
        errors.push({ practice_id: practice.id, stage: 'payments', error: e?.message || String(e) });
      }
    }

    return Response.json({ ok: true, checked, changed, paymentsRecorded, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
