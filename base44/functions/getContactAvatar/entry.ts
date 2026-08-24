import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { fetchProfilePicture } from '../../shared/evolution-api.ts';

// Trae la foto de perfil REAL de WhatsApp del contacto vía Evolution API. La URL que
// devuelve WhatsApp es temporal (vence), así que se pide fresca cada vez que se abre la
// ficha en vez de guardarla fija en la base — guardarla generaría fotos rotas al rato.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const phone = (body?.phone || '').replace(/\D/g, '');
    if (!phone) return Response.json({ error: 'phone requerido' }, { status: 400 });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    // Solo disponible para conexión por QR (Evolution API). La API oficial de Zernio/Meta
    // no expone este dato de la misma forma, así que devolvemos vacío y el frontend cae
    // al avatar con inicial.
    if (practice?.whatsapp_connection_type !== 'qr' || !practice?.evolution_instance_name) {
      return Response.json({ imgUrl: null });
    }

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const baseUrl = (cfg?.[0]?.evolution_base_url || '').replace(/\/$/, '');
    const apiKey = cfg?.[0]?.evolution_api_key;
    if (!baseUrl || !apiKey) return Response.json({ imgUrl: null });

    const imgUrl = await fetchProfilePicture(baseUrl, apiKey, practice.evolution_instance_name, phone);
    return Response.json({ imgUrl });
  } catch (error) {
    return Response.json({ imgUrl: null, error: error.message }, { status: 200 });
  }
}
