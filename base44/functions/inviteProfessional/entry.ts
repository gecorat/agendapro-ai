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
    // professionalId opcional: invitar a alguien que YA existe, cargado con "Agregar
    // manual". Sin el, se crea una ficha nueva como siempre.
    const { professionalId } = body || {};

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: scope.practiceOwnerId });
    const practice = practices?.[0];
    if (!practice || practice.plan !== 'clinic') {
      return Response.json({ error: 'Esta funcion es solo para cuentas con plan Clinic' }, { status: 400 });
    }

    const token = crypto.randomUUID().replace(/-/g, '');

    // CASO A: darle acceso propio a un profesional que ya estaba cargado a mano.
    //
    // Ojo con lo que NO se toca aca:
    //  - is_paid_addon: ya se decidio cuando se lo creo. Recalcularlo podria cobrarle al
    //    dueno un adicional por alguien que ya estaba contado.
    //  - active: ya es agendable. Ponerlo en false (como si fuera una invitacion nueva) lo
    //    sacaria de la pagina publica y del bot mientras la invitacion esta pendiente.
    //  - invite_status: se deja en 'none'. PublicBooking descarta a los 'pending'
    //    (src/pages/PublicBooking.jsx), asi que marcarlo lo haria desaparecer del selector
    //    hasta que acepte. El token alcanza para que claimInvite lo encuentre.
    if (professionalId) {
      const rows = await base44.asServiceRole.entities.Professional.filter({ id: professionalId });
      const target = rows?.[0];
      if (!target || target.practice_owner_id !== scope.practiceOwnerId) {
        return Response.json({ error: 'Ese profesional no es de tu consultorio' }, { status: 404 });
      }
      if (target.user_id) {
        return Response.json({ error: `${target.first_name || 'Ese profesional'} ya tiene su cuenta activa` }, { status: 400 });
      }
      await base44.asServiceRole.entities.Professional.update(professionalId, { invite_token: token });
      return Response.json({
        link: `${origin}/invitacion/${token}`,
        professionalId,
        isAddon: !!target.is_paid_addon,
        addonPrice: PROFESSIONAL_ADDON_PRICE,
        billing: null,
        reinvited: true,
      });
    }

    // CASO B: invitacion nueva (comportamiento de siempre).
    const existing = await base44.asServiceRole.entities.Professional.filter({ practice_owner_id: scope.practiceOwnerId });
    const isAddon = (existing || []).length >= CLINIC_FREE_PROFESSIONALS;
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
