import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Arranca la conexión rápida por QR (WasenderAPI): crea la sesión, la conecta, y devuelve
// el string del QR para que el frontend lo renderice como imagen.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    if (!practice) return Response.json({ error: 'No hay configuración de consultorio' }, { status: 400 });

    const { canUseWhatsApp } = await import('../../shared/plan.ts');
    if (!canUseWhatsApp(practice)) {
      return Response.json({ error: 'plan_required', message: 'Tu plan actual no incluye el bot de WhatsApp. Necesitás el plan Pro o Clinic.' }, { status: 403 });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const pat = cfg?.[0]?.wasender_personal_access_token;
    if (!pat) return Response.json({ error: 'not_configured', message: 'La conexión por QR todavía no está configurada. Contactá al administrador.' }, { status: 400 });

    const phoneNumber = practice.phone || practice.professional_email || '+000000000';
    // La URL de webhook incluye el id del consultorio como query param: así identificamos
    // sin ambigüedad de quién es cada mensaje entrante, sin depender de que el payload de
    // WasenderAPI incluya un identificador propio (nos costó caro asumir mal el formato
    // exacto de un proveedor externo la primera vez, con Zernio).
    const webhookUrl = `https://base44.app/api/apps/6a726ce53f9d0f63f3816283/functions/wasenderWebhook?practiceId=${practice.id}`;

    const createRes = await fetch('https://www.wasenderapi.com/api/whatsapp-sessions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: `Kame Agenda - ${practice.practice_name || user.email}`,
        phone_number: phoneNumber,
        account_protection: true,
        log_messages: true,
        read_incoming_messages: false,
        webhook_url: webhookUrl,
        webhook_enabled: true,
        webhook_events: ['messages.received', 'session.status'],
        ignore_groups: true,
        ignore_channels: true,
        ignore_broadcasts: true,
      }),
    });
    const createData = await createRes.json().catch(() => ({}));
    if (!createRes.ok || !createData?.success) {
      return Response.json({ error: createData?.message || 'No se pudo crear la sesión de WhatsApp' }, { status: 400 });
    }

    const session = createData.data;

    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      whatsapp_connection_type: 'qr',
      wasender_session_id: String(session.id),
      wasender_api_key: session.api_key,
      wasender_webhook_secret: session.webhook_secret,
      whatsapp_status: 'connecting',
      whatsapp_connected: false,
    });

    const connectRes = await fetch(`https://www.wasenderapi.com/api/whatsapp-sessions/${session.id}/connect`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pat}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const connectData = await connectRes.json().catch(() => ({}));
    if (!connectRes.ok || !connectData?.success) {
      return Response.json({ error: connectData?.message || 'No se pudo iniciar la conexión' }, { status: 400 });
    }

    const qrCode = connectData.data?.qrCode || null;
    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      whatsapp_status: qrCode ? 'need_scan' : (connectData.data?.status || 'connecting').toLowerCase(),
    });

    return Response.json({ qrCode, status: connectData.data?.status || 'NEED_SCAN' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
