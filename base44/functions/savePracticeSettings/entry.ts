import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

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
  'bot_enabled', 'bot_paused_until', 'google_review_link',
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
    const existing = scope
      ? await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: scope.practiceOwnerId })
      : [];
    const current = existing?.[0];

    if (scope && !scope.canManageTeam) {
      return Response.json({ error: "No tenes permiso para editar la configuracion del consultorio" }, { status: 403 });
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
