import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Único camino para editar una ficha de Professional desde la app. La RLS de la entidad
// quedó en solo-admin a propósito.
//
// POR QUÉ: la RLS de Base44 filtra FILAS, no CAMPOS. La regla anterior de `update` era
// `data.practice_owner_id == {{user.id}}` OR `data.user_id == {{user.id}}`, y con eso
// cualquier usuario registrado podía, desde la consola del navegador:
//   1. Professional.create({ practice_owner_id: <mi id>, user_id: <mi id> })   ← permitido
//   2. Professional.update(esaFicha, { practice_owner_id: <id de la víctima>,
//                                      is_team_admin: true })                  ← permitido
// y a partir de ahí resolveScope lo devolvía como co-admin del consultorio ajeno, con
// acceso a sus pacientes, turnos y conversaciones.
//
// Sacar solo la condición `data.user_id` no alcanzaba: si Base44 evalúa `data.*` contra la
// fila EXISTENTE (y no contra los valores nuevos), la ficha que el atacante se creó a sí
// mismo cumple igual `data.practice_owner_id == user.id` y el paso 2 sigue pasando. Como
// eso no se puede verificar desde afuera, la entidad se cerró del todo y el permiso se
// decide acá, donde además se puede limitar QUÉ campos se tocan.
const EDITABLE_FIELDS = ['first_name', 'last_name', 'specialty', 'color', 'active'];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ error: 'Sin consultorio asociado' }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    const { professionalId } = body || {};

    // A quién estoy editando. Sin id, o con el id de mi propia ficha: me edito a mí mismo.
    const isSelf = !professionalId || professionalId === scope.professionalRefId;
    const targetId = isSelf ? scope.professionalRefId : professionalId;
    if (!targetId) {
      return Response.json({ error: 'No hay ficha de profesional para editar' }, { status: 400 });
    }

    if (!isSelf) {
      // Editar a OTRO del equipo: mismo permiso que había antes de este cambio — solo el
      // dueño real de la cuenta. (Un co-admin tampoco podía hacerlo con la RLS vieja,
      // porque no matcheaba ninguna de sus dos condiciones; no se amplía nada acá.)
      if (!scope.isOwner) {
        return Response.json({ error: 'No tenés permiso para editar a este profesional' }, { status: 403 });
      }
      const rows = await base44.asServiceRole.entities.Professional.filter({ id: targetId });
      const target = rows?.[0];
      if (!target || target.practice_owner_id !== scope.practiceOwnerId) {
        return Response.json({ error: 'Ese profesional no es de tu consultorio' }, { status: 404 });
      }
    }

    const data: Record<string, unknown> = {};
    for (const field of EDITABLE_FIELDS) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (Object.keys(data).length === 0) {
      return Response.json({ error: 'Nada para actualizar' }, { status: 400 });
    }

    // practice_owner_id, user_id, is_team_admin, is_paid_addon, invite_token e
    // invite_status NO están en la whitelist y no se pueden tocar por acá. is_team_admin
    // sigue teniendo su propia función (setTeamAdmin), que valida dueño real.
    const updated = await base44.asServiceRole.entities.Professional.update(targetId, data);
    return Response.json({ ok: true, professional: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
