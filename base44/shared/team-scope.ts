// Un profesional invitado por una cuenta Clinic tiene su PROPIO usuario de Base44, pero
// las citas/pacientes se guardan con professional_id = el DUEÑO de la cuenta (no el
// usuario invitado) — por diseño, para que todo el equipo quede agrupado bajo un mismo
// consultorio. Las reglas de acceso (RLS) solo saben comparar campos contra el usuario
// logueado directo, así que un invitado nunca matchea esa condición y quedaría viendo
// todo vacío. Esta función resuelve correctamente quién sos (dueño o invitado) y arma el
// alcance correcto: el dueño ve TODO el consultorio, un invitado ve SOLO lo suyo
// (professional_ref_id = su propio registro de Professional).
export async function resolveScope(base44, user) {
  const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
  const ownPractice = practices.find((p) => p.created_by_id === user.id);
  if (ownPractice) {
    return { practiceOwnerId: user.id, professionalRefId: null, isOwner: true };
  }

  const profs = await base44.asServiceRole.entities.Professional.filter({ user_id: user.id });
  const myProfessional = profs?.[0];
  if (myProfessional) {
    return { practiceOwnerId: myProfessional.practice_owner_id, professionalRefId: myProfessional.id, isOwner: false };
  }

  return null;
}
