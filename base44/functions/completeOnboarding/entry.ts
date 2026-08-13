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

    // Create PracticeSettings with the user's ID as created_by_id
    const settings = await base44.asServiceRole.entities.PracticeSettings.create({
      ...practiceData,
      created_by_id: user.id
    });

    // Force-update created_by_id in case the service role overrode it
    let finalSettings = settings;
    if (settings.created_by_id !== user.id) {
      finalSettings = await base44.asServiceRole.entities.PracticeSettings.update(
        settings.id,
        { created_by_id: user.id }
      );
    }

    // Create suggested services with the user's ID
    let servicesCreated = 0;
    if (services.length > 0) {
      const created = await base44.asServiceRole.entities.Service.bulkCreate(
        services.map(s => ({
          name: s.name,
          description: s.description || "",
          duration_minutes: s.duration_minutes || 30,
          margin_minutes: s.margin_minutes || 0,
          color: s.color || "#3b82f6",
          price: s.price,
          follow_up_days: s.follow_up_days || 0,
          active: true,
          created_by_id: user.id
        }))
      );
      servicesCreated = Array.isArray(created) ? created.length : services.length;

      // Fix created_by_id on services if the service role overrode it
      const allServices = await base44.asServiceRole.entities.Service.list();
      const userServices = allServices.filter(s => s.created_by_id === user.id);
      if (userServices.length === 0 && servicesCreated > 0) {
        // The service role overrode created_by_id — fix the recently created ones
        const recentNames = services.map(s => s.name);
        const toFix = allServices.filter(s => recentNames.includes(s.name));
        for (const s of toFix) {
          await base44.asServiceRole.entities.Service.update(
            s.id,
            { created_by_id: user.id }
          );
        }
      }
    }

    return Response.json({
      settings: finalSettings,
      servicesCreated,
      alreadyExists: false
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}