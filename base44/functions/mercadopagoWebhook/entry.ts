import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncSubscriptionStatus } from "../../shared/mercadopago.ts";

// Webhook de Mercado Pago para las notificaciones de Suscripciones. IMPORTANTE: para el
// tópico de suscripciones, MP no ofrece validación por header de firma (a diferencia de
// pagos únicos) — por eso NUNCA confiamos en el contenido del body del webhook para
// decidir nada; solo lo usamos para saber QUÉ recurso mirar, y vamos a buscar el estado
// real a la API de Mercado Pago con nuestro propio access token antes de tocar el plan
// de nadie.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) return Response.json({ ok: true, skipped: 'not_configured' });

    const type = body?.type || body?.topic;
    const resourceId = body?.data?.id || body?.id;
    if (!resourceId) return Response.json({ ok: true, skipped: 'no_id' });

    if (type !== 'subscription_preapproval' && type !== 'preapproval') {
      if (type === 'payment') {
        // Pago único (packs adicionales de conversaciones), no la suscripción mensual.
        const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${resourceId}`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        if (!payRes.ok) return Response.json({ ok: true, skipped: 'payment_fetch_failed' });
        const payment = await payRes.json();

        if (payment.status === 'approved' && payment.metadata?.addon_pack) {
          const practiceId = payment.metadata.practice_id;
          const conversations = Number(payment.metadata.conversations) || 0;
          const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ id: practiceId });
          const practice = practices?.[0];
          if (practice && conversations > 0) {
            // Sumamos cupo y reabrimos las alertas de 90/95/100%: si estaba bloqueado por
            // falta de cupo, este pago le da más lugar antes del próximo aviso.
            await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
              whatsapp_addon_conversations: (practice.whatsapp_addon_conversations || 0) + conversations,
              whatsapp_usage_alert_90_sent: false,
              whatsapp_usage_alert_95_sent: false,
              whatsapp_usage_alert_100_sent: false,
            });
          }
        }
        return Response.json({ ok: true });
      }
      // Otros tópicos (merchant_order, etc.) no accionan nada por ahora.
      return Response.json({ ok: true, skipped: `unhandled_type:${type}` });
    }

    const res = await syncSubscriptionStatus(base44, accessToken, resourceId);
    if (!res.synced) return Response.json({ ok: true, skipped: res.reason });

    return Response.json({ ok: true, changed: res.changed });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
