import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);    const user = await base44.auth.me();
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

    // Check if user already has PracticeSettings (avoid duplicates)
    const existing = await base44.asServiceRole.entities.PracticeSettings.filter(
      { created_by_id: user.id }
    );
    if (existing && existing.length > 0) {
      return Response.json({ settings: existing[0], alreadyExists: true });
    }

    // Create PracticeSettings con rol de servicio: PracticeSettings.create ahora está
    // bloqueado por RLS para todos salvo admins (ver PracticeSettings.jsonc), así que ya no
    // podemos crearlo como el usuario. Fijamos plan/trial explícitamente acá, ignorando
    // cualquier valor que venga en practiceData para esos campos protegidos.
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    const settings = await base44.asServiceRole.entities.PracticeSettings.create({
      ...practiceData,
      created_by_id: user.id,
      plan: 'trial',
      trial_ends_at: trialEnds.toISOString(),
      trial_origin: (practiceData?.trial_origin === 'invitation' && invitationValid) ? 'invitation' : 'landing',
      suspended: false,
    });

    // Servicios y disponibilidad se crean con rol de servicio por el mismo motivo, pero
    // fijándoles created_by_id = user.id para que sigan quedando asociados al profesional.
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
          created_by_id: user.id,
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
      created_by_id: user.id,
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