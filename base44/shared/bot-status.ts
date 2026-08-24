// Calcula si el bot está pausado AHORA MISMO, sin depender de ningún cron/proceso en
// segundo plano: si bot_paused_until ya venció, se lo trata como reactivado al vuelo (la
// fila en la base sigue diciendo bot_enabled=false hasta que alguien la toque, pero el
// comportamiento real — acá y en el frontend — ya es "activo"). Mismo criterio usado en
// src/lib/bot-status.js del lado del cliente; si se cambia acá, cambiar ahí también.
export function getBotPauseStatus(practice) {
  const enabled = practice?.bot_enabled !== false;
  if (enabled) return { paused: false };

  const untilRaw = practice?.bot_paused_until;
  if (!untilRaw) return { paused: true, indefinite: true, until: null };

  const until = new Date(untilRaw);
  if (Number.isNaN(until.getTime()) || until.getTime() <= Date.now()) {
    return { paused: false, expired: true };
  }
  return { paused: true, indefinite: false, until };
}
