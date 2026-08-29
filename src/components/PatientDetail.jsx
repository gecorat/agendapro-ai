import React, { useEffect, useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Phone, Mail, Loader2, Save, CalendarClock, IdCard } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

const STATUS_LABEL = {
  pending: "Pendiente",
  confirmed: "Confirmada",
  cancelled: "Cancelada",
  completed: "Completada",
  no_show: "Ausente",
};

const STATUS_VARIANT = {
  pending: "bg-amber-100 text-amber-700",
  confirmed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  completed: "bg-blue-100 text-blue-700",
  no_show: "bg-slate-200 text-slate-600",
};

function formatDate(d) {
  return new Date(d).toLocaleDateString("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PatientDetail({ open, onClose, patient, appointments, onUpdateAppointment }) {
  const { toast } = useToast();
  const [notesDraft, setNotesDraft] = useState({});
  const [savingId, setSavingId] = useState(null);

  const patientAppts = useMemo(() => {
    if (!patient) return [];
    return (appointments || [])
      .filter((a) => a.patient_id === patient.id)
      .sort((a, b) => new Date(b.start_datetime) - new Date(a.start_datetime));
  }, [patient, appointments]);

  useEffect(() => {
    if (open && patient) {
      const map = {};
      patientAppts.forEach((a) => { map[a.id] = a.notes || ""; });
      setNotesDraft(map);
    }
  }, [open, patient]);

  async function saveNotes(appt) {
    setSavingId(appt.id);
    try {
      const updated = await base44.entities.Appointment.update(appt.id, { notes: notesDraft[appt.id] || "" });
      if (onUpdateAppointment) onUpdateAppointment(updated);
      toast({ title: "Notas guardadas" });
    } catch (err) {
      toast({ title: "No se pudo guardar", description: err?.message, variant: "destructive" });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {patient?.first_name} {patient?.last_name || ""}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 text-sm">
          {patient?.phone && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Phone className="w-3.5 h-3.5" /> {patient.phone}
            </p>
          )}
          {patient?.email && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <Mail className="w-3.5 h-3.5" /> {patient.email}
            </p>
          )}
          {patient?.dni && (
            <p className="flex items-center gap-2 text-muted-foreground">
              <IdCard className="w-3.5 h-3.5" /> DNI {patient.dni}
            </p>
          )}
        </div>

        <div className="pt-2">
          <h3 className="font-heading font-semibold text-sm flex items-center gap-1.5 mb-2">
            <CalendarClock className="w-4 h-4" /> Historial de citas ({patientAppts.length})
          </h3>

          {patientAppts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Sin citas registradas.
            </p>
          ) : (
            <div className="space-y-3">
              {patientAppts.map((a) => (
                <div key={a.id} className="rounded-lg border border-border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium text-sm capitalize">{formatDate(a.start_datetime)}</p>
                      {a.service_name && (
                        <p className="text-xs text-muted-foreground">{a.service_name}</p>
                      )}
                    </div>
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_VARIANT[a.status] || "bg-slate-100 text-slate-600"}`}>
                      {STATUS_LABEL[a.status] || a.status}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <Textarea
                      value={notesDraft[a.id] ?? ""}
                      onChange={(e) => setNotesDraft({ ...notesDraft, [a.id]: e.target.value })}
                      placeholder="Notas de la cita..."
                      rows={2}
                      className="text-sm"
                    />
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => saveNotes(a)}
                        disabled={savingId === a.id || (notesDraft[a.id] ?? "") === (a.notes || "")}
                      >
                        {savingId === a.id ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1" />}
                        Guardar nota
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}