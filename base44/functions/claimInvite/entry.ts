import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Se llama cuando el profesional invitado, YA logueado con su propia cuenta nueva de
// Base44 (la creaci\u00f3n de la cuenta en s\u00ed la maneja el login/registro nativo de Base44,
// no esta funci\u00f3n), completa el formulario de onboarding. Asocia su Professional al
// usuario real y guarda sus datos.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { token, first_name, last_name, specialty, work_start, work_end, break_start, break_end } = body || {};
    if (!token || !first_name) {
      return Response.json({ error: 'Faltan datos requeridos' }, { status: 400 });
    }

    const rows = await base44.asServiceRole.entities.Professional.filter({ invite_token: token });
    const professional = rows?.[0];
    if (!professional) {
      return Response.json({ error: 'Invitaci\u00f3n no encontrada o vencida' }, { status: 404 });
    }
    if (professional.invite_status === 'accepted' && professional.user_id && professional.user_id !== user.id) {
      return Response.json({ error: 'Esta invitaci\u00f3n ya fue usada por otra cuenta' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Professional.update(professional.id, {
      first_name,
      last_name: last_name || '',
      specialty: specialty || '',
      user_id: user.id,
      invite_status: 'accepted',
      active: true,
    });

    // Horario propio del profesional (Availability con professional_ref_id apuntando a
    // este registro, distinto del horario general del due\u00f1o de la cuenta).
    const start = work_start || '09:00';
    const end = work_end || '18:00';
    const days = [1, 2, 3, 4, 5]; // lunes a viernes por defecto
    for (const day of days) {
      await base44.asServiceRole.entities.Availability.create({
        created_by_id: professional.practice_owner_id,
        professional_ref_id: professional.id,
        type: 'work',
        day_of_week: day,
        start_time: start,
        end_time: end,
      });
      if (break_start && break_end) {
        await base44.asServiceRole.entities.Availability.create({
          created_by_id: professional.practice_owner_id,
          professional_ref_id: professional.id,
          type: 'break',
          day_of_week: day,
          start_time: break_start,
          end_time: break_end,
        });
      }
    }

    return Response.json({ ok: true, professional: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
