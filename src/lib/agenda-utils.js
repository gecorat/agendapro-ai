export const statusConfig = {
  pending: { label: "Pendiente", bg: "bg-amber-50 border-amber-300 text-amber-800", dot: "bg-amber-500" },
  confirmed: { label: "Confirmada", bg: "bg-emerald-50 border-emerald-300 text-emerald-800", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelada", bg: "bg-red-50 border-red-300 text-red-800 line-through", dot: "bg-red-500" },
  completed: { label: "Completada", bg: "bg-blue-50 border-blue-300 text-blue-800", dot: "bg-blue-500" },
  no_show: { label: "Ausencia", bg: "bg-gray-50 border-gray-300 text-gray-800", dot: "bg-gray-500" },
};

export const HOURS = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

export function apptsForDay(appts, date) {
  return (appts || [])
    .filter((a) => new Date(a.start_datetime).toDateString() === date.toDateString())
    .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
}