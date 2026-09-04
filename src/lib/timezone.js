// LA HORA DE KAME ES SIEMPRE LA DE ARGENTINA. PUNTO.
//
// Kame es un producto para profesionales de Argentina: un turno "a las 15:00" es a las
// 15:00 en Argentina, sin importar donde este parado el que mira la pantalla. Todo el
// backend ya trabajaba asi (base44/shared/scheduling.ts ancla a -03:00), pero el frontend
// del profesional usaba el huso del NAVEGADOR: `new Date(...).getHours()`,
// `.toLocaleTimeString()`, `.setHours(0,0,0,0)`, `.toDateString()`. Mientras el
// profesional estuviera fisicamente en Argentina las dos cosas coincidian por casualidad;
// desde un celular con otra zona horaria configurada, de viaje, o con el reloj del
// sistema en otro huso, la agenda mostraba los turnos corridos y el formulario los
// guardaba corridos.
//
// Esta es la UNICA definicion de zona horaria del frontend. Regla para todo el codigo
// nuevo: NUNCA usar getHours/getDay/getDate/setHours/toDateString/toLocale* pelados sobre
// una fecha de negocio (un turno, un dia de agenda, un rango de reportes). Usar los
// helpers de este archivo.
//
// Argentina no tiene horario de verano desde 2009: el offset es fijo -03:00. Por eso la
// aritmetica usa el offset fijo (igual que el backend) y el formateo usa Intl con la zona
// nombrada, que da los nombres de dia y mes correctos en castellano.

export const AR_TZ = "America/Argentina/Buenos_Aires";
export const AR_OFFSET = "-03:00";
const AR_OFFSET_MS = 3 * 60 * 60 * 1000;

const pad = (n) => String(n).padStart(2, "0");

// Los componentes de reloj de pared ARGENTINOS de un instante. Se corre el instante por el
// offset y despues se leen los campos UTC: asi los numeros que salen son los que se ven en
// un reloj en Buenos Aires, sin depender del huso del dispositivo.
export function argentinaParts(date) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const shifted = new Date(d.getTime() - AR_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(), // 0-11, igual que Date
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
    weekday: shifted.getUTCDay(), // 0 = domingo
  };
}

// "YYYY-MM-DD" del dia argentino al que pertenece este instante. Es la clave para agrupar
// citas por dia: dos instantes con el mismo YMD argentino son el mismo dia en la agenda.
export function argentinaYMD(date) {
  const p = argentinaParts(date);
  if (!p) return "";
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}`;
}

// Dia de la semana argentino (0 = domingo .. 6 = sabado). Es el mismo criterio que usa
// Availability.day_of_week, que el backend calcula en hora argentina.
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

// Construye el instante correspondiente a una hora de pared argentina.
export function argentinaDate(year, month, day, hour = 0, minute = 0, second = 0, ms = 0) {
  return new Date(Date.UTC(year, month, day, hour, minute, second, ms) + AR_OFFSET_MS);
}

// Medianoche argentina del dia al que pertenece este instante.
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

// Los dos extremos del dia argentino. Es lo que hay que mandarle al backend cuando se pide
// "las citas de este dia": con `setHours(0,0,0,0)` del navegador, un profesional en otro
// huso pedia una ventana corrida y le faltaban o le sobraban las citas del borde.
export function argentinaDayBounds(date) {
  return { start: argentinaStartOfDay(date), end: argentinaEndOfDay(date) };
}

// Suma dias calendario ARGENTINOS conservando la hora de pared. Sumar 86.400.000 ms a
// secas no es lo mismo, pero como Argentina no tiene horario de verano aca coincide; se
// hace igual por componentes para que siga siendo correcto si eso alguna vez cambiara.
export function addArgentinaDays(date, days) {
  const p = argentinaParts(date);
  if (!p) return new Date(NaN);
  return argentinaDate(p.year, p.month, p.day + days, p.hour, p.minute, p.second);
}

export function addArgentinaMonths(date, months) {
  const p = argentinaParts(date);
  if (!p) return new Date(NaN);
  return argentinaDate(p.year, p.month + months, p.day, p.hour, p.minute, p.second);
}

// Inicio de semana argentino. `mondayStart` define si la semana arranca lunes (criterio de
// las estadisticas de facturacion) o domingo (criterio de la grilla de la Agenda).
export function argentinaStartOfWeek(date, { mondayStart = false } = {}) {
  const start = argentinaStartOfDay(date);
  const dow = argentinaDayOfWeek(start);
  const back = mondayStart ? (dow + 6) % 7 : dow;
  return addArgentinaDays(start, -back);
}

export function argentinaStartOfMonth(date) {
  const p = argentinaParts(date);
  if (!p) return new Date(NaN);
  return argentinaDate(p.year, p.month, 1);
}

// Ultimo instante del mes argentino.
export function argentinaEndOfMonth(date) {
  const p = argentinaParts(date);
  if (!p) return new Date(NaN);
  return argentinaDate(p.year, p.month + 1, 0, 23, 59, 59, 999);
}

export function argentinaDaysInMonth(date) {
  return argentinaDayOfMonth(argentinaEndOfMonth(date));
}

// ¿Los dos instantes caen el MISMO dia argentino? Reemplaza a `toDateString() ===
// toDateString()`, que compara en el huso del navegador.
export function isSameArgentinaDay(a, b) {
  const ya = argentinaYMD(a);
  return !!ya && ya === argentinaYMD(b);
}

export function isArgentinaToday(date) {
  return isSameArgentinaDay(date, new Date());
}

// ---- Formateo para pantalla ----------------------------------------------------------
// Todos fuerzan timeZone: AR_TZ. Un `toLocaleString("es-AR", ...)` sin esa opcion usa
// es-AR para el IDIOMA pero el huso del dispositivo para la HORA: se ve en castellano y
// con el horario equivocado, que es la peor combinacion porque no parece un error.

export function formatArTime(date, opts = {}) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", ...opts, timeZone: AR_TZ });
}

export function formatArDate(date, opts = { day: "numeric", month: "long" }) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es-AR", { ...opts, timeZone: AR_TZ });
}

export function formatArDateTime(date, opts = {}) {
  const d = new Date(date);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleString("es-AR", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
    ...opts,
    timeZone: AR_TZ,
  });
}

// ---- Campos <input type="datetime-local"> ---------------------------------------------
// El input no maneja zonas: entrega y espera un texto "YYYY-MM-DDTHH:mm" sin offset. Estas
// dos funciones son las que hacen que ese texto SIEMPRE signifique hora argentina, tanto
// al pintarlo como al guardarlo. Sin esto, el formulario de la Agenda leia y escribia en
// el huso del navegador: un turno cargado como "15:00" desde un dispositivo en otro huso
// se guardaba a otra hora, y el bot y los recordatorios (que sí anclan a -03:00) avisaban
// una hora distinta de la que el profesional habia visto en pantalla.

export function toArgentinaInputValue(date) {
  const p = argentinaParts(date);
  if (!p) return "";
  return `${p.year}-${pad(p.month + 1)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

export function fromArgentinaInputValue(value) {
  if (!value) return new Date(NaN);
  const text = String(value).trim();
  // Si ya trae offset o "Z", se respeta: es un instante completo, no una hora de pared.
  if (/(Z|[+-]\d{2}:\d{2})$/.test(text)) return new Date(text);
  const withSeconds = text.length === 16 ? `${text}:00` : text;
  return new Date(`${withSeconds}${AR_OFFSET}`);
}

// "HH:mm" argentino de un instante — el formato que usan Availability.start_time/end_time
// y los payloads de reagendado del bot.
export function argentinaTimeString(date) {
  const p = argentinaParts(date);
  if (!p) return "";
  return `${pad(p.hour)}:${pad(p.minute)}`;
}
