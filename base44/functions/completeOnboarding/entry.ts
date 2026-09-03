import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findPracticeByOwner } from '../../shared/ownership.ts';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { practiceData, services = [] } = body;

    // Validar y consumir el código de invitación si vino uno. Antes esto no existía: se
    // guardaba el código como texto suelto pero nunca se verificaba contra la tabla
    // Invitation ni se marcaba como usado — cualquier string servía igual. No bloqueamos
    // el onboarding si el código no es válido (es atribución, no una restricción dura), pero
    // solo se acredita como "invitation" si realmente existía, estaba pendiente y no expiró.
    const invitationCode = practiceData?.invitation_code;
    let invitationValid = false;
    if (invitationCode) {
      try {
        const invites = await base44.asServiceRole.entities.Invitation.filter({ code: invitationCode });
        const invite = invites?.[0];
        if (invite && invite.status === 'pending' && (!invite.expires_at || new Date(invite.expires_at) >= new Date())) {
          await base44.asServiceRole.entities.Invitation.update(invite.id, { status: 'used', used_by_id: user.id });
          invitationValid = true;
        }
      } catch { /* si falla la validación, seguimos sin bloquear el alta */ }
    }

    // ¿Ya tiene consultorio? Se busca por el criterio de propiedad real (owner_user_id
    // con respaldo a created_by_id), no solo por created_by_id: si no, un usuario que ya
    // completó el onboarding podía crear un segundo consultorio duplicado.
    const existing = await findPracticeByOwner(base44, user.id);
    if (existing) {
      return Response.json({ settings: existing, alreadyExists: true });
    }

    // Create PracticeSettings con rol de servicio: PracticeSettings.create ahora está
    // bloqueado por RLS para todos salvo admins (ver PracticeSettings.jsonc), así que ya no
    // podemos crearlo como el usuario. Fijamos plan/trial explícitamente acá, ignorando
    // cualquier valor que venga en practiceData para esos campos protegidos.
    //
    // OJO con la propiedad: mandar created_by_id NO sirve, Base44 lo pisa con el id del
    // que ejecuta (o sea el servicio) tanto en create como en update — verificado en vivo.
    // Por eso el dueño real va en owner_user_id / practice_owner_id, que son campos
    // nuestros (ver base44/shared/ownership.ts). Sin esto, el profesional terminaba el
    // onboarding y la app no lo reconocía como dueño de nada.
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    const settings = await base44.asServiceRole.entities.PracticeSettings.create({
      ...practiceData,
      owner_user_id: user.id,
      plan: 'trial',
      trial_ends_at: trialEnds.toISOString(),
      trial_origin: (practiceData?.trial_origin === 'invitation' && invitationValid) ? 'invitation' : 'landing',
      suspended: false,
    });

    // Servicios y disponibilidad se crean con rol de servicio por el mismo motivo, y se
    // les fija practice_owner_id = user.id (created_by_id no es nuestro, lo pisa Base44).
    let servicesToCreate = services && services.length > 0 ? services : [{
      name: "Consulta General",
      description: "Consulta de evaluación general. Ideal para una primera visita o control de rutina.",
      duration_minutes: 30,
      price: 5000,
      color: "#3b82f6",
      active: true,
    }];
    let servicesCreated = 0;
    if (servicesToCreate.length > 0) {
      const created = await base44.asServiceRole.entities.Service.bulkCreate(
        servicesToCreate.map(s => ({
          name: s.name,
          description: s.description || "",
          duration_minutes: s.duration_minutes || 30,
          margin_minutes: s.margin_minutes || 0,
          color: s.color || "#3b82f6",
          price: s.price,
          follow_up_days: s.follow_up_days || 0,
          active: true,
          practice_owner_id: user.id,
        }))
      );
      servicesCreated = Array.isArray(created) ? created.length : servicesToCreate.length;
    }

    // Disponibilidad por defecto: Lunes a Viernes, bloque corrido 9-18.
    const defaultAvailability = [1, 2, 3, 4, 5].map((d) => ({
      day_of_week: d,
      start_time: "09:00",
      end_time: "18:00",
      type: "work",
      label: "",
      practice_owner_id: user.id,
    }));
    try {
      await base44.asServiceRole.entities.Availability.bulkCreate(defaultAvailability);
    } catch { /* la disponibilidad no bloquea el onboarding */ }

    return Response.json({
      settings,
      servicesCreated,
      alreadyExists: false
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}