import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPlatformConfig, listZernioAccounts, findWhatsAppAccount, extractWhatsAppPhone } from "../../shared/zernio.ts";
import { findPracticeByOwner } from "../../shared/ownership.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const practice = await findPracticeByOwner(base44, user.id);
    if (!practice) return Response.json({ error: 'No hay configuración de consultorio' }, { status: 400 });

    const profileId = practice.zernio_profile_id;
    if (!profileId) return Response.json({ error: 'No hay un perfil de Zernio iniciado. Volvé a empezar la conexión.' }, { status: 400 });

    const plat = await getPlatformConfig(base44);
    const apiKey = plat?.zernio_api_key;
    if (!apiKey) return Response.json({ error: 'El administrador aún no configuró el proveedor de WhatsApp' }, { status: 400 });

    const accounts = await listZernioAccounts(apiKey);
    const account = findWhatsAppAccount(accounts, profileId);
    if (!account) return Response.json({ pending: true });

    const accountId = account._id || account.id || "";
    const phone = extractWhatsAppPhone(account);

    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      zernio_account_id: accountId,
      zernio_phone: phone,
      whatsapp_connected: true,
    });

    return Response.json({ connected: true, phone });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}