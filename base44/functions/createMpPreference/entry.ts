import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { PLAN_PRICES, PLAN_LABELS } from '../../shared/plan.ts';

// Crea una SUSCRIPCIÓN recurrente (Preapproval de Mercado Pago), no un cobro único: MP
// cobra automáticamente cada mes y avisa por webhook (ver mercadopagoWebhook) si el pago
// falla, se pausa o se cancela.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const plan = body?.plan;
    const origin = body?.origin || 'https://agendate.base44.app';
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

    const preapprovalBody = {
      reason: `Kame Agenda — Plan ${PLAN_LABELS[plan]}`,
      auto_recurring: {
        frequency: 1,
        frequency_type: 'months',
        transaction_amount: PLAN_PRICES[plan],
        currency_id: 'ARS',
      },
      back_url: `${origin}/upgrade-plan?status=success`,
      payer_email: user.email,
      // Mandamos la URL de notificaciones explícita en vez de depender de que quede
      // configurada aparte en el panel de Mercado Pago — así el webhook funciona apenas
      // se carga el Access Token, sin pasos manuales extra.
      notification_url: 'https://base44.app/api/apps/6a726ce53f9d0f63f3816283/functions/mercadopagoWebhook',
      // Guardamos acá el plan y el id del consultorio para poder identificar todo esto
      // cuando llegue la notificación del webhook (no confiamos solo en el id guardado
      // en nuestra base, por si el usuario reintenta el pago y genera otra suscripción).
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
