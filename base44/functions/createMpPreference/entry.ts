import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PLAN_PRICES, PLAN_LABELS } from '../../shared/plan.ts';
import { getOrCreateMpPlanLinks } from '../../shared/mercadopago.ts';

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
    const origin = body?.origin || 'https://kameagenda.com';
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

    // Suscripción nueva con plan asociado: NO llamamos a POST /preapproval nosotros (eso
    // exigiría mandar payer_email, que es lo que queríamos sacar del flujo). En cambio,
    // mandamos al usuario directo al checkout público del plan — ahí Mercado Pago le pide
    // que inicie sesión con su propia cuenta, sin que nosotros le preguntemos nada antes.
    // Guardamos qué plan está intentando suscribir para poder vincular el preapproval_id
    // real apenas vuelva (ver función linkMpSubscription).
    const planLinks = await getOrCreateMpPlanLinks(base44, accessToken, origin);
    const planLink = planLinks[plan];
    if (!planLink?.init_point) {
      return Response.json({ error: 'No se pudo generar el link de pago para este plan' }, { status: 502 });
    }

    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      mercadopago_pending_plan: plan,
    });

    return Response.json({ init_point: planLink.init_point });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
