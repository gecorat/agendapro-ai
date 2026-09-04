// LA HORA DE KAME ES SIEMPRE LA DE ARGENTINA. PUNTO.
//
// Espejo de src/lib/timezone.js (el del frontend). Este archivo es la UNICA definicion de
// zona horaria del backend: si cambia una, cambiar la otra.
//
// Por que hace falta: las funciones corren en Deno, en un servidor que NO esta en huso
// argentino (en la practica, UTC). Un `.getHours()`, `.getMonth()`, `.setHours()` o un
// `.toLocaleString("es-AR", ...)` SIN `timeZone` devuelven la hora del SERVIDOR, no la del
// consultorio. Eso ya rompio cosas reales: el bot rechazaba un turno de las 14:45 porque
// leia el limite de las 18:00 en UTC, y el aviso de "bot pausado hasta las HH:mm" mostraba
// tres horas de mas.
//
// Regla para todo el codigo nuevo del backend: NUNCA usar getHours/getDay/getDate/
// setHours/getMonth ni toLocale* sin timeZone sobre una fecha de negocio. Usar esto.
//
// Argentina no tiene horario de verano desde 2009: el offset es fijo -03:00.

export const AR_TZ = 'America/Argentina/Buenos_Aires';
export const AR_OFFSET = '-03:00';
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, '0');

// Componentes de reloj de pared ARGENTINOS de un instante.
export function argentinaParts(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() - AR_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-11
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(), // 0 = domingo
  };
}

// "YYYY-MM-DD" del dia argentino de este instante.
export function argentinaYMD(date) {
  const p = argentinaParts(date);
  if (!p) return '';
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

export function argentinaDayOfWeek(date) {
  return argentinaParts(date)?.weekday ?? 0;
}

export function argentinaDayOfMonth(date) {
  return argentinaParts(date)?.day ?? 1;
}

export function argentinaMonth(date) {
  return argentinaParts(date)?.month ?? 0;
}

export function argentinaYear(date) {
  return argentinaParts(date)?.year ?? 1970;
}

// Instante correspondiente a una hora de pared argentina.
export function argentinaDate(year, month, day, hour = 0, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute, second, ms) + AR_OFFSET_MS);
}

export function argentinaStartOfDay(date) {
  const p = argentinaParts(date);
  if (!p) return new Date(NaN);
  return argentinaDate(p.year, p.month, p.day);
}

export function argentinaEndOfDay(date) {
  const p = argentinaParts(date);
  if (!p) return new Date(NaN);
  return argentinaDate(p.year, p.month, p.day, 23, 59, 59, 999);
}

export function argentinaEndOfMonth(date) {
  const p = argentinaParts(date);
  if (!p) return new Date(NaN);
  return argentinaDate(p.year, p.month + 1, 0, 23, 59, 59, 999);
}

export function argentinaDaysInMonth(date) {
  return argentinaDayOfMonth(argentinaEndOfMonth(date));
}

export function isSameArgentinaDay(a, b) {
  const ya = argentinaYMD(a);
  return !!ya && ya === argentinaYMD(b);
}

// "HH:mm" argentino — el formato de Availability.start_time/end_time.
export function argentinaTimeString(date) {
  const p = argentinaParts(date);
  if (!p) return '';
  return `${pad(p.hour)}:${pad(p.minute)}`;
}

// Formateo para mensajes al paciente / al profesional. SIEMPRE con timeZone: sin esa
// opcion, "es-AR" define el idioma pero la hora sale en la del servidor, que se lee
// perfecto en castellano y esta mal — la peor combinacion, porque no parece un error.
export function formatArTime(date, opts = {}) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, ...opts, timeZone: AR_TZ });
}

export function formatArDateTime(date, opts = {}) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('es-AR', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', hour12: false,
    ...opts,
    timeZone: AR_TZ,
  });
}
