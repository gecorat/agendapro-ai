import { formatArTime } from "@/lib/timezone";

// Mismo criterio que base44/shared/bot-status.ts del lado del servidor — si se cambia acá,
// cambiar ahí también. Se calcula al vuelo (sin escribir nada) para que el switch/badge
// siempre muestre el estado real, incluso si el bot_paused_until ya venció y nadie volvió
// a tocar la configuración desde entonces.
export function getBotPauseStatus(settings) {
  const enabled = settings?.bot_enabled !== false;
  if (enabled) return { paused: false };

  const untilRaw = settings?.bot_paused_until;
  if (!untilRaw) return { paused: true, indefinite: true, until: null };

  const until = new Date(untilRaw);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return { paused: false, expired: true };
  }
  return { paused: true, indefinite: false, until };
}

export function formatRemaining(until) {
  const diff = until.getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  return `${h > 0 ? h + "h " : ""}${m}m`;
}

export function formatClockTime(d) {
  return formatArTime(d);
}
