import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getGoogleBusyRanges } from '../../shared/google-calendar.ts';

// Pública (sin auth) -- la llama la página de reserva pública para saber qué franjas
// están ocupadas en el Google Calendar de quien atiende, y así no ofrecerlas como
// horario disponible. Esto es lo que hace que un evento personal en Google (una consulta
// médica propia, unas vacaciones cargadas ahí, lo que sea) bloquee la reserva sin que
// haga falta cargarlo dos veces.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { professional_id, professional_ref_id, date_from, date_to } = body || {};
    if (!professional_id || !date_from || !date_to) {
      return Response.json({ busy: [] });
    }
    const busy = await getGoogleBusyRanges(base44, professional_id, professional_ref_id || null, date_from, date_to);
    return Response.json({ busy });
  } catch (error) {
    // Si Google falla por lo que sea, mejor no bloquear la reserva -- se devuelve vacío.
    console.error('[getGoogleBusySlots] error', error?.message || error);
    return Response.json({ busy: [] });
  }
}
