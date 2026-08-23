import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildAuthUrl } from '../../shared/google-calendar.ts';
import { resolveScope } from '../../shared/team-scope.ts';

// Genera la URL de autorización de Google para ESTA persona puntual (el dueño de la
// cuenta, o un profesional invitado conectando SU PROPIO calendario). El "state" lleva
// quién es, para que el callback sepa dónde guardar los tokens cuando Google responda.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const origin = body?.origin || 'https://kameagenda.com';

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ error: 'No se encontró tu consultorio' }, { status: 400 });

    const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
    const clientId = cfg?.[0]?.google_client_id;
    if (!clientId) return Response.json({ error: 'Google Calendar no está configurado todavía' }, { status: 400 });

    const statePayload = {
      userId: user.id,
      professionalRefId: scope.professionalRefId || null,
      nonce: crypto.randomUUID(),
      ts: Date.now(),
    };
    const state = btoa(JSON.stringify(statePayload));

    const redirectUri = `${origin}/google-calendar-callback`;
    const url = buildAuthUrl({ clientId, redirectUri, state });

    return Response.json({ url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
