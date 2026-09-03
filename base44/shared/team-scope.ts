// Un profesional invitado por una cuenta Clinic tiene su PROPIO usuario de Base44, pero
// las citas/pacientes se guardan con professional_id = el DUEÑO de la cuenta (no el
// usuario invitado) — por diseño, para que todo el equipo quede agrupado bajo un mismo
// consultorio. Las reglas de acceso (RLS) solo saben comparar campos contra el usuario
// logueado directo, así que un invitado nunca matchea esa condición y quedaría viendo
// todo vacío. Esta función resuelve correctamente quién sos y arma el alcance correcto:
// - El dueño real ve TODO y puede tocar facturación/plan.
// - Un profesional invitado promovido a "co-admin" ve TODO como el dueño (pacientes,
//   citas, puede invitar gente, editar el consultorio) pero NUNCA factura ni cambia de
//   plan — eso queda exclusivo del dueño real.
// - Un profesional invitado normal ve SOLO lo suyo (professional_ref_id = su propio
//   registro de Professional).
import { findPracticeByOwner } from "./ownership.ts";
export async function resolveScope(base44, user) {
  // La búsqueda va por el criterio de propiedad real (owner_user_id con respaldo a
  // created_by_id). Antes acá se comparaba created_by_id directo, y como Base44 lo
  // estampa con el id del SERVICIO en todo lo que crea el onboarding, el dueño de una
  // cuenta nueva no se encontraba a sí mismo. Ver base44/shared/ownership.ts.
  const ownPractice = await findPracticeByOwner(base44, user.id);
  if (ownPractice) {
    return { practiceOwnerId: user.id, professionalRefId: null, isOwner: true, isTeamAdmin: false, canManageTeam: true, canManageBilling: true, isOwnerLike: true };
  }

  const profs = await base44.asServiceRole.entities.Professional.filter({ user_id: user.id });
  const myProfessional = profs?.[0];
  if (myProfessional) {
    const isTeamAdmin = !!myProfessional.is_team_admin;
    return {
      practiceOwnerId: myProfessional.practice_owner_id,
      professionalRefId: myProfessional.id,
      isOwner: false,
      isTeamAdmin,
      // Un co-admin ve todo el consultorio como si fuera el dueño, salvo facturación.
      canManageTeam: isTeamAdmin,
      canManageBilling: false,
      // "isOwnerLike" = alcance de lectura completo (dueño real O co-admin).
      isOwnerLike: isTeamAdmin,
    };
  }

  return null;
}
