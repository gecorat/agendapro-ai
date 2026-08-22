import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncSubscriptionStatus } from '../../shared/mercadopago.ts';

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
    const errors: any[] = [];

    for (const practice of withSubscription) {
      checked++;
      try {
        const result = await syncSubscriptionStatus(base44, accessToken, practice.mercadopago_subscription_id);
        if (result.changed) changed++;
      } catch (e) {
        errors.push({ practice_id: practice.id, error: e?.message || String(e) });
      }
    }

    return Response.json({ ok: true, checked, changed, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
