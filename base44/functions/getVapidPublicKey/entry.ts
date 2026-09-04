import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// La clave pública VAPID no es secreta (viaja en el navegador de cualquier persona que se
// suscriba), pero igual la servimos autenticado por simplicidad — no hay ningún caso de uso
// hoy que la necesite sin sesión iniciada.
// (redespliegue 04/09/2026: el worker de backend estaba caido — "user worker not found")
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const cfgRows = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const publicKey = cfgRows?.[0]?.vapid_public_key || null;

    return Response.json({ publicKey });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
