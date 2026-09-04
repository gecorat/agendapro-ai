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

// Emails con los que esta cuenta pudo haber pagado en Mercado Pago: el de contacto del
// consultorio y el de la cuenta con la que inicia sesion.
async function emailsOf(base44, practice) {
  const out = [];
  const contact = String(practice.professional_email || '').trim();
  if (contact) out.push(contact);
  const ownerId = practice.owner_user_id || practice.created_by_id;
  if (ownerId && !String(ownerId).startsWith('service_')) {
    try {
      const rows = await base44.asServiceRole.entities.User.filter({ id: ownerId });
      const email = String(rows?.[0]?.email || '').trim();
      if (email && !out.includes(email)) out.push(email);
    } catch { /* sin email de cuenta, seguimos con el de contacto */ }
  }
  return out;
}

// SUSCRIPCIONES PAGADAS QUE NUNCA SE VINCULARON. El checkout con plan asociado se ata a
// la cuenta recién cuando el usuario VUELVE a /upgrade-plan (linkMpSubscription). Si
// cerraba la pestana en Mercado Pago despues de pagar, la suscripcion existia alla y acá
// no la conocia nadie: sin mercadopago_subscription_id, ni el webhook ni este mismo
// chequeo la miraban, y el profesional pagaba sin recibir el plan.
//
// Para cada cuenta con un intento pendiente, le preguntamos a Mercado Pago si hay una
// suscripcion autorizada a nombre de sus emails. Si la hay, la sincronizamos: el propio
// syncSubscriptionStatus se encarga de vincularla (rescate por email) y activar el plan.
async function rescuePendingSubscriptions(base44, accessToken, practices) {
  const pending = (practices || []).filter((p) => p.mercadopago_pending_plan && !p.mercadopago_subscription_id);
  let rescued = 0;
  for (const practice of pending) {
    for (const email of await emailsOf(base44, practice)) {
      try {
        const res = await fetch(
          `https://api.mercadopago.com/preapproval/search?payer_email=${encodeURIComponent(email)}&status=authorized`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (!res.ok) continue;
        const data = await res.json();
        const found = (data?.results || [])[0];
        if (!found?.id) continue;
        const result = await syncSubscriptionStatus(base44, accessToken, found.id);
        if (result.synced) { rescued++; break; }
      } catch (e) {
        console.error('rescuePendingSubscriptions error:', practice.id, e?.message || e);
      }
    }
  }
  return rescued;
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

    // Primero rescatamos las que pagaron y quedaron sin vincular: si alguna se vincula
    // ahora, entra en el barrido normal en la proxima corrida.
    let rescued = 0;
    try {
      rescued = await rescuePendingSubscriptions(base44, accessToken, practices);
    } catch (e) {
      errors.push({ stage: 'rescue', error: e?.message || String(e) });
    }

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

    return Response.json({ ok: true, checked, changed, rescued, paymentsRecorded, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
