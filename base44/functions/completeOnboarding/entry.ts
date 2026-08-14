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

    // Create suggested services as the user
    let servicesCreated = 0;
    if (services.length > 0) {
      const created = await base44.entities.Service.bulkCreate(
        services.map(s => ({
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
      servicesCreated = Array.isArray(created) ? created.length : services.length;
    }

    return Response.json({
      settings,
      servicesCreated,
      alreadyExists: false
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}