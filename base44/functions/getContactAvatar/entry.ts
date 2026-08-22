import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Trae la foto de perfil REAL de WhatsApp del contacto (confirmado en vivo: WasenderAPI
// expone GET /api/contacts/{numero}/picture). La URL que devuelve WhatsApp es temporal
// (vence), así que se pide fresca cada vez que se abre la ficha en vez de guardarla fija
// en la base — guardarla generaría fotos rotas al rato.
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
    // Solo confirmado para WasenderAPI (QR). La API oficial de Zernio/Meta no expone este
    // dato de la misma forma, así que devolvemos vacío y el frontend cae al avatar inicial.
    if (practice?.whatsapp_connection_type !== 'qr' || !practice?.wasender_api_key) {
      return Response.json({ imgUrl: null });
    }

    const res = await fetch(`https://www.wasenderapi.com/api/contacts/${phone}/picture`, {
      headers: { Authorization: `Bearer ${practice.wasender_api_key}` },
    });
    if (!res.ok) return Response.json({ imgUrl: null });
    const data = await res.json().catch(() => ({}));
    return Response.json({ imgUrl: data?.data?.imgUrl || null });
  } catch (error) {
    return Response.json({ imgUrl: null, error: error.message }, { status: 200 });
  }
}
