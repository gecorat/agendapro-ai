// Acceso centralizado a los secretos separados de PracticeSettings/Professional (ver
// entidades PracticeSecrets/ProfessionalSecrets). Todo esto corre siempre con
// asServiceRole — nunca se expone al cliente ni se lee/escribe desde el frontend.

export async function getPracticeSecrets(base44, practiceId) {
  const rows = await base44.asServiceRole.entities.PracticeSecrets.filter({ practice_id: practiceId });
  return rows?.[0] || null;
}

export async function setPracticeSecrets(base44, practiceId, data) {
  const existing = await getPracticeSecrets(base44, practiceId);
  if (existing) return base44.asServiceRole.entities.PracticeSecrets.update(existing.id, data);
  return base44.asServiceRole.entities.PracticeSecrets.create({ practice_id: practiceId, ...data });
}

export async function getProfessionalSecrets(base44, professionalId) {
  const rows = await base44.asServiceRole.entities.ProfessionalSecrets.filter({ professional_id: professionalId });
  return rows?.[0] || null;
}

export async function setProfessionalSecrets(base44, professionalId, data) {
  const existing = await getProfessionalSecrets(base44, professionalId);
  if (existing) return base44.asServiceRole.entities.ProfessionalSecrets.update(existing.id, data);
  return base44.asServiceRole.entities.ProfessionalSecrets.create({ professional_id: professionalId, ...data });
}
