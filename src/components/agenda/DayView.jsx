import React from "react";
import { Plus, CalendarX2 } from "lucide-react";
import { statusConfig, apptsForDay, formatTime } from "@/lib/agenda-utils";

// Lista de agenda (solo los horarios que tienen turnos, no una grilla de 14 horas vacías)
// con un marcador de "ahora" en su posición cronológica si es el día de hoy.
export default function DayView({ date, appts, onNew, onEdit }) {
  const dayAppts = apptsForDay(appts, date);
  const isToday = date.toDateString() === new Date().toDateString();
  const now = new Date();

  const items = [];
  let nowInserted = !isToday;
  dayAppts.forEach((a) => {
    if (!nowInserted && new Date(a.start_datetime) > now) {
      items.push({ type: "now" });
      nowInserted = true;
    }
    items.push({ type: "appt", data: a });
  });
  if (!nowInserted) items.push({ type: "now" });

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <div className="border-b border-border px-4 py-3 flex items-center justify-between bg-muted/30">
        <div>
          <span className="text-sm font-heading font-semibold capitalize">
            {date.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          {dayAppts.length > 0 && (
            <span className="ml-2 text-xs text-muted-foreground">{dayAppts.length} turno{dayAppts.length > 1 ? "s" : ""}</span>
          )}
        </div>
        <button onClick={() => onNew(date)} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80 transition-opacity">
          <Plus className="w-4 h-4" /> Agregar
        </button>
      </div>

      {dayAppts.length === 0 ? (
        <div className="flex flex-col items-center justify-center text-center py-16 px-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
            <CalendarX2 className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">No hay turnos agendados este día.</p>
        </div>
      ) : (
        <div className="p-3 space-y-1.5">
          {items.map((item) => {
            if (item.type === "now") {
              return (
                <div key="now" className="flex items-center gap-2 py-1">
                  <span className="text-[10px] font-semibold text-rose-500 tabular-nums w-12 shrink-0 text-right pr-1">{formatTime(now)}</span>
                  <div className="flex-1 h-px bg-rose-500/40" />
                </div>
              );
            }
            const a = item.data;
            const cfg = statusConfig[a.status] || statusConfig.pending;
            return (
              <button
                key={a.id}
                onClick={() => !a.is_google && onEdit(a)}
                disabled={a.is_google}
                className={`w-full text-left rounded-xl border-l-[3px] ${cfg.border} bg-card shadow-sm transition-all px-3 py-2.5 ${a.is_google ? "cursor-default" : "hover:shadow-md hover:-translate-y-px"}`}
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground w-12 shrink-0">{formatTime(new Date(a.start_datetime))}</span>
                  <span className={`text-sm font-semibold truncate ${cfg.strike ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.patient_name}</span>
                  <span className={`ml-auto text-[10.5px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${cfg.bgSoft} ${cfg.text}`}>{cfg.label}</span>
                </div>
                <p className="text-xs text-muted-foreground pl-14 truncate">{a.service_name}</p>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
