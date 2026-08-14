import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { token } = body;

    if (!token) {
      return Response.json({ error: 'token required' }, { status: 400 });
    }

    const appts = await base44.asServiceRole.entities.Appointment.filter({ confirm_token: token });
    const appt = appts?.[0];
    if (!appt) {
      return Response.json({ error: 'invalid token' }, { status: 404 });
    }

    if (appt.status !== 'pending') {
      return Response.json({ ok: true, already_resolved: true, status: appt.status });
    }

    await base44.asServiceRole.entities.Appointment.update(appt.id, { status: 'confirmed' });

    return Response.json({ ok: true, resolved: true, status: 'confirmed' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}