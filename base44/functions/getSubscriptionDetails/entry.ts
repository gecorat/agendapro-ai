import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findPracticeByOwner } from "../../shared/ownership.ts";

// Trae el estado REAL de la suscripción directo de Mercado Pago (próximo cobro, monto,
// estado) para mostrarlo en /upgrade-plan — nunca confiamos en datos guardados que
// puedan estar desactualizados.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Por el criterio de propiedad real (owner_user_id con respaldo a created_by_id):
    // comparar created_by_id a secas dejaba a toda cuenta creada por el onboarding sin
    // encontrar su propio consultorio. Ver base44/shared/ownership.ts.
    const practice = await findPracticeByOwner(base44, user.id);
    if (!practice?.mercadopago_subscription_id) {
      return Response.json({ subscription: null });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) return Response.json({ subscription: null });

    const res = await fetch(`https://api.mercadopago.com/preapproval/${practice.mercadopago_subscription_id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return Response.json({ subscription: null });
    const data = await res.json();

    return Response.json({
      subscription: {
        status: data.status,
        amount: data.auto_recurring?.transaction_amount,
        next_payment_date: data.next_payment_date,
        last_charged_amount: data.summarized?.last_charged_amount,
        last_charged_date: data.summarized?.last_charged_date,
        // Extras para la tarjeta "Tu plan": desde cuándo está activa la suscripción,
        // cada cuánto se cobra y cuántos cobros lleva.
        created_at: data.date_created,
        frequency: data.auto_recurring?.frequency,
        frequency_type: data.auto_recurring?.frequency_type,
        charged_quantity: data.summarized?.charged_quantity,
      },
    });
  } catch (error) {
    return Response.json({ subscription: null, error: error.message }, { status: 200 });
  }
}
