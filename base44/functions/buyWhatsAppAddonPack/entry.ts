import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { ADDON_PACKS } from '../../shared/plan.ts';

// A diferencia del plan (suscripción recurrente), un pack adicional es un cobro ÚNICO:
// usamos Checkout Preferences (no Preapproval) para esto.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const packId = body?.pack;
    const origin = body?.origin || 'https://agendate.base44.app';
    const pack = ADDON_PACKS[packId];
    if (!pack) return Response.json({ error: 'Pack inválido' }, { status: 400 });

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) {
      return Response.json({ error: 'Mercado Pago no está configurado. Contactá al administrador.' }, { status: 400 });
    }

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user.id });
    const practice = practices?.[0];
    if (!practice) return Response.json({ error: 'No hay configuración de consultorio' }, { status: 400 });

    const preference = {
      items: [{
        title: `Kame Agenda — ${pack.label}`,
        quantity: 1,
        unit_price: pack.price,
        currency_id: 'ARS',
      }],
      back_urls: {
        success: `${origin}/configuracion?addon=success`,
        failure: `${origin}/configuracion?addon=failure`,
        pending: `${origin}/configuracion?addon=pending`,
      },
      auto_return: 'approved',
      // El webhook de pagos individuales usa esto para saber a qué consultorio sumarle
      // el cupo, y cuántas conversaciones corresponden al pack comprado.
      metadata: { practice_id: practice.id, addon_pack: packId, conversations: pack.conversations },
    };

    const res = await fetch('https://api.mercadopago.com/checkout/preferences', {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(preference),
    });
    const data = await res.json();
    if (!res.ok) {
      return Response.json({ error: data.message || 'Error al crear el pago del pack' }, { status: 400 });
    }
    return Response.json({ init_point: data.init_point });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
