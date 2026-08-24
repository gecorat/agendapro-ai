import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { DEFAULT_OBJECTIVE_PROMPT, DEFAULT_TONE_PROMPT, DEFAULT_RESPONSE_DELAY_SECONDS, RESPONSE_DELAY_OPTIONS } from '../../shared/bot-defaults.ts';

// Le da al frontend los valores predeterminados del bot (prompt de objetivo, de tono, y
// demora de respuesta) directo desde la ÚNICA fuente de verdad (shared/bot-defaults.ts),
// para que la pantalla de "Configurar bot" nunca tenga una copia del texto por su cuenta
// que se pueda desincronizar del que realmente usa el agente al responder.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    return Response.json({
      objectivePrompt: DEFAULT_OBJECTIVE_PROMPT,
      tonePrompt: DEFAULT_TONE_PROMPT,
      responseDelaySeconds: DEFAULT_RESPONSE_DELAY_SECONDS,
      responseDelayOptions: RESPONSE_DELAY_OPTIONS,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
