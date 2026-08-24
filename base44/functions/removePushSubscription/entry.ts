import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Borra la suscripción push de este navegador (el usuario desactivó las notificaciones, o el
// service worker detectó que el navegador la invalidó y hay que limpiarla).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { endpoint } = body || {};
    if (!endpoint) return Response.json({ error: 'Falta el endpoint.' }, { status: 400 });

    const existing = await base44.asServiceRole.entities.PushSubscription.filter({ user_id: user.id, endpoint });
    if (existing?.[0]) {
      await base44.asServiceRole.entities.PushSubscription.delete(existing[0].id);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
