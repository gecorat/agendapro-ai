// Espejo de base44/shared/ownership.ts para el frontend — mantener ambos en sync.
//
// Base44 estampa `created_by_id` con el id de QUIEN EJECUTA el create e ignora el valor
// que le mandemos. Desde que el onboarding crea con rol de servicio, ese campo vale
// "service_<uuid>" — el mismo para todas las cuentas nuevas. Por eso la propiedad real
// vive en `owner_user_id` (PracticeSettings) y `practice_owner_id` (Service, Availability),
// con el campo de la plataforma como respaldo para las cuentas anteriores al 3/9/2026.

export function ownerIdOf(practice) {
  return practice?.owner_user_id || practice?.created_by_id || null;
}

// Índice de consultorios por usuario dueño. Usar esto en vez de agrupar por
// created_by_id: si no, todas las cuentas nuevas colapsan en una sola clave.
export function indexPracticesByOwner(practices) {
  const map = {};
  for (const p of practices || []) {
    const id = ownerIdOf(p);
    if (id) map[id] = p;
  }
  return map;
}
