import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';
import { findOwnedRows } from '../../shared/ownership.ts';

// Trae SOLO los servicios del consultorio del usuario actual. Antes Service.list()
// se llamaba sin filtro y mezclaba servicios de TODAS las cuentas. Confirmado en vivo.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ services: [] });

    // Se busca por practice_owner_id con respaldo a created_by_id (ver ownership.ts).
    // Filtrar solo por created_by_id tenía dos problemas con los servicios que crea el
    // onboarding: no aparecían los del consultorio propio, y como Base44 les estampa a
    // TODOS el mismo id de servicio, el filtro habría devuelto además los de otras
    // cuentas — exactamente la mezcla que esta función existe para evitar.
    const all = await findOwnedRows(base44, 'Service', scope.practiceOwnerId);
    return Response.json({ services: all });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
