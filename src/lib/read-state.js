import { base44 } from "@/api/base44Client";

// Estado de "visto/leído" del usuario logueado, guardado en el servidor (entidad
// UserReadState) para que se sincronice entre sus dispositivos. Antes esto vivía solo en
// el localStorage de cada navegador, así que abrir la campanita o un chat en la PC no lo
// marcaba como visto en el celular (y viceversa).
//
// El localStorage se sigue usando como caché local: permite pintar el contador correcto
// apenas carga la pantalla, sin esperar el ida y vuelta con el servidor, y sirve de
// respaldo si la request falla.

const BELL_KEY = "kameagenda_bell_last_seen";
const CHAT_KEY = "kameagenda_chat_last_read";

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* modo privado / sin espacio: no es crítico */ }
}

export function getLocalBellLastSeen() {
  const v = readLocal(BELL_KEY, null);
  return typeof v === "string" ? v : null;
}

export function getLocalChatLastRead() {
  const v = readLocal(CHAT_KEY, {});
  return v && typeof v === "object" ? v : {};
}

async function getRow() {
  try {
    const rows = await base44.entities.UserReadState.filter({});
    return rows?.[0] || null;
  } catch {
    return null;
  }
}

// Trae el estado del servidor y lo fusiona con lo que haya en este dispositivo. La fusión
// siempre se queda con la fecha MÁS RECIENTE de cada lado: así, si leíste algo en el
// celular estando sin conexión en la PC, no se "des-lee" al sincronizar.
export async function loadReadState() {
  const localBell = getLocalBellLastSeen();
  const localChat = getLocalChatLastRead();
  const row = await getRow();
  if (!row) return { bellLastSeen: localBell, chatLastRead: localChat, rowId: null };

  const remoteBell = row.bell_last_seen_at || null;
  let remoteChat = {};
  try {
    remoteChat = row.chat_last_read_json ? JSON.parse(row.chat_last_read_json) : {};
  } catch { remoteChat = {}; }

  const bellLastSeen = [localBell, remoteBell].filter(Boolean).sort().pop() || null;

  const chatLastRead = { ...remoteChat };
  for (const [phone, at] of Object.entries(localChat)) {
    if (!chatLastRead[phone] || new Date(at) > new Date(chatLastRead[phone])) {
      chatLastRead[phone] = at;
    }
  }

  writeLocal(BELL_KEY, bellLastSeen);
  writeLocal(CHAT_KEY, chatLastRead);
  return { bellLastSeen, chatLastRead, rowId: row.id };
}

async function persist(rowId, patch) {
  try {
    if (rowId) {
      await base44.entities.UserReadState.update(rowId, patch);
      return rowId;
    }
    const me = await base44.auth.me();
    const created = await base44.entities.UserReadState.create({ user_id: me?.id, ...patch });
    return created?.id || null;
  } catch {
    // Sin conexión o error del servidor: el localStorage ya quedó actualizado, así que la
    // pantalla se comporta bien igual y la próxima sincronización lo sube.
    return rowId;
  }
}

export async function saveBellLastSeen(rowId, isoDate) {
  writeLocal(BELL_KEY, isoDate);
  return persist(rowId, { bell_last_seen_at: isoDate });
}

export async function saveChatLastRead(rowId, map) {
  writeLocal(CHAT_KEY, map);
  return persist(rowId, { chat_last_read_json: JSON.stringify(map) });
}
