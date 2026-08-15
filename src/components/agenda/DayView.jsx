import React from "react";
import { Plus, CalendarX2 } from "lucide-react";
import { statusConfig, HOURS, apptsForDay, formatTime, nowOffsetRatio } from "@/lib/agenda-utils";

export default function DayView({ date, appts, onNew, onEdit }) {
  const dayAppts = apptsForDay(appts, date);
  const isToday = date.toDateString() === new Date().toDateString();
  const nowRatio = isToday ? nowOffsetRatio() : null;

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
        <div className="relative divide-y divide-border/70">
          {isToday && nowRatio !== null && (
            <div
              className="absolute left-0 right-0 z-10 flex items-center pointer-events-none"
              style={{ top: `${nowRatio * 100}%` }}
            >
              <div className="w-16 shrink-0 flex justify-end pr-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              </div>
              <div className="flex-1 h-px bg-rose-500" />
            </div>
          )}
          {HOURS.map((h) => {
            const slotAppts = dayAppts.filter((a) => new Date(a.start_datetime).getHours() === h);
            return (
              <div key={h} className="flex min-h-[64px]">
                <div className="w-16 shrink-0 px-3 py-2.5 text-[11px] text-muted-foreground border-r border-border text-right tabular-nums">{h}:00</div>
                <div className="flex-1 p-1.5 space-y-1.5">
                  {slotAppts.map((a) => {
                    const cfg = statusConfig[a.status] || statusConfig.pending;
                    return (
                      <button
                        key={a.id}
                        onClick={() => onEdit(a)}
                        className={`w-full text-left rounded-lg border-l-[3px] ${cfg.border} bg-card shadow-sm hover:shadow-md hover:-translate-y-px transition-all px-3 py-2`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums text-muted-foreground">{formatTime(new Date(a.start_datetime))}</span>
                          <span className={`text-sm font-semibold ${cfg.strike ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.patient_name}</span>
                          <span className={`ml-auto text-[10.5px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bgSoft} ${cfg.text}`}>{cfg.label}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{a.service_name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
