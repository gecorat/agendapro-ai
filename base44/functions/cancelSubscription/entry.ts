import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncSubscriptionStatus } from '../../shared/mercadopago.ts';

// Cancela la suscripción REAL en Mercado Pago (PUT /preapproval/{id} con status:
// cancelled — confirmado en la documentación oficial, mismo endpoint que usamos para
// actualizar el monto). Después sincroniza al toque para que el "suspended" se refleje
// ya mismo en la app, sin esperar el chequeo de la próxima hora.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    if (!practice) return Response.json({ error: 'No se encontró tu consultorio' }, { status: 404 });
    if (!practice.mercadopago_subscription_id) {
      return Response.json({ error: 'No tenés una suscripción activa de Mercado Pago para cancelar.' }, { status: 400 });
    }
    if (practice.plan_granted_by_admin) {
      return Response.json({ error: 'Tu plan fue asignado manualmente por un administrador, no tiene un cobro real que cancelar.' }, { status: 400 });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const accessToken = cfg?.[0]?.mercadopago_access_token;
    if (!accessToken) return Response.json({ error: 'Configuración de pagos incompleta' }, { status: 500 });

    const res = await fetch(`https://api.mercadopago.com/preapproval/${practice.mercadopago_subscription_id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'cancelled' }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return Response.json({ error: `Mercado Pago rechazó la cancelación: ${errText}` }, { status: 502 });
    }

    const syncResult = await syncSubscriptionStatus(base44, accessToken, practice.mercadopago_subscription_id);
    return Response.json({ ok: true, syncResult });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
