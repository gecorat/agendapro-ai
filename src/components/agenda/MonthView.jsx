import React from "react";
import { Plus } from "lucide-react";
import { statusConfig, apptsForDay, formatTime } from "@/lib/agenda-utils";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MAX_VISIBLE = 3;

export default function MonthView({ currentDate, appts, onNew, onEdit, onDayClick }) {
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
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{d}</div>
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
            <div
              key={i}
              role="button"
              onClick={() => onDayClick(date)}
              className={`group relative min-h-[112px] p-1.5 text-left cursor-pointer transition-colors
                ${!isLastCol ? "border-r border-border" : ""} ${!isLastRow ? "border-b border-border" : ""}
                ${!inMonth ? "bg-muted/20" : "hover:bg-muted/40"}`}
            >
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium
                    ${isToday ? "bg-primary text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/40"}`}
                >
                  {date.getDate()}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onNew(date); }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity w-5 h-5 rounded-full flex items-center justify-center hover:bg-muted text-muted-foreground"
                  title="Agregar turno"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-0.5">
                {dayAppts.slice(0, MAX_VISIBLE).map((a) => {
                  const cfg = statusConfig[a.status] || statusConfig.pending;
                  return (
                    <button
                      key={a.id}
                      onClick={(e) => { e.stopPropagation(); onEdit(a); }}
                      className="w-full flex items-center gap-1 text-left rounded px-1 py-0.5 text-[10.5px] hover:bg-muted transition-colors"
                    >
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                      <span className="tabular-nums text-muted-foreground shrink-0">{formatTime(new Date(a.start_datetime))}</span>
                      <span className={`truncate ${cfg.strike ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.patient_name}</span>
                    </button>
                  );
                })}
                {dayAppts.length > MAX_VISIBLE && (
                  <p className="text-[10.5px] text-muted-foreground px-1 font-medium">+{dayAppts.length - MAX_VISIBLE} más</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
