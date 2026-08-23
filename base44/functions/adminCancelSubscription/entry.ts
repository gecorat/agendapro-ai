import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Cancela la suscripcion REAL en Mercado Pago de CUALQUIER consultorio (a diferencia de
// cancelSubscription, que solo cancela la propia). Exclusivo de admins de la plataforma.
// Esta es la accion "Suspender pago": distinta de "Suspender" (que solo bloquea el acceso
// local sin tocar la facturacion real).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json();
    const { practiceSettingsId } = body || {};
    if (!practiceSettingsId) return Response.json({ error: 'practiceSettingsId requerido' }, { status: 400 });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ id: practiceSettingsId });
    const practice = practices?.[0];
    if (!practice) return Response.json({ error: 'No encontrado' }, { status: 404 });
    if (!practice.mercadopago_subscription_id) {
      return Response.json({ error: 'Esta cuenta no tiene una suscripcion real de Mercado Pago para cancelar.' }, { status: 400 });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) return Response.json({ error: 'Configuracion de pagos incompleta' }, { status: 500 });

    const res = await fetch(`https://api.mercadopago.com/preapproval/${practice.mercadopago_subscription_id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `Mercado Pago rechazo la cancelacion: ${errText}` }, { status: 502 });
    }

    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, { suspended: true, mp_cancelled_by_admin: true });
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
