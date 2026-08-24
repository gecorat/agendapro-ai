import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';
import { getGoogleEvents } from '../../shared/google-calendar.ts';

// Trae los eventos de Google Calendar (solo lectura, sin guardarlos) para el rango de
// fechas que la Agenda tiene visible, así el profesional ve en un mismo lugar tanto sus
// citas de Kame como lo que ya tiene agendado en Google. Respeta el mismo alcance que
// getScopedAppointments: el dueño (o un co-admin) ve los eventos de TODO el consultorio
// (los suyos + los de cada profesional con Google conectado); un profesional invitado
// normal ve solo los suyos.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { timeMin, timeMax } = body || {};
    if (!timeMin || !timeMax) return Response.json({ error: 'timeMin y timeMax requeridos' }, { status: 400 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ events: [] });

    // Arma la lista de "targets" (dueño + cada profesional con Google conectado) cuyo
    // calendario hay que consultar. Un profesional invitado normal solo consulta el suyo.
    const targets = [];
    if (scope.isOwnerLike) {
      targets.push({ professionalRefId: null });
      const profs = await base44.asServiceRole.entities.Professional.filter({ practice_owner_id: scope.practiceOwnerId, active: true });
      for (const p of profs || []) targets.push({ professionalRefId: p.id });
    } else {
      targets.push({ professionalRefId: scope.professionalRefId });
    }

    const results = await Promise.all(
      targets.map(async (t) => {
        const events = await getGoogleEvents(base44, scope.practiceOwnerId, t.professionalRefId, timeMin, timeMax);
        return events.map((ev) => ({ ...ev, professional_ref_id: t.professionalRefId || '' }));
      })
    );

    return Response.json({ events: results.flat() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
