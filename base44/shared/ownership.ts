// QUIÉN ES EL DUEÑO DE UN CONSULTORIO.
//
// Hasta el 3/9/2026 la propiedad se deducía de `created_by_id`, el campo que estampa
// Base44 al crear un registro. Eso dejó de funcionar cuando el onboarding pasó a crear
// con rol de servicio (necesario, porque la RLS de PracticeSettings bloquea el create de
// usuarios comunes): Base44 estampa al que EJECUTA la llamada, o sea el servidor, e
// IGNORA cualquier created_by_id que le mandemos — verificado en vivo, tanto en create
// como en update.
//
// Consecuencia: las cuentas creadas por el onboarding quedaban con
// created_by_id = "service_<uuid>", que es el MISMO para todas. O sea que no solo el
// dueño no se reconocía a sí mismo (getMyPractice no encontraba su consultorio y lo
// mandaba de vuelta al onboarding), sino que además dos cuentas rotas compartían clave:
// filtrar por ese id devolvía los servicios y horarios de todas mezclados.
//
// Solución: campos de propiedad PROPIOS, que la plataforma no toca.
//   - PracticeSettings.owner_user_id
//   - Service.practice_owner_id       (Availability ya lo tenía)
//
// `created_by_id` queda como RESPALDO para todas las cuentas anteriores, que lo tienen
// bien. Por eso este cambio no necesita migrar nada: las cuentas sanas siguen resolviendo
// igual que antes.

// Id del dueño de un consultorio. Nunca leer practice.created_by_id directo: usar esto.
export function ownerIdOf(practice) {
  return practice?.owner_user_id || practice?.created_by_id || null;
}

// El consultorio de un usuario. Primero por el campo propio; si no hay, por el que
// estampa la plataforma (cuentas anteriores al cambio).
export async function findPracticeByOwner(base44, ownerId) {
  if (!ownerId) return null;
  const byOwn = await base44.asServiceRole.entities.PracticeSettings.filter({ owner_user_id: ownerId });
  if (byOwn?.[0]) return byOwn[0];
  const byCreated = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: ownerId });
  return byCreated?.[0] || null;
}

// Filas de una entidad que pertenecen a un consultorio (Service / Availability), mirando
// el campo propio y, como respaldo, el de la plataforma. Se deduplica por id porque una
// fila vieja ya adoptada puede matchear las dos consultas.
export async function findOwnedRows(base44, entityName, ownerId, extraFilter = {}) {
  if (!ownerId) return [];
  const [byOwn, byCreated] = await Promise.all([
    base44.asServiceRole.entities[entityName].filter({ ...extraFilter, practice_owner_id: ownerId }),
    base44.asServiceRole.entities[entityName].filter({ ...extraFilter, created_by_id: ownerId }),
  ]);
  const seen = new Map();
  for (const row of [...(byOwn || []), ...(byCreated || [])]) {
    if (row?.id && !seen.has(row.id)) seen.set(row.id, row);
  }
  return [...seen.values()];
}

// ¿Esta fila (Service / Availability) pertenece a este consultorio?
export function rowBelongsTo(row, ownerId) {
  if (!row || !ownerId) return false;
  return row.practice_owner_id === ownerId || (!row.practice_owner_id && row.created_by_id === ownerId);
}
