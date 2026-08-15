export const statusConfig = {
  pending: { label: "Pendiente", dot: "bg-amber-500", text: "text-amber-700", bgSoft: "bg-amber-50", border: "border-amber-200" },
  confirmed: { label: "Confirmada", dot: "bg-emerald-500", text: "text-emerald-700", bgSoft: "bg-emerald-50", border: "border-emerald-200" },
  cancelled: { label: "Cancelada", dot: "bg-rose-400", text: "text-rose-500", bgSoft: "bg-rose-50", border: "border-rose-200", strike: true },
  completed: { label: "Completada", dot: "bg-sky-500", text: "text-sky-700", bgSoft: "bg-sky-50", border: "border-sky-200" },
  no_show: { label: "Ausencia", dot: "bg-slate-400", text: "text-slate-500", bgSoft: "bg-slate-50", border: "border-slate-200" },
};

export const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

export function apptsForDay(appts, date) {
  return (appts || [])
    .filter((a) => new Date(a.start_datetime).toDateString() === date.toDateString())
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
}

export function formatTime(date) {
  return date.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDayHeading(date) {
  return date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export function isSameDay(a, b) {
  return a.toDateString() === b.toDateString();
}

// Posición vertical (0-1) del momento actual dentro del rango HOURS, para la línea de
// "ahora" en las vistas de día/semana. Devuelve null si la hora actual cae fuera del rango.
export function nowOffsetRatio() {
  const now = new Date();
  const totalMinutes = (now.getHours() - HOURS[0]) * 60 + now.getMinutes();
  const rangeMinutes = HOURS.length * 60;
  if (totalMinutes < 0 || totalMinutes > rangeMinutes) return null;
  return totalMinutes / rangeMinutes;
}