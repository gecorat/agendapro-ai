import React from "react";
import { statusConfig, HOURS, apptsForDay } from "@/lib/agenda-utils";

const SLOT_HEIGHT = 48; // px per hour

export default function WeekView({ days, appts, onNew, onEdit }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      {/* Header row: empty corner + 7 day labels */}
      <div className="grid border-b border-border" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
        <div className="border-r border-border" />
        {days.map((d) => {
          const isToday = d.toDateString() === new Date().toDateString();
          return (
            <div key={d.toISOString()} className={`px-2 py-2 text-center border-r border-border last:border-r-0 ${isToday ? "bg-primary/5" : ""}`}>
              <p className="text-xs uppercase text-muted-foreground">{d.toLocaleDateString("es", { weekday: "short" })}</p>
              <p className={`text-lg font-heading font-semibold ${isToday ? "text-primary" : ""}`}>{d.getDate()}</p>
            </div>
          );
        })}
      </div>
      {/* Body: time column + 7 day columns, scrollable */}
      <div className="overflow-y-auto max-h-[70vh]">
        <div className="grid relative" style={{ gridTemplateColumns: `56px repeat(7, 1fr)` }}>
          {/* Time labels column */}
          <div className="border-r border-border">
            {HOURS.map((h) => (
              <div key={h} className="text-xs text-muted-foreground text-right pr-2 border-b border-border flex items-end justify-end pb-1" style={{ height: SLOT_HEIGHT }}>{h}:00</div>
            ))}
          </div>
          {/* Day columns */}
          {days.map((d) => {
            const dayAppts = apptsForDay(appts, d);
            return (
              <div key={d.toISOString()} className="relative border-r border-border last:border-r-0" style={{ height: HOURS.length * SLOT_HEIGHT }}>
                {/* horizontal grid lines */}
                {HOURS.map((h) => (
                  <div key={h} className="border-b border-border/60" style={{ height: SLOT_HEIGHT }} />
                ))}
                {/* appointment blocks */}
                {dayAppts.map((a) => {
                  const start = new Date(a.start_datetime);
                  const end = new Date(a.end_datetime);
                  const startMin = (start.getHours() - HOURS[0]) * 60 + start.getMinutes();
                  const durationMin = Math.max(15, (end - start) / 60000);
                  const top = (startMin / 60) * SLOT_HEIGHT;
                  const height = Math.max(20, (durationMin / 60) * SLOT_HEIGHT - 2);
                  const cfg = statusConfig[a.status] || statusConfig.pending;
                  return (
                    <button key={a.id} onClick={() => onEdit(a)} className={`absolute left-1 right-1 rounded border px-1.5 py-1 text-left overflow-hidden ${cfg.bg} hover:opacity-80`} style={{ top, height }}>
                      <p className="text-[10px] font-medium leading-tight">{start.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</p>
                      <p className="text-[10px] font-semibold leading-tight truncate">{a.patient_name}</p>
                      {height > 36 && <p className="text-[9px] opacity-75 truncate">{a.service_name}</p>}
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