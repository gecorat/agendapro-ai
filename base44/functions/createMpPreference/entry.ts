import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

const PLAN_PRICES = { pro: 119000, premium: 169000 };
const PLAN_LABELS = { pro: 'Pro', premium: 'Premium' };

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const plan = body?.plan;
    const origin = body?.origin || 'https://app.agendapro.com';
    if (!plan || !PLAN_PRICES[plan]) {
      return Response.json({ error: 'Plan inválido' }, { status: 400 });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) {
      return Response.json({ error: 'Mercado Pago no está configurado. Contactá al administrador.' }, { status: 400 });
    }

    const preference = {
      items: [{
        title: `Plan ${PLAN_LABELS[plan]} AgendaPro — Suscripción mensual`,
        quantity: 1,
        unit_price: PLAN_PRICES[plan],
        currency_id: 'ARS'
      }],
      back_urls: {
        success: `${origin}/upgrade-plan?status=success`,
        failure: `${origin}/upgrade-plan?status=failure`,
        pending: `${origin}/upgrade-plan?status=pending`
      },
      auto_return: 'approved',
      metadata: { user_id: user.id, plan }
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference)
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.message || 'Error al crear la preferencia de pago' }, { status: 400 });
    }
    return Response.json({ init_point: data.init_point, preference_id: data.id });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}