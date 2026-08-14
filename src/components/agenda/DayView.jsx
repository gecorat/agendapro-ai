import React from "react";
import { statusConfig, HOURS, apptsForDay } from "@/lib/agenda-utils";

export default function DayView({ date, appts, onNew, onEdit }) {
  const dayAppts = apptsForDay(appts, date);
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium capitalize">
          {date.toLocaleDateString("es", { weekday: "long" })}
        </span>
        <button onClick={() => onNew(date)} className="text-sm text-primary hover:underline">+ Agregar</button>
      </div>
      <div className="divide-y divide-border">
        {HOURS.map((h) => {
          const slotAppts = dayAppts.filter((a) => new Date(a.start_datetime).getHours() === h);
          return (
            <div key={h} className="flex min-h-[60px]">
              <div className="w-16 shrink-0 px-3 py-2 text-xs text-muted-foreground border-r border-border text-right">{h}:00</div>
              <div className="flex-1 p-1.5 space-y-1">
                {slotAppts.map((a) => {
                  const cfg = statusConfig[a.status] || statusConfig.pending;
                  return (
                    <button key={a.id} onClick={() => onEdit(a)} className={`w-full text-left rounded-lg border px-3 py-1.5 text-sm ${cfg.bg} hover:opacity-80 transition-opacity`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{new Date(a.start_datetime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>
                        <span className="font-medium">{a.patient_name}</span>
                      </div>
                      <span className="text-xs opacity-75">{a.service_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}