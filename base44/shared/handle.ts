// EL HANDLE PUBLICO ES UNA URL.
//
// Es lo que va en kameagenda.com/u/<handle>: el profesional lo dicta por telefono, lo
// manda por WhatsApp y lo pone en su bio de Instagram. Hasta ahora se guardaba casi tal
// cual (solo se le sacaban el "@" y los espacios en el editor), asi que quedaron handles
// con mayusculas y hasta con emojis — verificado en produccion: "Alisadosjazz❤️". Ese
// link es imposible de dictar, muchas apps lo cortan al autoenlazarlo y no sobrevive a un
// copiar/pegar entre sistemas.
//
// Esta es la unica definicion que manda: savePracticeSettings la vuelve a aplicar sobre lo
// que llega del cliente, asi que una pestaña vieja o una llamada directa a la API tampoco
// pueden guardar un handle roto. El espejo para el frontend esta en src/lib/ownership.js
// (normalizeHandle), que la aplica mientras se escribe para que el profesional vea el link
// final antes de guardar.
export function normalizeHandle(raw) {
  return String(raw || "")
    .trim()
    .replace(/^@+/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // tildes y diacriticos
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Handles que no se pueden usar porque chocan con rutas propias de la app o con nombres
// reservados. Sin esto, alguien podia reservar "api" o "admin" y quedarse con una URL que
// deberia ser del sistema.
const RESERVED = new Set([
  "admin", "api", "app", "auth", "login", "logout", "signup", "register",
  "u", "x", "reschedule", "cancel", "settings", "home", "agenda", "bot",
  "kame", "kameagenda", "soporte", "support", "help", "ayuda", "null", "undefined",
]);

// ¿Este handle se puede guardar? Devuelve el handle normalizado o un motivo de rechazo.
export function validateHandle(raw) {
  const handle = normalizeHandle(raw);
  if (!handle) return { ok: false, reason: "El usuario publico no puede quedar vacio." };
  if (handle.length < 3) return { ok: false, reason: "El usuario publico necesita al menos 3 caracteres." };
  if (handle.length > 40) return { ok: false, reason: "El usuario publico no puede superar los 40 caracteres." };
  if (RESERVED.has(handle)) return { ok: false, reason: `"${handle}" es un nombre reservado. Elegi otro.` };
  return { ok: true, handle };
}
