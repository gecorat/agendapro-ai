import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PLAN_PRICES, PLAN_LABELS } from '../../shared/plan.ts';

// Antes, CADA cambio de plan (incluso pasar de Pro a Clinic) creaba una suscripción
// NUEVA en Mercado Pago y pisaba el mercadopago_subscription_id guardado — la
// suscripción VIEJA quedaba huérfana, nadie la cancelaba, y seguía cobrando para
// siempre en paralelo. Ahora: si ya hay una suscripción activa (authorized), en vez de
// crear una nueva, actualizamos el MONTO de la misma al toque — sin checkout, sin que
// el profesional tenga que volver a autorizar nada, porque el medio de pago ya está
// cargado de antes. Solo se crea una suscripción nueva de cero cuando no hay ninguna
// activa (primera vez, o una que ya estaba cancelada).
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const plan = body?.plan;
    const origin = body?.origin || 'https://agendate.base44.app';
    const payerEmail = body?.payer_email || user.email;
    if (!plan || !PLAN_PRICES[plan]) {
      return Response.json({ error: 'Plan inválido' }, { status: 400 });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) {
      return Response.json({ error: 'Mercado Pago no está configurado. Contactá al administrador.' }, { status: 400 });
    }

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user.id });
    const practice = practices?.[0];
    if (!practice) return Response.json({ error: 'No hay configuración de consultorio' }, { status: 400 });

    // ¿Ya tiene una suscripción activa de verdad? Si es así, actualizamos en vez de crear.
    if (practice.mercadopago_subscription_id) {
      const checkRes = await fetch(`https://api.mercadopago.com/preapproval/${practice.mercadopago_subscription_id}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (checkRes.ok) {
        const existing = await checkRes.json();
        if (existing.status === 'authorized') {
          const updateRes = await fetch(`https://api.mercadopago.com/preapproval/${practice.mercadopago_subscription_id}`, {
            method: 'PUT',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: `Kame Agenda — Plan ${PLAN_LABELS[plan]}`,
              auto_recurring: { transaction_amount: PLAN_PRICES[plan], currency_id: 'ARS' },
            }),
          });
          if (!updateRes.ok) {
            const errText = await updateRes.text();
            return Response.json({ error: `Mercado Pago rechazó el cambio: ${errText}` }, { status: 502 });
          }
          await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
            plan,
            suspended: false,
            plan_granted_by_admin: false,
          });
          return Response.json({ applied_immediately: true, plan });
        }
      }
      // si no está authorized (cancelada, pausada, etc.), seguimos abajo y creamos una nueva
    }

    const preapprovalBody = {
      reason: `Kame Agenda — Plan ${PLAN_LABELS[plan]}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: PLAN_PRICES[plan],
        currency_id: 'ARS',
      },
      back_url: `${origin}/upgrade-plan?status=success`,
      payer_email: payerEmail,
      notification_url: 'https://base44.app/api/apps/6a726ce53f9d0f63f3816283/functions/mercadopagoWebhook',
      external_reference: JSON.stringify({ practice_id: practice.id, plan }),
    };

    const res = await fetch('https://api.mercadopago.com/preapproval', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preapprovalBody),
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.message || 'Error al crear la suscripción' }, { status: 400 });
    }

    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      mercadopago_subscription_id: data.id,
    });

    return Response.json({ init_point: data.init_point });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
