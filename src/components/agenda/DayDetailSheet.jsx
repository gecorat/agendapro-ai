import React from "react";
import { Plus, CalendarX2 } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { statusConfig, apptsForDay, formatTime, formatDayHeading } from "@/lib/agenda-utils";

// Bottom sheet (se desliza desde abajo, como pediste) con el detalle completo de un día:
// lista de turnos con tarjetas prolijas + botón para agregar uno nuevo ese día.
export default function DayDetailSheet({ date, appts, onClose, onNew, onEdit }) {
  const open = !!date;
  const dayAppts = date ? apptsForDay(appts, date) : [];

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()}>
      <DrawerContent className="max-h-[85vh] focus:outline-none">
        {date && (
          <>
            <DrawerHeader className="text-left pb-2">
              <DrawerTitle className="font-heading text-lg capitalize">{formatDayHeading(date)}</DrawerTitle>
              <p className="text-sm text-muted-foreground">
                {dayAppts.length === 0 ? "Sin turnos" : `${dayAppts.length} turno${dayAppts.length > 1 ? "s" : ""}`}
              </p>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4">
              {dayAppts.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 px-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <CalendarX2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">No hay turnos agendados este día.</p>
                </div>
              ) : (
                <div className="space-y-1.5 pb-2">
                  {dayAppts.map((a) => {
                    const cfg = statusConfig[a.status] || statusConfig.pending;
                    const start = new Date(a.start_datetime);
                    const end = new Date(a.end_datetime);
                    return (
                      <button
                        key={a.id}
                        onClick={() => onEdit(a)}
                        className="w-full text-left rounded-xl border border-border bg-card hover:border-foreground/20 hover:shadow-sm active:scale-[0.99] transition-all px-3 py-2.5 flex items-start gap-3"
                      >
                        <div className={`w-1 self-stretch rounded-full ${cfg.dot} shrink-0 mt-0.5`} />
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-sm font-semibold tabular-nums">{formatTime(start)} – {formatTime(end)}</p>
                            <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bgSoft} ${cfg.text} shrink-0`}>{cfg.label}</span>
                          </div>
                          <p className={`text-sm font-medium truncate mt-0.5 ${cfg.strike ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.patient_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{a.service_name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border mt-2">
              <Button className="w-full" onClick={() => onNew(date)}>
                <Plus className="w-4 h-4 mr-1.5" /> Nuevo turno este día
              </Button>
            </div>
          </>
        )}
      </DrawerContent>
    </Drawer>
  );
}
