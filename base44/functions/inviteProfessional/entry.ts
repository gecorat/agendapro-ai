import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { syncProfessionalAddonBilling, CLINIC_FREE_PROFESSIONALS, PROFESSIONAL_ADDON_PRICE } from '../../shared/professional-billing.ts';
import { resolveScope } from '../../shared/team-scope.ts';

// Genera un enlace unico de invitacion para sumar un profesional al equipo. Los primeros
// 3 (CLINIC_FREE_PROFESSIONALS) estan incluidos en el plan Clinic; del 4to en adelante se
// cobra un addon fijo mensual (PROFESSIONAL_ADDON_PRICE) que se suma automaticamente al
// monto real de la suscripcion de Mercado Pago. Puede invitar el dueno real O un
// profesional promovido a co-admin (nunca uno normal).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope || !scope.canManageTeam) {
      return Response.json({ error: 'No tenes permiso para invitar profesionales' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const origin = body?.origin || 'https://kameagenda.com';

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: scope.practiceOwnerId });
    const practice = practices?.[0];
    if (!practice || practice.plan !== 'clinic') {
      return Response.json({ error: 'Esta funcion es solo para cuentas con plan Clinic' }, { status: 400 });
    }

    const existing = await base44.asServiceRole.entities.Professional.filter({ practice_owner_id: scope.practiceOwnerId });
    const isAddon = (existing || []).length >= CLINIC_FREE_PROFESSIONALS;

    const token = crypto.randomUUID().replace(/-/g, '');
    const professional = await base44.asServiceRole.entities.Professional.create({
      practice_owner_id: scope.practiceOwnerId,
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
