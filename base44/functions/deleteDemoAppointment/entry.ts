import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Llamado por el frontend 5 minutos después de crear una cita de prueba del simulador
// (/bot), y también por botPreviewMessage como limpieza best-effort en cada mensaje nuevo.
// Solo borra si es realmente una cita is_demo del propio usuario — no se puede usar para
// borrar citas reales de nadie.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { appointment_id } = body || {};
    if (!appointment_id) return Response.json({ error: 'Falta appointment_id' }, { status: 400 });

    const appt = await base44.asServiceRole.entities.Appointment.get(appointment_id).catch(() => null);
    if (!appt) return Response.json({ ok: true }); // ya no existe, nada que hacer
    if (appt.professional_id !== user.id || !appt.is_demo) {
      return Response.json({ error: 'No autorizado' }, { status: 403 });
    }

    await base44.asServiceRole.entities.Appointment.delete(appointment_id);
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
