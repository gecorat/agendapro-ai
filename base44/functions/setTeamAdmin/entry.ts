import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findPracticeRowsByOwner } from "../../shared/ownership.ts";

// Promueve o degrada a un profesional invitado a "co-admin" (ve y gestiona todo el
// consultorio como el dueno, menos facturacion/plan). Exclusivo del DUENO REAL de la
// cuenta -- ni siquiera un co-admin existente puede promover a otro, para no abrir una
// escalada de permisos sin control.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const practices = await findPracticeRowsByOwner(base44, user.id);
    if (!practices?.[0]) {
      return Response.json({ error: 'Solo el dueno de la cuenta puede hacer esto' }, { status: 403 });
    }

    const body = await req.json();
    const { professionalId, isTeamAdmin } = body || {};
    if (!professionalId || typeof isTeamAdmin !== 'boolean') {
      return Response.json({ error: 'Faltan datos' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.Professional.filter({ id: professionalId });
    const professional = rows?.[0];
    if (!professional || professional.practice_owner_id !== user.id) {
      return Response.json({ error: 'No encontrado o no te pertenece' }, { status: 404 });
    }

    const updated = await base44.asServiceRole.entities.Professional.update(professionalId, { is_team_admin: isTeamAdmin });
    return Response.json({ ok: true, professional: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
