import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncProfessionalAddonBilling } from '../../shared/professional-billing.ts';
import { resolveScope } from '../../shared/team-scope.ts';

// Eliminar un profesional del equipo. Si era un addon pago, recalcula y baja el monto
// real de la suscripcion en Mercado Pago automaticamente. Puede hacerlo el dueno real O
// un profesional promovido a co-admin.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope || !scope.canManageTeam) {
      return Response.json({ error: 'No tenes permiso para eliminar profesionales' }, { status: 403 });
    }

    const body = await req.json();
    const { professionalId } = body || {};
    if (!professionalId) return Response.json({ error: 'professionalId requerido' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.Professional.filter({ id: professionalId });
    const professional = rows?.[0];
    if (!professional || professional.practice_owner_id !== scope.practiceOwnerId) {
      return Response.json({ error: 'No encontrado o no te pertenece' }, { status: 404 });
    }

    await base44.asServiceRole.entities.Professional.delete(professionalId);

    let billing = null;
    if (professional.is_paid_addon) {
      const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: scope.practiceOwnerId });
      const practice = practices?.[0];
      if (practice) billing = await syncProfessionalAddonBilling(base44, practice);
    }

    return Response.json({ ok: true, billing });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
