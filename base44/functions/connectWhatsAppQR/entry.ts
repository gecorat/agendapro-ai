import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { instanceNameFor, ensureInstance, connectInstance, getConnectionState, getConnectedPhone } from '../../shared/evolution-api.ts';
import { getPracticeSecrets, setPracticeSecrets } from '../../shared/secrets.ts';

function randomSecret() {
  return crypto.randomUUID().replace(/-/g, '');
}

// Arranca la conexión rápida por QR sobre Evolution API (self-hosted, vía VPS propio):
// crea (o reutiliza) la instancia de WhatsApp de este profesional y devuelve el string
// del QR para que el frontend lo renderice — misma respuesta que antes daba WasenderAPI,
// así el componente de conexión no necesitó cambiar.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Por el criterio de propiedad real (owner_user_id con respaldo a created_by_id):
    // comparar created_by_id a secas dejaba a toda cuenta creada por el onboarding sin
    // encontrar su propio consultorio. Ver base44/shared/ownership.ts.
    const practice = await findPracticeByOwner(base44, user.id);
    if (!practice) return Response.json({ error: 'No hay configuración de consultorio' }, { status: 400 });

    const { canUseWhatsApp } = await import('../../shared/plan.ts');
    if (!canUseWhatsApp(practice)) {
      return Response.json({ error: 'plan_required', message: 'Tu plan actual no incluye el bot de WhatsApp. Necesitás el plan Pro o Clinic.' }, { status: 403 });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const baseUrl = (cfg?.[0]?.evolution_base_url || '').replace(/\/$/, '');
    const apiKey = cfg?.[0]?.evolution_api_key;
    if (!baseUrl || !apiKey) {
      return Response.json({ error: 'not_configured', message: 'La conexión por QR todavía no está configurada. Contactá al administrador.' }, { status: 400 });
    }

    const instanceName = practice.evolution_instance_name || instanceNameFor(practice.id);
    const existingSecrets = await getPracticeSecrets(base44, practice.id);
    const webhookSecret = existingSecrets?.evolution_webhook_secret || randomSecret();
    // El id del consultorio Y un secreto propio (generado por nosotros, no por Evolution)
    // viajan en la URL del webhook — así lo verificamos sin depender de que el proveedor
    // firme el payload de alguna forma en particular. El secreto en sí vive en
    // PracticeSecrets (no en PracticeSettings), que tiene lectura pública por la página
    // de reservas — nunca en un campo que un desconocido pueda leer.
    const webhookUrl = `https://base44.app/api/apps/6a726ce53f9d0f63f3816283/functions/evolutionWebhook?practiceId=${practice.id}&secret=${webhookSecret}`;

    await ensureInstance(baseUrl, apiKey, instanceName, webhookUrl);
    await setPracticeSecrets(base44, practice.id, { evolution_webhook_secret: webhookSecret });

    // Si ya estaba conectada de un intento anterior que el polling no había detectado,
    // lo reflejamos directo sin volver a pedir QR.
    const currentState = await getConnectionState(baseUrl, apiKey, instanceName);
    if (currentState === 'open') {
      const phone = await getConnectedPhone(baseUrl, apiKey, instanceName);
      await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
        whatsapp_connection_type: 'qr',
        evolution_instance_name: instanceName,
        whatsapp_status: 'connected',
        whatsapp_connected: true,
        whatsapp_phone_number: phone || practice.whatsapp_phone_number || '',
      });
      return Response.json({ qrCode: null, status: 'ALREADY_CONNECTED', connected: true });
    }

    const { code, base64 } = await connectInstance(baseUrl, apiKey, instanceName);
    // Preferimos el string de "code" (se renderiza como QR del lado del cliente, igual
    // que antes). Si la instancia solo da la imagen ya armada, mandamos el data-URI
    // completo y el frontend detecta el prefijo "data:" para mostrarlo como <img>.
    const qrCode = code || base64 || null;

    await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      whatsapp_connection_type: 'qr',
      evolution_instance_name: instanceName,
      whatsapp_status: qrCode ? 'need_scan' : 'connecting',
      whatsapp_connected: false,
    });

    return Response.json({ qrCode, status: qrCode ? 'NEED_SCAN' : 'CONNECTING' });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
