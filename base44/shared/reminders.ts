import { canSendWhatsApp } from "./plan.ts";

export const PRACTICE_TZ = "America/Argentina/Buenos_Aires";

// Día calendario (YYYY-MM-DD) de una fecha, visto desde la zona horaria del consultorio.
// Sirve para decidir "hoy"/"mañana" y "¿se reservó otro día?" sin que el corte de
// medianoche UTC lo desalinee.
export function localDayKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PRACTICE_TZ, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

function localTime(d: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    timeZone: PRACTICE_TZ, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(d);
}

// Cuándo es la cita, en texto ANCLADO A LA HORA REAL en vez de a un margen relativo:
// "hoy a las 09:30", "mañana a las 09:30", "el martes 2 de septiembre a las 09:30".
//
// Por qué: el aviso lo dispara un cron que corre cada 15 minutos, así que el margen real
// nunca es exactamente 3hs — antes el texto decía "tu cita es en 3 horas" hardcodeado y
// llegaba, por ejemplo, 2h30 antes. La hora exacta no puede quedar desfasada nunca, sin
// importar en qué tick del cron salga el mensaje.
export function buildWhenLabel(start: Date, now: Date = new Date()): string {
  const startKey = localDayKey(start);
  const todayKey = localDayKey(now);
  const tomorrowKey = localDayKey(new Date(now.getTime() + 24 * 60 * 60 * 1000));
  const time = localTime(start);
  if (startKey === todayKey) return `hoy a las ${time}`;
  if (startKey === tomorrowKey) return `mañana a las ${time}`;
  const day = start.toLocaleString("es-AR", {
    weekday: "long", day: "numeric", month: "long", timeZone: PRACTICE_TZ,
  });
  return `el ${day} a las ${time}`;
}

// Fecha larga completa para la fila "Día y horario".
export function formatApptDate(d: Date): string {
  return d.toLocaleString("es-AR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    timeZone: PRACTICE_TZ,
  });
}

// ¿La cita se reservó ANTES del día en que ocurre?
//
// Es la condición para mandar recordatorios. Si el paciente reservó el mismo día del
// turno, ya recibió la confirmación con todos los datos hace unas horas: un recordatorio
// encima es repetir lo mismo dos veces. Los recordatorios existen para lo que se reservó
// con antelación y uno se puede llegar a olvidar.
export function bookedOnEarlierDay(created: Date, start: Date): boolean {
  if (isNaN(created.getTime()) || isNaN(start.getTime())) return false;
  return localDayKey(created) < localDayKey(start);
}

// Margen minimo entre la reserva y el turno para que tenga sentido mandar recordatorios.
// Reemplaza a la regla de "dia calendario anterior": esa dejaba sin aviso a quien reservaba
// a las 08:00 para las 20:00 del mismo dia (12 horas, tiempo de sobra para olvidarse) y en
// cambio si le avisaba a quien reservaba a las 23:00 para las 09:00 del dia siguiente (10
// horas). Contar horas reales es mas fiel a la idea de fondo: recordar lo que uno se puede
// llegar a olvidar. Aplica igual a email y a WhatsApp: la regla vive en reminderStage, que
// decide ANTES de elegir canal.
export const MIN_HOURS_BEFORE_FOR_REMINDERS = 12;

export function bookedWithEnoughMargin(created: Date, start: Date): boolean {
  if (isNaN(created.getTime()) || isNaN(start.getTime())) return false;
  return (start.getTime() - created.getTime()) >= MIN_HOURS_BEFORE_FOR_REMINDERS * 3600000;
}

// Un aviso que acaba de salir (confirmación de turno, aviso de reprogramación) ya lleva
// día, hora, servicio y dirección. Si el turno además cae dentro de la ventana de 3hs, el
// recordatorio que mandaría el cron minutos después dice exactamente lo mismo.
//
// Devuelve true cuando hay que dar los recordatorios por cubiertos: quien llama debe
// marcar reminders_sent = 2 (sin enviar nada). Antes acá vivía maybeSendImmediateReminder,
// que en vez de suprimir MANDABA un segundo par de mensajes — el paciente recibía cuatro
// mensajes casi iguales en un minuto.
export function remindersCoveredByNotice(appointment): boolean {
  const start = new Date(appointment?.start_datetime);
  if (isNaN(start.getTime())) return false;
  if ((appointment?.reminders_sent || 0) > 0) return false;
  const hoursUntil = (start.getTime() - Date.now()) / 3600000;
  return hoursUntil > 0 && hoursUntil <= 3;
}

// Qué canales corresponden para este paciente. "both" significa BOTH: antes esto era un
// if/else — si WhatsApp estaba conectado se mandaba SOLO WhatsApp y el email nunca salía,
// aunque el paciente hubiera pedido explícitamente los dos.
export function resolveChannels(practice, patient) {
  const pref = patient?.contact_preference || "email";
  const wantsWhatsApp = pref === "whatsapp" || pref === "both";
  const wantsEmail = pref === "email" || pref === "both";
  return {
    whatsapp: wantsWhatsApp && !!patient?.phone && canSendWhatsApp(practice),
    email: wantsEmail && !!patient?.email,
    // Si el canal preferido no está disponible (sin WhatsApp conectado, o sin teléfono),
    // igual le mandamos por el otro con tal de que el aviso llegue.
    emailFallback: !!patient?.email,
  };
}

// El recordatorio por WhatsApp, en UN SOLO mensaje.
//
// Antes eran dos seguidos (un "Te paso los detalles..." y después el bloque de datos),
// copiando el ritmo conversacional del bot. En un aviso automático eso no se lee como una
// conversación: se lee como dos notificaciones para la misma cosa. Va también SIN el link
// de Google Maps — ese pertenece a la confirmación inicial del turno, no al recordatorio.
export function buildReminderWhatsAppMessage({ patientName, whenLabel, dateStr, serviceName, professionalName, address }): string {
  const firstName = (patientName || "").trim().split(/\s+/)[0] || "";
  return [
    `Hola${firstName ? ` ${firstName}` : ""}! 👋 Quería recordarte que tu cita es *${whenLabel}*.`,
    "",
    `📅 *Día y horario:* ${dateStr}`,
    `🩺 *Servicio:* ${serviceName}`,
    professionalName ? `👤 *Profesional:* ${professionalName}` : null,
    address ? `📍 *Dirección:* ${address}` : null,
    "",
    "🔁 *Si necesitás reagendar o cancelar, avisanos por este mismo medio* 😊",
  ].filter(Boolean).join("\n");
}
