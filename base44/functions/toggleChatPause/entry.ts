import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { normalizePhone } from '../../shared/whatsapp-providers.ts';

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

    const existing = await base44.asServiceRole.entities.ChatPause.filter({ professional_id: user.id, phone });
    const current = existing?.[0];

    const nextPaused = typeof body?.paused === 'boolean' ? body.paused : !(current?.paused ?? false);
    const pausedUntil = nextPaused && body?.durationMinutes
      ? new Date(Date.now() + Number(body.durationMinutes) * 60000).toISOString()
      : null;

    let record;
    if (current) {
      record = await base44.asServiceRole.entities.ChatPause.update(current.id, { paused: nextPaused, paused_until: pausedUntil });
    } else {
      record = await base44.asServiceRole.entities.ChatPause.create({ professional_id: user.id, phone, paused: nextPaused, paused_until: pausedUntil });
    }

    return Response.json({ paused: record.paused, paused_until: record.paused_until || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
