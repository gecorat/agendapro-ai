import React from "react";
import { statusConfig, apptsForDay } from "@/lib/agenda-utils";

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];
const MAX_DOTS = 4;

// Estética tipo "calendario simple + puntos": cada celda solo muestra el número de día y
// puntitos de color por turno (nunca texto), así nunca se desborda ni se rompe en mobile.
// Tocar cualquier día abre el detalle completo en el panel de abajo.
export default function MonthView({ currentDate, appts, onDayClick }) {
  const first = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const startDay = first.getDay();
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - startDay);

  const weeks = Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(gridStart);
      date.setDate(gridStart.getDate() + w * 7 + d);
      return date;
    })
  );

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((date, i) => {
          const inMonth = date.getMonth() === currentDate.getMonth();
          const isToday = date.toDateString() === new Date().toDateString();
          const dayAppts = apptsForDay(appts, date);
          const isLastCol = (i + 1) % 7 === 0;
          const isLastRow = i >= 35;
          return (
            <button
              key={i}
              onClick={() => onDayClick(date)}
              className={`relative flex flex-col items-center gap-1.5 py-2.5 sm:py-3.5 transition-colors
                ${!isLastCol ? "border-r border-border" : ""} ${!isLastRow ? "border-b border-border" : ""}
                ${!inMonth ? "bg-muted/20" : "hover:bg-muted/40 active:bg-muted/60"}`}
            >
              <span
                className={`inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full text-[13px] sm:text-sm font-medium transition-colors
                  ${isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/40"}`}
              >
                {date.getDate()}
              </span>
              <div className="flex items-center justify-center gap-[3px] h-[6px]">
                {dayAppts.slice(0, MAX_DOTS).map((a) => {
                  const cfg = statusConfig[a.status] || statusConfig.pending;
                  return <span key={a.id} className={`w-[5px] h-[5px] rounded-full ${cfg.dot}`} />;
                })}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
