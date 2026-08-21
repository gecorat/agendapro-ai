import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Acción explícita y auditable para desconectar WhatsApp, en vez de dejar que el cliente
// escriba directo los campos de conexión de Zernio (bloqueados por RLS para no-admins).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const existing = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user.id });
    const practice = existing?.[0];
    if (!practice) return Response.json({ error: 'No hay configuración de consultorio' }, { status: 400 });

    // Si estaba conectado por QR, también le avisamos a WasenderAPI que cierre la sesión
    // (best-effort: si falla, igual limpiamos nuestro lado para no dejar al usuario
    // trabado viendo "conectado" cuando ya no puede usarlo).
    if (practice.whatsapp_connection_type === 'qr' && practice.wasender_session_id) {
      try {
        const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
        const pat = cfg?.[0]?.wasender_personal_access_token;
        if (pat) {
          await fetch(`https://www.wasenderapi.com/api/whatsapp-sessions/${practice.wasender_session_id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${pat}` },
          });
        }
      } catch (e) {
        console.error('wasender disconnect error:', e?.message || e);
      }
    }

    const updated = await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      whatsapp_connected: false,
      whatsapp_connection_type: null,
      whatsapp_status: 'disconnected',
      whatsapp_phone_number: '',
      zernio_account_id: '',
      zernio_phone: '',
      wasender_session_id: '',
      wasender_api_key: '',
      wasender_webhook_secret: '',
    });
    return Response.json({ settings: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
