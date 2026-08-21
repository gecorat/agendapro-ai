import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Polling de estado para la conexión por QR. El frontend llama esto cada 2-3 segundos
// mientras espera que el usuario escanee.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    if (!practice?.wasender_session_id) {
      return Response.json({ error: 'No hay una sesión de WhatsApp iniciada' }, { status: 400 });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const pat = cfg?.[0]?.wasender_personal_access_token;
    if (!pat) return Response.json({ error: 'not_configured' }, { status: 400 });

    // El endpoint "/status" que usábamos antes no existe (404 confirmado en vivo) — la
    // documentación nunca dio esa URL literal, la inferíamos mal por patrón. El endpoint de
    // detalle de sesión sí existe y ya trae status + teléfono juntos en una sola llamada.
    const detailRes = await fetch(`https://www.wasenderapi.com/api/whatsapp-sessions/${practice.wasender_session_id}`, {
      headers: { Authorization: `Bearer ${pat}` },
    });
    const detailData = await detailRes.json().catch(() => ({}));
    const status = (detailData?.data?.status || '').toLowerCase();
    const phoneNumber = detailData?.data?.phone_number || practice.whatsapp_phone_number;
    const connected = status === 'connected';

    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      whatsapp_status: status || practice.whatsapp_status,
      whatsapp_connected: connected,
      ...(phoneNumber ? { whatsapp_phone_number: phoneNumber } : {}),
    });

    return Response.json({ status, connected, phoneNumber: phoneNumber || null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
