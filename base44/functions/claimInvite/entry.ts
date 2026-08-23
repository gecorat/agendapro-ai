import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Se llama cuando el profesional invitado, YA logueado con su propia cuenta nueva de
// Base44 (la creacion de la cuenta en si la maneja el login/registro nativo de Base44,
// no esta funcion), completa el formulario de onboarding. Asocia su Professional al
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
      return Response.json({ error: 'Invitacion no encontrada o vencida' }, { status: 404 });
    }
    if (professional.invite_status === 'accepted' && professional.user_id && professional.user_id !== user.id) {
      return Response.json({ error: 'Esta invitacion ya fue usada por otra cuenta' }, { status: 400 });
    }

    const updated = await base44.asServiceRole.entities.Professional.update(professional.id, {
      first_name,
      last_name: last_name || '',
      specialty: specialty || '',
      user_id: user.id,
      invite_status: 'accepted',
      active: true,
    });

    // Horario propio del profesional. OJO: created_by_id lo pone Base44 automaticamente
    // segun quien hace la llamada (aca, asServiceRole) - no se puede forzar a mano, asi
    // que la forma correcta de buscar "el horario de ESTE profesional" en el futuro es
    // siempre por professional_ref_id, nunca por created_by_id.
    const start = work_start || '09:00';
    const end = work_end || '18:00';
    const days = [1, 2, 3, 4, 5];
    for (const day of days) {
      await base44.asServiceRole.entities.Availability.create({
        professional_ref_id: professional.id,
        practice_owner_id: professional.practice_owner_id,
        type: 'work',
        day_of_week: day,
        start_time: start,
        end_time: end,
      });
      if (break_start && break_end) {
        await base44.asServiceRole.entities.Availability.create({
          professional_ref_id: professional.id,
          practice_owner_id: professional.practice_owner_id,
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
