import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, CalendarX2, Eye, CalendarClock, XCircle, Loader2, Phone, Mail } from "lucide-react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { statusConfig, apptsForDay, formatTime, formatDayHeading } from "@/lib/agenda-utils";

// Panel lateral desde la DERECHA (antes era desde abajo) con la lista completa de turnos
// del día y acciones rápidas por turno: Ver Paciente (datos de contacto sin salir de acá),
// Reagendar (abre el formulario para cambiar día/hora) y Cancelar (un clic, con confirmación).
export default function DayDetailSheet({ date, appts, onClose, onNew, onEdit, onChanged }) {
  const open = !!date;
  const dayAppts = date ? apptsForDay(appts, date) : [];
  const [expandedId, setExpandedId] = useState(null);
  const [patientInfo, setPatientInfo] = useState(null);
  const [loadingPatient, setLoadingPatient] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [confirmCancelId, setConfirmCancelId] = useState(null);

  async function toggleViewPatient(a) {
    if (expandedId === a.id) { setExpandedId(null); return; }
    setExpandedId(a.id);
    setPatientInfo(null);
    if (!a.patient_id) return;
    setLoadingPatient(true);
    try {
      const rows = await base44.entities.Patient.filter({ id: a.patient_id });
      setPatientInfo(rows?.[0] || null);
    } catch {
      setPatientInfo(null);
    } finally {
      setLoadingPatient(false);
    }
  }

  async function handleCancel(a) {
    setCancellingId(a.id);
    try {
      await base44.entities.Appointment.update(a.id, { status: "cancelled" });
      try {
        await base44.functions.invoke("syncAppointmentGoogle", { appointmentId: a.id });
      } catch { /* no romper el flujo si Google falla */ }
      await onChanged?.();
    } finally {
      setCancellingId(null);
      setConfirmCancelId(null);
    }
  }

  return (
    <Drawer open={open} onOpenChange={(v) => !v && onClose()} direction="right" shouldScaleBackground={false}>
      <DrawerContent direction="right" className="focus:outline-none">
        {date && (
          <>
            <DrawerHeader className="text-left pb-2 border-b border-border">
              <DrawerTitle className="font-heading text-lg capitalize">{formatDayHeading(date)}</DrawerTitle>
              <p className="text-sm text-muted-foreground">
                {dayAppts.length === 0 ? "Sin turnos" : `${dayAppts.length} turno${dayAppts.length > 1 ? "s" : ""}`}
              </p>
            </DrawerHeader>

            <div className="flex-1 overflow-y-auto px-4 py-3">
              {dayAppts.length === 0 ? (
                <div className="flex flex-col items-center justify-center text-center py-10 px-4">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                    <CalendarX2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">No hay turnos agendados este día.</p>
                </div>
              ) : (
                <div className="space-y-2 pb-2">
                  {dayAppts.map((a) => {
                    const cfg = statusConfig[a.status] || statusConfig.pending;
                    const start = new Date(a.start_datetime);
                    const end = new Date(a.end_datetime);
                    const isExpanded = expandedId === a.id;
                    return (
                      <div key={a.id} className="rounded-xl border border-border bg-card overflow-hidden">
                        <div className="px-3 py-2.5 flex items-start gap-3">
                          <div className={`w-1 self-stretch rounded-full ${cfg.dot} shrink-0 mt-0.5`} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold tabular-nums">{formatTime(start)} – {formatTime(end)}</p>
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${cfg.bgSoft} ${cfg.text} shrink-0`}>{cfg.label}</span>
                            </div>
                            <p className={`text-sm font-medium truncate mt-0.5 ${cfg.strike ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.patient_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{a.service_name}</p>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-2.5 -mt-1">
                            {loadingPatient ? (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1"><Loader2 className="w-3 h-3 animate-spin" /> Cargando datos...</div>
                            ) : patientInfo ? (
                              <div className="rounded-lg bg-muted/50 p-2.5 space-y-1">
                                {patientInfo.phone && <p className="text-xs flex items-center gap-1.5"><Phone className="w-3 h-3 text-muted-foreground" /> {patientInfo.phone}</p>}
                                {patientInfo.email && <p className="text-xs flex items-center gap-1.5 truncate"><Mail className="w-3 h-3 text-muted-foreground shrink-0" /> {patientInfo.email}</p>}
                                {!patientInfo.phone && !patientInfo.email && <p className="text-xs text-muted-foreground">Sin datos de contacto cargados.</p>}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground">No se encontró el paciente.</p>
                            )}
                          </div>
                        )}

                        <div className="px-3 pb-2.5 flex items-center gap-1.5">
                          {a.is_google ? (
                            <span className="text-[11px] font-medium text-violet-500 px-2 py-1">
                              Bloqueado desde Google Calendar — solo lectura
                            </span>
                          ) : (
                            <>
                              <button onClick={() => toggleViewPatient(a)} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors">
                                <Eye className="w-3 h-3" /> Ver paciente
                              </button>
                              <button onClick={() => onEdit(a)} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-border hover:bg-accent transition-colors">
                                <CalendarClock className="w-3 h-3" /> Reagendar
                              </button>
                              {a.status !== "cancelled" && (
                                confirmCancelId === a.id ? (
                                  <button onClick={() => handleCancel(a)} disabled={cancellingId === a.id} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md bg-rose-500 text-white hover:bg-rose-600 transition-colors ml-auto">
                                    {cancellingId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />} Confirmar
                                  </button>
                                ) : (
                                  <button onClick={() => setConfirmCancelId(a.id)} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-md border border-border text-rose-600 hover:bg-rose-50 transition-colors ml-auto">
                                    <XCircle className="w-3 h-3" /> Cancelar
                                  </button>
                                )
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-4 border-t border-border mt-2 shrink-0">
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
