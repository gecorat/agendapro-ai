import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizePhone } from '../../shared/whatsapp-providers.ts';
import { resolveScope } from '../../shared/team-scope.ts';

// Prende/apaga la pausa del bot para una conversación puntual. Con esto pausado, el bot no
// le responde más a ese paciente hasta que el profesional lo reanude a mano — para casos
// donde prefiere atender personalmente (ej. algo delicado, un cliente conocido, etc.).
// Soporta duración (durationMinutes: 60, 1440, o ausente = indefinido).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const phone = normalizePhone(body?.phone);
    if (!phone) return Response.json({ error: 'phone requerido' }, { status: 400 });

    // La pausa se guarda con el id del DUEÑO del consultorio, que es con el que la lee el
    // webhook (`isChatPaused(base44, practice.created_by_id, ...)`). Con `user.id` un
    // profesional invitado escribía una fila que nadie consultaba nunca: la pantalla le
    // mostraba el chat como pausado y el bot seguía respondiendo igual.
    const scope = await resolveScope(base44, user);
    if (!scope?.practiceOwnerId) {
      return Response.json({ error: 'No tenemos un consultorio asociado a tu cuenta.' }, { status: 400 });
    }
    const ownerId = scope.practiceOwnerId;

    const existing = await base44.asServiceRole.entities.ChatPause.filter({ professional_id: ownerId, phone });
    const current = existing?.[0];

    const nextPaused = typeof body?.paused === 'boolean' ? body.paused : !(current?.paused ?? false);
    const pausedUntil = nextPaused && body?.durationMinutes
      ? new Date(Date.now() + Number(body.durationMinutes) * 60000).toISOString()
      : null;

    let record;
    if (current) {
      record = await base44.asServiceRole.entities.ChatPause.update(current.id, { paused: nextPaused, paused_until: pausedUntil });
    } else {
      record = await base44.asServiceRole.entities.ChatPause.create({ professional_id: ownerId, phone, paused: nextPaused, paused_until: pausedUntil });
    }

    // Se devuelve también el teléfono normalizado (solo dígitos), que es la clave real con
    // la que quedó guardada la fila. La pantalla lo necesita para actualizar su estado local
    // sin volver a consultar: comparando contra el teléfono crudo (que puede traer "+")
    // terminaba agregando una fila duplicada en vez de actualizar la existente.
    return Response.json({ paused: record.paused, paused_until: record.paused_until || null, phone });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
