import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Desconecta el Google Calendar de ESTA persona (dueño o profesional invitado según
// quién llame). Borra el refresh token guardado -- ya no se puede sincronizar hasta que
// vuelva a conectar.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ error: 'No se encontró tu consultorio' }, { status: 400 });

    const clearData = { google_calendar_connected: false, google_refresh_token: null, google_calendar_email: null };

    if (scope.professionalRefId) {
      await base44.asServiceRole.entities.Professional.update(scope.professionalRefId, clearData);
    } else {
      const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user.id });
      const practice = practices?.[0];
      if (practice) await base44.asServiceRole.entities.PracticeSettings.update(practice.id, clearData);
    }

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
