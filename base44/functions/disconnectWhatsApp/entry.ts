import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { deleteInstance } from '../../shared/evolution-api.ts';
import { setPracticeSecrets } from '../../shared/secrets.ts';

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

    // Si estaba conectado por QR, también le avisamos a Evolution API que borre la
    // instancia (best-effort: si falla, igual limpiamos nuestro lado para no dejar al
    // usuario trabado viendo "conectado" cuando ya no puede usarlo).
    if (practice.whatsapp_connection_type === 'qr' && practice.evolution_instance_name) {
      try {
        const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
        const baseUrl = (cfg?.[0]?.evolution_base_url || '').replace(/\/$/, '');
        const apiKey = cfg?.[0]?.evolution_api_key;
        if (baseUrl && apiKey) {
          await deleteInstance(baseUrl, apiKey, practice.evolution_instance_name);
        }
      } catch (e) {
        console.error('evolution disconnect error:', e?.message || e);
      }
    }

    const updated = await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
      whatsapp_connected: false,
      whatsapp_connection_type: null,
      whatsapp_status: 'disconnected',
      whatsapp_phone_number: '',
      zernio_account_id: '',
      zernio_phone: '',
      evolution_instance_name: '',
    });
    await setPracticeSecrets(base44, practice.id, { evolution_webhook_secret: '' });
    return Response.json({ settings: updated });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
