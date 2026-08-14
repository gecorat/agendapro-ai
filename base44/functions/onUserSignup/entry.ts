import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { user_id, email, full_name, mode } = body;

    if (!email) return Response.json({ error: "email required" }, { status: 400 });
    const name = full_name || "profesional";

    if (mode === "reminder") {
      // Only send reminder if the user hasn't configured their practice yet
      const settings = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user_id });
      if (settings && settings.length > 0) {
        return Response.json({ sent: false, reason: "already_configured" });
      }
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: email,
        subject: "¿Necesitás ayuda para configurar AgendaPro?",
        body: `Hola ${name},\n\nVimos que aún no configuraste tu consultorio en AgendaPro. Estamos para ayudarte.\n\nEn menos de 5 minutos podés tener tu página de reservas lista:\n\n1. Ingresá a tu panel y completá tus datos.\n2. Elegí tu especialidad.\n3. Cargá tus servicios y horarios.\n4. ¡Listo! Probá el bot con tus datos.\n\n¿Te trabaste en algún paso? Respondé a este email y te damos una mano.\n\nAgendaPro`,
      });
      return Response.json({ sent: true });
    }

    // Welcome email (default)
    await base44.asServiceRole.integrations.Core.SendEmail({
      to: email,
      subject: "¡Bienvenido a AgendaPro!",
      body: `Hola ${name},\n\n¡Bienvenido a AgendaPro! Tu recepcionista virtual ya está lista para ayudarte a llenar tu agenda.\n\nPara empezar (5 minutos):\n\n1. Configurá tu consultorio: elegí tu especialidad y cargá tus datos.\n2. Sumá tus servicios y horarios de atención.\n3. Probá el bot con tus datos reales.\n\nTenés 14 días de prueba gratis, sin tarjeta. Explorá todo el sistema: página de reservas, agenda, gestión de pacientes y recordatorios.\n\n¿Dudas? Respondé a este email.\n\n¡Manos a la obra!\nAgendaPro`,
    });
    return Response.json({ sent: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}