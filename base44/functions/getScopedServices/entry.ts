import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Trae SOLO los servicios del consultorio del usuario actual. Antes Service.list()
// se llamaba sin filtro y mezclaba servicios de TODAS las cuentas. Confirmado en vivo.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ services: [] });

    const all = await base44.asServiceRole.entities.Service.filter({ created_by_id: scope.practiceOwnerId });
    return Response.json({ services: all || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
