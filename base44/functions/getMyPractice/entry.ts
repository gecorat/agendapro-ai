import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// El consultorio del usuario logueado, sea el dueno o un profesional invitado, mas su
// propia ficha de Professional si es invitado.
//
// Existe para poder cerrar la lectura de PracticeSettings (hoy rls read: {}, o sea publica
// para cualquiera sin cuenta). El caso que la RLS NO puede expresar es el del invitado: su
// consultorio es el del dueno que lo invito, y una regla RLS solo sabe comparar campos
// contra el usuario logueado — "soy Professional de ese consultorio" no se puede escribir
// ahi. resolveScope si lo resuelve, y es el mismo criterio que ya usan getScopedPatients,
// getScopedAppointments, getScopedServices y getScopedAvailability.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Camino del dueno primero, igual que resolveScope: si tiene consultorio propio, ese es.
    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user.id });
    if (practices?.[0]) {
      return Response.json({ practice: practices[0], professional: null, isOwner: true });
    }

    // Invitado: su consultorio es el de quien lo invito.
    const scope = await resolveScope(base44, user);
    if (!scope?.practiceOwnerId) {
      // Usuario sin consultorio propio ni invitacion aceptada. No es un error: es alguien
      // que todavia no completo el onboarding. La pantalla lo redirige.
      return Response.json({ practice: null, professional: null, isOwner: false });
    }

    const ownerPractices = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: scope.practiceOwnerId });
    let professional = null;
    if (scope.professionalRefId) {
      const rows = await base44.asServiceRole.entities.Professional.filter({ id: scope.professionalRefId });
      professional = rows?.[0] || null;
    }

    return Response.json({
      practice: ownerPractices?.[0] || null,
      professional,
      isOwner: false,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
