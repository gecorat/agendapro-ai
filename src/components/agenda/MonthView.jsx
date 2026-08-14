import React from "react";
import { statusConfig, apptsForDay } from "@/lib/agenda-utils";

const WEEKDAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

export default function MonthView({ currentDate, appts, onNew, onEdit }) {
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
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {WEEKDAYS.map((d) => (
          <div key={d} className="px-2 py-2 text-center text-xs uppercase text-muted-foreground border-r border-border last:border-r-0">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {weeks.flat().map((date, i) => {
          const inMonth = date.getMonth() === currentDate.getMonth();
          const isToday = date.toDateString() === new Date().toDateString();
          const dayAppts = apptsForDay(appts, date);
          return (
            <div key={i} className={`min-h-[96px] p-1.5 border-r border-b border-border ${!inMonth ? "bg-muted/30" : ""} ${isToday ? "bg-primary/5" : ""}`}>
              <button onClick={() => onNew(date)} className={`text-xs font-medium mb-1 block w-full text-left ${inMonth ? (isToday ? "text-primary" : "text-foreground") : "text-muted-foreground/50"}`}>
                {date.getDate()}
              </button>
              <div className="space-y-0.5">
                {dayAppts.slice(0, 3).map((a) => {
                  const cfg = statusConfig[a.status] || statusConfig.pending;
                  return (
                    <button key={a.id} onClick={() => onEdit(a)} className={`w-full text-left rounded px-1 py-0.5 text-[10px] truncate ${cfg.bg}`}>
                      <span className="font-medium">{new Date(a.start_datetime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span> {a.patient_name}
                    </button>
                  );
                })}
                {dayAppts.length > 3 && <p className="text-[10px] text-muted-foreground px-1">+{dayAppts.length - 3} más</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}