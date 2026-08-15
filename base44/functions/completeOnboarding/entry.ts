import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { practiceData, services = [] } = body;

    // Check if user already has PracticeSettings (avoid duplicates)
    const existing = await base44.asServiceRole.entities.PracticeSettings.filter(
      { created_by_id: user.id }
    );
    if (existing && existing.length > 0) {
      return Response.json({ settings: existing[0], alreadyExists: true });
    }

    // Create PracticeSettings as the user (not service role) so created_by_id
    // is set to the user's ID automatically. RLS allows all authenticated
    // users to create.
    const settings = await base44.entities.PracticeSettings.create(practiceData);

    // Create suggested services as the user (fallback to a default "Consulta General")
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
      const created = await base44.entities.Service.bulkCreate(
        servicesToCreate.map(s => ({
          name: s.name,
          description: s.description || "",
          duration_minutes: s.duration_minutes || 30,
          margin_minutes: s.margin_minutes || 0,
          color: s.color || "#3b82f6",
          price: s.price,
          follow_up_days: s.follow_up_days || 0,
          active: true,
        }))
      );
      servicesCreated = Array.isArray(created) ? created.length : servicesToCreate.length;
    }

    // Disponibilidad por defecto: Lunes a Viernes, bloque corrido 9-18.
    // Se crea como el usuario para que created_by_id quede asignado.
    const defaultAvailability = [1, 2, 3, 4, 5].map((d) => ({
      day_of_week: d,
      start_time: "09:00",
      end_time: "18:00",
      type: "work",
      label: "",
    }));
    try {
      await base44.entities.Availability.bulkCreate(defaultAvailability);
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