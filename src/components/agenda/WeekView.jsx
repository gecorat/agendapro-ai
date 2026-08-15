import React from "react";
import { statusConfig, HOURS, apptsForDay, formatTime, nowOffsetRatio } from "@/lib/agenda-utils";

const SLOT_HEIGHT = 56; // px per hour

export default function WeekView({ days, appts, onNew, onEdit }) {
  const gridHeight = HOURS.length * SLOT_HEIGHT;
  const nowRatio = nowOffsetRatio();

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
      {/* Header row: empty corner + 7 day labels */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `52px repeat(7, 1fr)` }}>
        <div className="border-r border-border" />
        {days.map((d) => {
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <button
              key={d.toISOString()}
              onClick={() => onNew(d)}
              className="px-1 py-2.5 text-center border-r border-border last:border-r-0 hover:bg-muted/40 transition-colors"
            >
              <p className="text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground">{d.toLocaleDateString("es-AR", { weekday: "short" })}</p>
              <span className={`mt-0.5 inline-flex items-center justify-center w-7 h-7 rounded-full text-sm font-heading font-semibold ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                {d.getDate()}
              </span>
            </button>
          );
        })}
      </div>
      {/* Body: time column + 7 day columns, scrollable */}
      <div className="overflow-y-auto max-h-[70vh]">
        <div className="grid relative" style={{ gridTemplateColumns: `52px repeat(7, 1fr)` }}>
          {/* Time labels column */}
          <div className="border-r border-border">
            {HOURS.map((h) => (
              <div key={h} className="text-[10.5px] text-muted-foreground text-right pr-2 border-b border-border/70 flex items-start justify-end pt-1" style={{ height: SLOT_HEIGHT }}>{h}:00</div>
            ))}
          </div>
          {/* Day columns */}
          {days.map((d) => {
            const dayAppts = apptsForDay(appts, d);
            const isToday = d.toDateString() === new Date().toDateString();
            return (
              <div
                key={d.toISOString()}
                className={`relative border-r border-border last:border-r-0 ${isToday ? "bg-primary/[0.03]" : ""}`}
                style={{ height: gridHeight }}
              >
                {/* horizontal grid lines */}
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-border/50" style={{ height: SLOT_HEIGHT }} />
                ))}
                {/* línea de "ahora" */}
                {isToday && nowRatio !== null && (
                  <div className="absolute left-0 right-0 z-10 flex items-center pointer-events-none" style={{ top: `${nowRatio * gridHeight}px` }}>
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500 -ml-[3px]" />
                    <div className="flex-1 h-px bg-rose-500" />
                  </div>
                )}
                {/* appointment blocks */}
                {dayAppts.map((a) => {
                  const start = new Date(a.start_datetime);
                  const end = new Date(a.end_datetime);
                  const startMin = (start.getHours() - HOURS[0]) * 60 + start.getMinutes();
                  const durationMin = Math.max(15, (end - start) / 60000);
                  const top = (startMin / 60) * SLOT_HEIGHT;
                  const height = Math.max(22, (durationMin / 60) * SLOT_HEIGHT - 2);
                  const cfg = statusConfig[a.status] || statusConfig.pending;
                  return (
                    <button
                      key={a.id}
                      onClick={() => onEdit(a)}
                      className={`absolute left-1 right-1 rounded-md border-l-[3px] ${cfg.border} bg-card shadow-sm hover:shadow-md hover:-translate-y-px transition-all px-1.5 py-1 text-left overflow-hidden`}
                      style={{ top, height }}
                    >
                      <p className="text-[10px] font-semibold leading-tight tabular-nums text-muted-foreground">{formatTime(start)}</p>
                      <p className={`text-[10.5px] font-semibold leading-tight truncate ${cfg.strike ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.patient_name}</p>
                      {height > 40 && <p className="text-[9.5px] text-muted-foreground truncate">{a.service_name}</p>}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
