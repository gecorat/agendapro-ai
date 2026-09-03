import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncSubscriptionStatus } from "../../shared/mercadopago.ts";
import { recordPayment, normalizeMpStatus, findPracticeBySubscription } from "../../shared/payments.ts";

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

    // COBRO DE UNA SUSCRIPCIÓN. Este tópico se estaba descartando entero: cada cuota
    // mensual llegaba acá y se iba sin registrarse, por eso no había facturación
    // histórica. El recurso /authorized_payments/{id} es el único que ata el pago con su
    // preapproval_id, que es como sabemos de qué cuenta es.
    if (type === 'subscription_authorized_payment') {
      const apRes = await fetch(`https://api.mercadopago.com/authorized_payments/${resourceId}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!apRes.ok) return Response.json({ ok: true, skipped: 'authorized_payment_fetch_failed' });
      const ap = await apRes.json();

      const practice = await findPracticeBySubscription(base44, ap.preapproval_id);
      const rawStatus = ap.payment?.status || ap.status;
      const result = await recordPayment(base44, {
        provider: 'mercadopago',
        // El id del pago real cuando existe; si el cobro todavía no generó pago (agendado
        // o rechazado), el id del authorized_payment alcanza como clave estable.
        provider_payment_id: String(ap.payment?.id || ap.id),
        subscription_id: ap.preapproval_id,
        practice_id: practice?.id,
        practice_name: practice?.practice_name,
        kind: 'subscription',
        plan: practice?.plan,
        amount: ap.transaction_amount,
        currency: ap.currency_id || 'ARS',
        status: normalizeMpStatus(rawStatus),
        provider_status_raw: String(rawStatus || ''),
        paid_at: ap.date_created || ap.debit_date,
        description: 'Cuota mensual de la suscripción',
      });
      return Response.json({ ok: true, recorded: result });
    }

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

        // Registro contable del pago único. Va DESPUÉS de acreditar el cupo a propósito:
        // si algo falla acá, el profesional igual se quedó con las conversaciones que
        // pagó — preferimos perder una fila de estadística antes que el servicio.
        if (payment.metadata?.addon_pack) {
          const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ id: payment.metadata.practice_id });
          const practice = practices?.[0];
          await recordPayment(base44, {
            provider: 'mercadopago',
            provider_payment_id: String(payment.id),
            practice_id: practice?.id,
            practice_name: practice?.practice_name,
            kind: 'addon_pack',
            plan: practice?.plan,
            amount: payment.transaction_amount,
            currency: payment.currency_id || 'ARS',
            status: normalizeMpStatus(payment.status),
            provider_status_raw: String(payment.status || ''),
            paid_at: payment.date_approved || payment.date_created,
            description: `Pack adicional de ${payment.metadata.conversations || '?'} conversaciones`,
          });
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
