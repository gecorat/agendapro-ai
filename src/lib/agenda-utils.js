import {
  argentinaParts, argentinaYMD, isSameArgentinaDay, formatArTime, formatArDate,
} from "@/lib/timezone";

// Toda la agenda razona en HORA ARGENTINA (ver src/lib/timezone.js). Antes estas funciones
// usaban el huso del navegador (`toDateString`, `getHours`, `toLocaleTimeString` sin
// timeZone), asi que desde un dispositivo con otra zona horaria las citas aparecian el dia
// equivocado y con la hora corrida respecto de lo que el bot y los recordatorios avisaban.

export const statusConfig = {
  pending: { label: "Pendiente", dot: "bg-amber-500", text: "text-amber-700", bgSoft: "bg-amber-50", border: "border-amber-200" },
  confirmed: { label: "Confirmada", dot: "bg-emerald-500", text: "text-emerald-700", bgSoft: "bg-emerald-50", border: "border-emerald-200" },
  cancelled: { label: "Cancelada", dot: "bg-rose-400", text: "text-rose-500", bgSoft: "bg-rose-50", border: "border-rose-200", strike: true },
  completed: { label: "Completada", dot: "bg-sky-500", text: "text-sky-700", bgSoft: "bg-sky-50", border: "border-sky-200" },
  no_show: { label: "Ausencia", dot: "bg-slate-400", text: "text-slate-500", bgSoft: "bg-slate-50", border: "border-slate-200" },
  // Eventos importados de Google Calendar en modo solo-lectura (ver getGoogleAgendaEvents).
  // No son citas reales de Kame, por eso llevan un estilo bien distinto (violeta) y en las
  // vistas se les desactivan las acciones de editar/cancelar.
  google: { label: "Google", dot: "bg-violet-400", text: "text-violet-600", bgSoft: "bg-violet-50", border: "border-violet-200" },
};

export const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

export function apptsForDay(appts, date) {
  const ymd = argentinaYMD(date);
  return (appts || [])
    .filter((a) => argentinaYMD(a.start_datetime) === ymd)
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
}

export function formatTime(date) {
  return formatArTime(date);
}

export function formatDayHeading(date) {
  return formatArDate(date, { weekday: "long", day: "numeric", month: "long" });
}

export function isSameDay(a, b) {
  return isSameArgentinaDay(a, b);
}

// Posición vertical (0-1) del momento actual dentro del rango HOURS, para la línea de
// "ahora" en las vistas de día/semana. Devuelve null si la hora actual cae fuera del rango.
export function nowOffsetRatio() {
  const now = argentinaParts(new Date());
  const totalMinutes = (now.hour - HOURS[0]) * 60 + now.minute;
  const rangeMinutes = HOURS.length * 60;
  if (totalMinutes < 0 || totalMinutes > rangeMinutes) return null;
  return totalMinutes / rangeMinutes;
}