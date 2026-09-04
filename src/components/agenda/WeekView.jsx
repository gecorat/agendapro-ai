import React from "react";
import { statusConfig, apptsForDay, formatTime } from "@/lib/agenda-utils";

const MAX_INLINE = 3;

// En vez de una grilla de horas con bloques posicionados en absoluto (se rompía en
// pantallas angostas), cada día es una fila de agenda: fecha a la izquierda, turnos
// resumidos a la derecha. Tocar la fila abre el detalle completo del día abajo.
export default function WeekView({ days, appts, onDayClick, onEdit }) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm divide-y divide-border">
      {days.map((d) => {
        const dayAppts = apptsForDay(appts, d);
        const isToday = isArgentinaToday(d);
        return (
          <div
            key={d.toISOString()}
            role="button"
            onClick={() => onDayClick(d)}
            className="w-full flex items-stretch gap-3 px-3 py-3 text-left cursor-pointer hover:bg-muted/30 active:bg-muted/50 transition-colors"
          >
            <div className="w-12 shrink-0 flex flex-col items-center pt-0.5">
              <span className="text-[10.5px] uppercase tracking-wide text-muted-foreground">{formatArDate(d, { weekday: "short" })}</span>
              <span className={`mt-1 inline-flex items-center justify-center w-8 h-8 rounded-full text-sm font-heading font-semibold ${isToday ? "bg-primary text-primary-foreground" : "text-foreground"}`}>
                {argentinaDayOfMonth(d)}
              </span>
            </div>
            <div className="flex-1 min-w-0 py-1.5 space-y-1">
              {dayAppts.length === 0 ? (
                <p className="text-sm text-muted-foreground/50 pt-1.5">Sin turnos</p>
              ) : (
                <>
                  {dayAppts.slice(0, MAX_INLINE).map((a) => {
                    const cfg = statusConfig[a.status] || statusConfig.pending;
                    return (
                      <div
                        key={a.id}
                        onClick={(e) => { e.stopPropagation(); if (!a.is_google) onEdit(a); }}
                        className={`flex items-center gap-2 rounded-md px-1.5 py-1 -mx-1.5 transition-colors ${a.is_google ? "cursor-default" : "hover:bg-muted/60"}`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-xs tabular-nums text-muted-foreground shrink-0">{formatTime(new Date(a.start_datetime))}</span>
                        <span className={`text-sm truncate ${cfg.strike ? "line-through text-muted-foreground" : "text-foreground font-medium"}`}>{a.patient_name}</span>
                      </div>
                    );
                  })}
                  {dayAppts.length > MAX_INLINE && (
                    <p className="text-xs text-muted-foreground pl-3.5">+{dayAppts.length - MAX_INLINE} más</p>
                  )}
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
