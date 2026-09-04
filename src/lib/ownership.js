// Espejo de base44/shared/ownership.ts para el frontend — mantener ambos en sync.
//
// Base44 estampa `created_by_id` con el id de QUIEN EJECUTA el create e ignora el valor
// que le mandemos. Desde que el onboarding crea con rol de servicio, ese campo vale
// "service_<uuid>" — el mismo para todas las cuentas nuevas. Por eso la propiedad real
// vive en `owner_user_id` (PracticeSettings) y `practice_owner_id` (Service, Availability),
// con el campo de la plataforma como respaldo para las cuentas anteriores al 3/9/2026.

// Handle publico (la URL del consultorio) normalizado a algo escribible y compartible:
// minusculas, sin tildes, sin "@" y solo [a-z0-9-_]. Espejo de normalizeHandle en
// base44/shared/handle.ts, que es la que manda: el servidor vuelve a aplicarla al guardar.
export function normalizeHandle(raw) {
  return normalizeHandleTyping(raw).replace(/^-+|-+$/g, "");
}

// Versión para aplicar MIENTRAS se escribe. Es igual pero sin recortar los guiones del
// final: con el recorte, tipear "dr-martinez" era imposible porque el guión desaparecía
// apenas se escribía. Al guardar se aplica normalizeHandle, que sí lo recorta.
export function normalizeHandleTyping(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-");
}

// El respaldo por created_by_id SOLO vale para ids de personas reales: los registros
// creados con rol de servicio llevan "service_<uuid>" (el mismo para todas las cuentas) y
// los de la página pública llevan "anonymous". Espejo de isRealUserId en ownership.ts.
export function isRealUserId(id) {
  return !!id && typeof id === "string" && id !== "anonymous" && !id.startsWith("service_");
}

export function ownerIdOf(practice) {
  return practice?.owner_user_id || practice?.created_by_id || null;
}

// Une las filas propias (practice_owner_id) con las de respaldo (created_by_id) de una
// entidad Service/Availability, sin mezclar las de otro dueño. Espejo de findOwnedRows.
export function mergeOwnedRows(byOwner, byCreated, ownerId) {
  const byId = new Map();
  for (const row of byOwner || []) {
    if (row?.id && !byId.has(row.id)) byId.set(row.id, row);
  }
  if (isRealUserId(ownerId)) {
    for (const row of byCreated || []) {
      if (!row?.id || byId.has(row.id)) continue;
      if (row.practice_owner_id && row.practice_owner_id !== ownerId) continue;
      byId.set(row.id, row);
    }
  }
  return [...byId.values()];
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
