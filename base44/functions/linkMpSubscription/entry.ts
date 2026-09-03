import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncSubscriptionStatus } from '../../shared/mercadopago.ts';
import { findPracticeRowsByOwner } from "../../shared/ownership.ts";

// Se llama apenas el usuario vuelve del checkout de Mercado Pago (con plan asociado) a
// /upgrade-plan?status=success — en ese momento Mercado Pago agrega el preapproval_id
// real a la URL de retorno. Como nunca llamamos a POST /preapproval nosotros (para no
// tener que pedir el payer_email), este es el paso que vincula esa suscripción recién
// creada en Mercado Pago con la cuenta correcta acá: lo sabemos porque es el usuario
// autenticado en ESTA sesión quien acaba de volver, no por nada que venga en la URL.
// Nunca confiamos en el preapproval_id de la URL a ciegas: lo verificamos consultando
// directo a la API de Mercado Pago antes de tocar el plan de nadie (mismo principio que
// el webhook).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const preapprovalId = body?.preapproval_id;
    if (!preapprovalId) return Response.json({ error: 'Falta preapproval_id' }, { status: 400 });

    const practices = await findPracticeRowsByOwner(base44, user.id);
    const practice = practices?.[0];
    if (!practice) return Response.json({ error: 'No se encontró tu consultorio' }, { status: 404 });

    // Si no hay un intento de suscripción pendiente de esta cuenta, no vinculamos nada —
    // evita que alguien pegue un preapproval_id ajeno en la URL y se cuelgue del plan de
    // otro (aunque syncSubscriptionStatus igual valida todo contra la API real después).
    if (!practice.mercadopago_pending_plan) {
      return Response.json({ ok: true, skipped: 'no_pending_upgrade' });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) return Response.json({ error: 'Mercado Pago no está configurado' }, { status: 500 });

    // Guardamos el id ya mismo (aunque el pago todavía esté "pending") para que el
    // webhook y el chequeo periódico lo encuentren por mercadopago_subscription_id
    // incluso si no hay external_reference (el checkout con plan asociado no lo trae).
    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      mercadopago_subscription_id: preapprovalId,
      mercadopago_pending_plan: null,
    });

    const syncResult = await syncSubscriptionStatus(base44, accessToken, preapprovalId);
    return Response.json({ ok: true, syncResult });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
