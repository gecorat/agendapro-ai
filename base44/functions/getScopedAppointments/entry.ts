import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Trae los turnos correctamente alcanzados: el dueño de la cuenta ve TODOS los del
// consultorio; un profesional invitado ve SOLO los suyos.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ appointments: [] });

    const all = await base44.asServiceRole.entities.Appointment.filter({ professional_id: scope.practiceOwnerId });
    const appointments = scope.isOwnerLike
      ? all
      : (all || []).filter((a) => a.professional_ref_id === scope.professionalRefId);

    return Response.json({ appointments, isOwner: scope.isOwnerLike });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
