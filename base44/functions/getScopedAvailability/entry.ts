import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Trae SOLO los horarios del consultorio del usuario actual. Antes el editor de horarios
// llamaba Availability.filter({}) directo -- sin ningun campo que diga a que consultorio
// pertenece cada franja, esto traia los horarios de TODA la app mezclados entre si.
// Confirmado en vivo: una cuenta de prueba mostraba horarios duplicados e inconsistentes
// acumulados de sesiones de prueba anteriores, de otras cuentas.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ availability: [] });

    const all = await base44.asServiceRole.entities.Availability.filter({ practice_owner_id: scope.practiceOwnerId });
    return Response.json({ availability: all || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
