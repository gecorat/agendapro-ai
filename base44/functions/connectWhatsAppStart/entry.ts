import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPlatformConfig, createZernioProfile, getWhatsAppConnectUrl } from "../../shared/zernio.ts";
import { canUseWhatsApp } from "../../shared/plan.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    if (!practice) return Response.json({ error: 'No hay configuración de consultorio' }, { status: 400 });

    // El frontend ya oculta este botón si el plan no incluye WhatsApp, pero eso no evita
    // que alguien llame a esta función directamente. Sin este chequeo, cualquier cuenta
    // (incluso trial/basic) podía conectar WhatsApp gratis.
    if (!canUseWhatsApp(practice)) {
      return Response.json({ error: 'plan_required', message: 'Tu plan actual no incluye el bot de WhatsApp. Necesitás el plan Pro o Clinic.' }, { status: 403 });
    }

    const plat = await getPlatformConfig(base44);
    const apiKey = plat?.zernio_api_key;
    if (!apiKey) return Response.json({ error: 'El administrador aún no configuró el proveedor de WhatsApp' }, { status: 400 });

    let profileId = practice.zernio_profile_id;
    if (!profileId) {
      const name = practice.practice_name || `Profesional ${(user.id || "").slice(-6)}`;
      const description = `Kame Agenda - ${practice.handle || user.email || user.id}`;
      profileId = await createZernioProfile(apiKey, name, description);
      if (!profileId) return Response.json({ error: 'No se pudo crear el perfil en Zernio' }, { status: 502 });
      await base44.asServiceRole.entities.PracticeSettings.update(practice.id, { zernio_profile_id: profileId });
    }

    const origin = new URL(req.url).origin;
    const redirectUrl = (plat?.app_base_url || origin) + '/whatsapp/callback';
    const authUrl = await getWhatsAppConnectUrl(apiKey, profileId, redirectUrl);

    return Response.json({ authUrl });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}