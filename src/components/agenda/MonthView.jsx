import React from "react";
import { statusConfig, apptsForDay, formatTime } from "@/lib/agenda-utils";

const WEEKDAYS = ["D", "L", "M", "M", "J", "V", "S"];
const MAX_PILLS = 3;
const NAVY = "#1C2541";

// Reemplazamos los puntitos de color por píldoras legibles (hora + nombre), coloreadas
// según estado — mucho más útil de un vistazo que un punto sin información. Las celdas
// son más altas para que entren 2-3 píldoras sin desbordar.
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
      <div className="grid grid-cols-7 border-b border-border" style={{ background: `${NAVY}0d` }}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} className="py-2.5 text-center text-[11px] font-medium uppercase tracking-wide" style={{ color: NAVY, opacity: 0.7 }}>{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((date, i) => {
          const inMonth = date.getMonth() === currentDate.getMonth();
          const isToday = date.toDateString() === new Date().toDateString();
          const dayAppts = apptsForDay(appts, date);
          const isLastCol = (i + 1) % 7 === 0;
          const isLastRow = i >= 35;
          const extra = dayAppts.length - MAX_PILLS;
          return (
            <button
              key={i}
              onClick={() => onDayClick(date)}
              className={`relative flex flex-col items-stretch gap-1 py-2 px-1.5 min-h-[92px] sm:min-h-[110px] text-left transition-colors
                ${!isLastCol ? "border-r border-border" : ""} ${!isLastRow ? "border-b border-border" : ""}
                ${!inMonth ? "bg-muted/20" : "hover:bg-muted/30 active:bg-muted/50"}`}
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold self-start"
                style={isToday ? { background: NAVY, color: "#fff" } : { color: inMonth ? undefined : "rgba(100,116,139,0.4)" }}
              >
                {date.getDate()}
              </span>
              <div className="flex flex-col gap-1 mt-0.5 overflow-hidden">
                {dayAppts.slice(0, MAX_PILLS).map((a) => {
                  const cfg = statusConfig[a.status] || statusConfig.pending;
                  return (
                    <div
                      key={a.id}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] leading-tight font-medium truncate ${cfg.bgSoft} ${cfg.text} ${cfg.strike ? "line-through opacity-70" : ""}`}
                      title={`${formatTime(new Date(a.start_datetime))} · ${a.patient_name}`}
                    >
                      {formatTime(new Date(a.start_datetime))} {a.patient_name}
                    </div>
                  );
                })}
                {extra > 0 && (
                  <div className="px-1.5 text-[10px] font-medium text-muted-foreground">+{extra} más</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
