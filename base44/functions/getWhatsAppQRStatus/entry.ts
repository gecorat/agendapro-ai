import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getConnectionState, getConnectedPhone } from '../../shared/evolution-api.ts';

// Polling de estado para la conexión por QR (Evolution API). El frontend llama esto cada
// 2-3 segundos mientras espera que el usuario escanee.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    if (!practice?.evolution_instance_name) {
      return Response.json({ error: 'No hay una sesión de WhatsApp iniciada' }, { status: 400 });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const baseUrl = (cfg?.[0]?.evolution_base_url || '').replace(/\/$/, '');
    const apiKey = cfg?.[0]?.evolution_api_key;
    if (!baseUrl || !apiKey) return Response.json({ error: 'not_configured' }, { status: 400 });

    const rawState = await getConnectionState(baseUrl, apiKey, practice.evolution_instance_name);
    // Evolution usa 'open' para conectado; normalizamos a los mismos valores que ya
    // usaba el resto de la app (need_scan / connecting / connected / disconnected).
    const connected = rawState === 'open';
    const status = connected ? 'connected' : (rawState === 'close' ? 'disconnected' : (practice.whatsapp_status || 'connecting'));

    let phoneNumber = practice.whatsapp_phone_number;
    if (connected && !phoneNumber) {
      phoneNumber = await getConnectedPhone(baseUrl, apiKey, practice.evolution_instance_name);
    }

    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      whatsapp_status: status,
      whatsapp_connected: connected,
      ...(phoneNumber ? { whatsapp_phone_number: phoneNumber } : {}),
    });

    return Response.json({ status, connected, phoneNumber: phoneNumber || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
