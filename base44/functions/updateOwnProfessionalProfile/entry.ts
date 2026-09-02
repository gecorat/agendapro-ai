import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Un profesional invitado edita SU PROPIA ficha (nombre, apellido, especialidad, color,
// activo) desde la pestaña Equipo de Configuración.
//
// Antes esto lo permitía directamente la RLS de Professional, con la condición
// `data.user_id == {{user.id}}` en el `update`. El problema es que la RLS de Base44 filtra
// FILAS, no CAMPOS: esa misma condición dejaba que cualquier usuario registrado se editara
// `practice_owner_id` e `is_team_admin` a mano desde la consola del navegador y quedara
// como co-admin del consultorio de otra persona — con acceso a sus pacientes, turnos y
// conversaciones, porque resolveScope confía en esos dos campos.
//
// Por eso la condición se sacó de la RLS y la auto-edición pasa por acá, que es donde sí
// se puede limitar QUÉ campos se tocan.
const EDITABLE_FIELDS = ['first_name', 'last_name', 'specialty', 'color', 'active'];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope?.professionalRefId) {
      return Response.json({ error: 'No tenés una ficha de profesional propia para editar' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const data: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'Nada para actualizar' }, { status: 400 });
    }

    // SIEMPRE sobre la ficha del propio usuario (la que resolvió el scope), nunca sobre un
    // id que venga en el body — si no, volveríamos a tener el mismo agujero por otra vía.
    const updated = await base44.asServiceRole.entities.Professional.update(scope.professionalRefId, data);
    return Response.json({ ok: true, professional: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
