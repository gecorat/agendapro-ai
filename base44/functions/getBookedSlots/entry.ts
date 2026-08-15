import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { professional_id, date_from, date_to } = body;

    if (!professional_id) {
      return Response.json({ error: 'professional_id required' }, { status: 400 });
    }

    const from = date_from ? new Date(date_from) : new Date();
    const to = date_to ? new Date(date_to) : new Date(Date.now() + 21 * 86400000);

    // asServiceRole: bypass RLS para que la página pública (visitante anónimo)
    // pueda ver las citas reales del profesional y evitar doble reserva.
    const appts = await base44.asServiceRole.entities.Appointment.filter({
      professional_id,
      status: { $ne: 'cancelled' },
      start_datetime: { $gte: from.toISOString(), $lte: to.toISOString() },
    });

    const slots = (appts || []).map((a) => ({
      start_datetime: a.start_datetime,
      end_datetime: a.end_datetime,
      status: a.status,
    }));

    return Response.json({ slots });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}