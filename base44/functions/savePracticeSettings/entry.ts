import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';
import { findPracticeByOwner } from '../../shared/ownership.ts';
import { validateHandle } from '../../shared/handle.ts';

// Único camino legítimo para que un profesional edite su propio perfil de consultorio.
// PracticeSettings.update/create quedaron bloqueados por RLS para todos salvo admins
// (ver base44/entities/PracticeSettings.jsonc), así que esta función con rol de servicio
// es la que realmente escribe — y solo deja pasar una lista explícita de campos. Nada
// relacionado con plan, suspensión, uso o credenciales de Zernio puede colarse acá, sin
// importar qué mande el cliente en el body.
const EDITABLE_FIELDS = [
  'professional_type', 'practice_name', 'specialty', 'address', 'address_city', 'address_province', 'address_lat', 'address_lng', 'phone',
  'professional_email', 'instagram_url', 'facebook_url', 'website_url', 'handle', 'photo_url', 'avatar_url', 'cover_image_url',
  'photo_align', 'photo_frame', 'cover_align',
  'page_color', 'page_color_secondary', 'theme_preset', 'heading_font_override', 'description', 'published',
  'custom_bg_pattern', 'custom_bg_image_url', 'custom_bg_overlay_opacity', 'custom_border_radius', 'custom_card_opacity', 'custom_blur_enabled',
  'avatar_border_radius', 'show_reviews_public',
  'bot_objective_prompt', 'bot_tone_prompt', 'bot_response_delay_seconds', 'bot_assistant_name', 'bot_persona_mode', 'bot_required_patient_fields', 'owner_display_name',
  'bot_enabled', 'bot_paused_until', 'google_review_link', 'auto_confirm_public_bookings',
  'reminders_enabled',
  // Lo escribe BotPreview al gastar un mensaje del simulador. Faltaba en la lista, asi que
  // se descartaba en silencio: el contador nunca subia, el tope de mensajes de la demo no
  // se alcanzaba nunca (uso ilimitado del modelo) y el paso "Proba el bot" de la guia no
  // se marcaba jamas como completado.
  'bot_preview_count',
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const input = body?.data || {};

    const safeData: Record<string, unknown> = {};
    for (const key of EDITABLE_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(input, key)) {
        safeData[key] = input[key];
      }
    }

    const scope = await resolveScope(base44, user);
    const current = scope ? await findPracticeByOwner(base44, scope.practiceOwnerId) : null;

    if (scope && !scope.canManageTeam) {
      return Response.json({ error: "No tenes permiso para editar la configuracion del consultorio" }, { status: 403 });
    }

    // El handle es la URL publica del consultorio: se normaliza y valida ACA, que es lo
    // unico que el cliente no puede saltear. Antes se guardaba practicamente tal cual y
    // quedaron handles con mayusculas y emojis, que dan un link que no se puede dictar.
    // Ademas se chequea que no lo tenga ya otro consultorio: el handle resuelve con un
    // filter exacto que devuelve la primera fila, asi que dos iguales significaban que uno
    // de los dos profesionales perdia su pagina publica sin enterarse.
    if (Object.prototype.hasOwnProperty.call(safeData, 'handle')) {
      const check = validateHandle(safeData.handle);
      if (!check.ok) {
        return Response.json({ error: check.reason }, { status: 400 });
      }
      // La unicidad se chequea solo si hay handle: varias cuentas pueden convivir sin uno.
      const taken = check.handle
        ? await base44.asServiceRole.entities.PracticeSettings.filter({ handle: check.handle })
        : [];
      const otherOwner = (taken || []).find((p) => p.id !== current?.id);
      if (otherOwner) {
        return Response.json(
          { error: `El usuario publico "${check.handle}" ya esta en uso. Proba con otro.` },
          { status: 409 }
        );
      }
      safeData.handle = check.handle;
    }

    if (current) {
      const updated = await base44.asServiceRole.entities.PracticeSettings.update(current.id, safeData);
      return Response.json({ settings: updated });
    }

    // Alta nueva: acá SÍ fijamos plan/trial con valores del servidor, ignorando cualquier
    // valor que el cliente haya intentado mandar para esos campos protegidos.
    const trialEnds = new Date();
    trialEnds.setDate(trialEnds.getDate() + 14);
    const created = await base44.asServiceRole.entities.PracticeSettings.create({
      ...safeData,
      // El dueño va en un campo nuestro: Base44 pisa created_by_id con el id del servicio
      // (ver base44/shared/ownership.ts).
      owner_user_id: user.id,
      plan: 'trial',
      trial_ends_at: trialEnds.toISOString(),
      trial_origin: 'landing',
      suspended: false,
    });
    return Response.json({ settings: created });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
