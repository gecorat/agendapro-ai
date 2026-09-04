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

// El respaldo por created_by_id SOLO vale para ids de personas reales. Los registros
// creados con rol de servicio llevan "service_<uuid>" (el MISMO para todas las cuentas) y
// los de la página pública llevan "anonymous": filtrar por esos valores mezcla las filas de
// consultorios distintos. Verificado en vivo: hay 15 filas de Availability de 3 cuentas
// diferentes compartiendo created_by_id = "service_38f44a12-...".
function isRealUserId(id) {
  return !!id && typeof id === "string" && id !== "anonymous" && !id.startsWith("service_");
}

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
  if (!isRealUserId(ownerId)) return null;
  const byCreated = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: ownerId });
  // Del respaldo se descartan las filas que YA declaran otro dueño: si una fila tiene
  // owner_user_id de otra persona, que created_by_id coincida es una casualidad (el mismo
  // servicio o admin la creó), no propiedad. Sin este filtro, una fila así podía
  // devolverse como el consultorio de alguien que no es su dueño.
  return (byCreated || []).find((p) => !p.owner_user_id || p.owner_user_id === ownerId) || null;
}

// Igual que findPracticeByOwner pero devolviendo ARRAY. Existe para poder reemplazar de
// forma mecánica los viejos `entities.PracticeSettings.filter({ created_by_id: X })` sin
// tocar el `?.[0]` / `.length` que viene después en cada llamador.
export async function findPracticeRowsByOwner(base44, ownerId) {
  const found = await findPracticeByOwner(base44, ownerId);
  return found ? [found] : [];
}

// Filas de una entidad que pertenecen a un consultorio (Service / Availability), mirando
// el campo propio y, como respaldo, el de la plataforma. Se deduplica por id porque una
// fila vieja ya adoptada puede matchear las dos consultas.
export async function findOwnedRows(base44, entityName, ownerId, extraFilter = {}) {
  if (!ownerId) return [];
  const [byOwn, byCreated] = await Promise.all([
    base44.asServiceRole.entities[entityName].filter({ ...extraFilter, practice_owner_id: ownerId }),
    isRealUserId(ownerId)
      ? base44.asServiceRole.entities[entityName].filter({ ...extraFilter, created_by_id: ownerId })
      : Promise.resolve([]),
  ]);
  const seen = new Map();
  for (const row of byOwn || []) {
    if (row?.id && !seen.has(row.id)) seen.set(row.id, row);
  }
  // Del respaldo se descartan las filas que YA declaran otro dueno (misma razon que en
  // findPracticeByOwner: created_by_id compartido entre cuentas creadas por el servicio).
  for (const row of byCreated || []) {
    if (!row?.id || seen.has(row.id)) continue;
    if (row.practice_owner_id && row.practice_owner_id !== ownerId) continue;
    seen.set(row.id, row);
  }
  return [...seen.values()];
}

// ¿Esta fila (Service / Availability) pertenece a este consultorio?
export function rowBelongsTo(row, ownerId) {
  if (!row || !ownerId) return false;
  if (row.practice_owner_id) return row.practice_owner_id === ownerId;
  return isRealUserId(ownerId) && row.created_by_id === ownerId;
}
