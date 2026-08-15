import React from "react";
import { Plus, CalendarX2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { statusConfig, apptsForDay, formatTime, formatDayHeading } from "@/lib/agenda-utils";

// Panel lateral que muestra el día completo con su lista de turnos, prolijo y legible,
// en vez de saltar directo al formulario de "nueva cita" al hacer clic en un día del mes.
export default function DayDetailSheet({ date, appts, onClose, onNew, onEdit }) {
  const open = !!date;
  const dayAppts = date ? apptsForDay(appts, date) : [];

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col gap-0">
        {date && (
          <>
            <SheetHeader className="px-5 pt-5 pb-4 border-b border-border text-left">
              <SheetTitle className="font-heading text-lg capitalize">{formatDayHeading(date)}</SheetTitle>
              <p className="text-sm text-muted-foreground">
                {dayAppts.length === 0 ? "Sin turnos" : `${dayAppts.length} turno${dayAppts.length > 1 ? "s" : ""}`}
              </p>
            </SheetHeader>

            <ScrollArea className="flex-1">
              <div className="p-4">
                {dayAppts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 px-4">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <CalendarX2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">No hay turnos agendados este día.</p>
                    <Button size="sm" onClick={() => onNew(date)}>
                      <Plus className="w-4 h-4 mr-1.5" /> Agregar turno
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {dayAppts.map((a) => {
                      const cfg = statusConfig[a.status] || statusConfig.pending;
                      const start = new Date(a.start_datetime);
                      const end = new Date(a.end_datetime);
                      return (
                        <button
                          key={a.id}
                          onClick={() => onEdit(a)}
                          className="w-full text-left rounded-lg border border-border bg-card hover:border-foreground/20 hover:shadow-sm transition-all px-3 py-2.5 flex items-start gap-3"
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
            </ScrollArea>

            {dayAppts.length > 0 && (
              <div className="p-4 border-t border-border">
                <Button className="w-full" onClick={() => onNew(date)}>
                  <Plus className="w-4 h-4 mr-1.5" /> Nuevo turno este día
                </Button>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
