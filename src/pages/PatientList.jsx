import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { Search, Loader2, Phone, Mail, Pencil, ChevronRight, Clock, Plus } from "lucide-react";
import PatientForm from "@/components/PatientForm";

const STATUS_STYLES = {
  confirmed: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-gray-200 text-gray-700",
};
const STATUS_LABELS = { confirmed: "Confirmada", pending: "Pendiente", completed: "Completada", cancelled: "Cancelada", no_show: "Ausente" };

export default function PatientList() {
  const { toast } = useToast();
  const { preset } = usePracticeSettings();
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [pats, appts] = await Promise.all([
        base44.entities.Patient.list("-created_date"),
        base44.entities.Appointment.list("-start_datetime"),
      ]);
      setPatients(pats || []);
      setAppointments(appts || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = patients.filter((p) => {
    const q = search.toLowerCase();
    return !q || `${p.first_name} ${p.last_name || ""}`.toLowerCase().includes(q) || p.phone?.includes(q) || p.email?.toLowerCase().includes(q);
  });

  const openDetail = (p) => {
    setSelected(p);
    setNotes(p.notes || "");
  };

  const saveNotes = async () => {
    setSavingNotes(true);
    try {
      await base44.entities.Patient.update(selected.id, { notes });
      setPatients((list) => list.map((p) => p.id === selected.id ? { ...p, notes } : p));
      toast({ title: "Notas guardadas" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingNotes(false);
    }
  };

  const patientAppts = selected ? appointments.filter((a) => a.patient_id === selected.id || a.patient_name === `${selected.first_name} ${selected.last_name || ""}`.trim()) : [];

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-semibold">{preset.patientLabel}</h1>
          <p className="text-sm text-muted-foreground">Listado, historial de citas y notas privadas</p>
        </div>
        <Button onClick={() => setFormOpen(true)} size="sm">
          <Plus className="w-4 h-4 mr-1" />
          Nuevo
        </Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre, teléfono o email..." className="pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">No se encontraron {preset.patientLabel.toLowerCase()}.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <Card key={p.id} className="p-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => openDetail(p)}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium truncate">{p.first_name} {p.last_name}</p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {p.phone}</span>}
                    {p.email && <span className="flex items-center gap-1 truncate"><Mail className="w-3 h-3" /> {p.email}</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle>{selected.first_name} {selected.last_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-3 text-sm">
                  {selected.phone && <span className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-muted-foreground" /> {selected.phone}</span>}
                  {selected.email && <span className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-muted-foreground" /> {selected.email}</span>}
                </div>
                {(selected.no_show_count > 0 || selected.cancellation_count > 0) && (
                  <div className="flex gap-2">
                    {selected.no_show_count > 0 && <Badge variant="secondary">{selected.no_show_count} ausencias</Badge>}
                    {selected.cancellation_count > 0 && <Badge variant="secondary">{selected.cancellation_count} cancelaciones</Badge>}
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label>Notas privadas</Label>
                  <Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas internas (solo visibles para vos)..." />
                  <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                    {savingNotes && <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />} Guardar notas
                  </Button>
                </div>

                <div>
                  <p className="text-sm font-medium mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Historial de citas</p>
                  {patientAppts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Sin citas registradas.</p>
                  ) : (
                    <div className="space-y-2">
                      {patientAppts.map((a) => (
                        <div key={a.id} className="rounded-lg border border-border p-2.5 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{a.service_name || "Servicio"}</span>
                            <Badge className={STATUS_STYLES[a.status] || ""}>{STATUS_LABELS[a.status]}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {new Date(a.start_datetime).toLocaleString("es-AR", { dateStyle: "medium", timeStyle: "short" })}
                          </p>
                          {a.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{a.notes}"</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <PatientForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); load(); }}
      />
    </div>
  );
}