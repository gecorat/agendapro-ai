import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Trae SOLO los profesionales del consultorio del usuario actual. Antes el panel de
// Equipo llamaba Professional.list() directo -- sin filtro -- y mostraba profesionales
// de OTRAS cuentas mezclados con los propios. Confirmado en vivo.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ professionals: [] });

    const all = await base44.asServiceRole.entities.Professional.filter({ practice_owner_id: scope.practiceOwnerId });
    return Response.json({ professionals: all || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
