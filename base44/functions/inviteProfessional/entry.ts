import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncProfessionalAddonBilling, CLINIC_FREE_PROFESSIONALS, PROFESSIONAL_ADDON_PRICE } from '../../shared/professional-billing.ts';

// Genera un enlace \u00fanico de invitaci\u00f3n para sumar un profesional al equipo. Los primeros
// 3 (CLINIC_FREE_PROFESSIONALS) est\u00e1n incluidos en el plan Clinic; del 4to en adelante se
// cobra un addon fijo mensual (PROFESSIONAL_ADDON_PRICE) que se suma autom\u00e1ticamente al
// monto real de la suscripci\u00f3n de Mercado Pago.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const origin = body?.origin || 'https://kameagenda.com';

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    if (!practice || practice.plan !== 'clinic') {
      return Response.json({ error: 'Esta funci\u00f3n es solo para cuentas con plan Clinic' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.Professional.filter({ practice_owner_id: user.id });
    const isAddon = (existing || []).length >= CLINIC_FREE_PROFESSIONALS;

    const token = crypto.randomUUID().replace(/-/g, '');
    const professional = await base44.asServiceRole.entities.Professional.create({
      practice_owner_id: user.id,
      first_name: '',
      invite_token: token,
      invite_status: 'pending',
      is_paid_addon: isAddon,
      active: false,
    });

    let billing = null;
    if (isAddon) {
      billing = await syncProfessionalAddonBilling(base44, practice);
    }

    return Response.json({
      link: `${origin}/invitacion/${token}`,
      professionalId: professional.id,
      isAddon,
      addonPrice: PROFESSIONAL_ADDON_PRICE,
      billing,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
