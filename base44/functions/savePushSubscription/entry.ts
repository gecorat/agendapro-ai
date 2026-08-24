import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Guarda (o actualiza) la suscripción push de ESTE navegador/dispositivo para el usuario
// logueado. Idempotente por (user_id + endpoint): si el mismo navegador ya tenía una
// suscripción guardada, la pisa en vez de duplicarla — el endpoint es la identidad real de
// la suscripción del lado del servicio push (FCM/Mozilla/etc), no algo que nosotros generemos.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { endpoint, keys, user_agent } = body || {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return Response.json({ error: 'Suscripción incompleta.' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.PushSubscription.filter({ user_id: user.id, endpoint });
    if (existing?.[0]) {
      await base44.asServiceRole.entities.PushSubscription.update(existing[0].id, {
        keys_p256dh: keys.p256dh,
        keys_auth: keys.auth,
        user_agent: user_agent || existing[0].user_agent || '',
      });
      return Response.json({ ok: true, updated: true });
    }

    await base44.asServiceRole.entities.PushSubscription.create({
      user_id: user.id,
      endpoint,
      keys_p256dh: keys.p256dh,
      keys_auth: keys.auth,
      user_agent: user_agent || '',
      created_by_id: user.id,
    });

    return Response.json({ ok: true, created: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
