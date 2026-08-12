import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Trash2, Loader2, Clock, CalendarOff } from "lucide-react";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const TYPES = { work: "Trabajo", break: "Pausa", holiday: "Feriado", block: "Bloqueo" };

export default function AvailabilitySettings() {
  const { toast } = useToast();
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ day_of_week: 1, start_time: "09:00", end_time: "18:00", type: "work" });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setSlots((await base44.entities.Availability.list("day_of_week")) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = { ...form, day_of_week: Number(form.day_of_week) };
      if (form.type === "holiday" || form.type === "block") {
        // requires date
        if (!form.date) { toast({ title: "Indicá una fecha", variant: "destructive" }); setSaving(false); return; }
      }
      await base44.entities.Availability.create(data);
      toast({ title: "Horario agregado" });
      setOpen(false);
      setForm({ day_of_week: 1, start_time: "09:00", end_time: "18:00", type: "work" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id) => {
    if (!confirm("¿Eliminar este horario?")) return;
    try {
      await base44.entities.Availability.delete(id);
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const weekly = slots.filter((s) => s.type === "work" || s.type === "break");
  const exceptions = slots.filter((s) => s.type === "holiday" || s.type === "block");

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-semibold">Horarios y disponibilidad</h1>
          <p className="text-sm text-muted-foreground">Configurá tu semana y las excepciones</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-1" /> Agregar</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <>
          <div>
            <h2 className="text-sm font-heading font-semibold mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Semana</h2>
            {weekly.length === 0 ? (
              <Card className="p-4 text-center text-sm text-muted-foreground">Sin horarios configurados. Agregá tu disponibilidad semanal.</Card>
            ) : (
              <div className="space-y-2">
                {DAYS.map((_, dow) => {
                  const daySlots = weekly.filter((s) => s.day_of_week === dow).sort((a, b) => a.start_time.localeCompare(b.start_time));
                  if (daySlots.length === 0) return null;
                  return (
                    <Card key={dow} className="p-3">
                      <p className="text-xs font-medium text-muted-foreground mb-1.5">{DAYS[dow]}</p>
                      <div className="space-y-1">
                        {daySlots.map((s) => (
                          <div key={s.id} className="flex items-center justify-between text-sm">
                            <span className="flex items-center gap-2">
                              <Badge variant={s.type === "break" ? "secondary" : "outline"}>{TYPES[s.type]}</Badge>
                              {s.start_time} – {s.end_time}
                              {s.label && <span className="text-muted-foreground">· {s.label}</span>}
                            </span>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(s.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                          </div>
                        ))}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <h2 className="text-sm font-heading font-semibold mb-2 flex items-center gap-1.5"><CalendarOff className="w-4 h-4" /> Excepciones (feriados / bloqueos)</h2>
            {exceptions.length === 0 ? (
              <Card className="p-4 text-center text-sm text-muted-foreground">Sin excepciones. Agregá feriados o bloqueos de fecha específica.</Card>
            ) : (
              <div className="space-y-2">
                {exceptions.map((s) => (
                  <Card key={s.id} className="p-3 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2">
                      <Badge variant={s.type === "holiday" ? "secondary" : "destructive"}>{TYPES[s.type]}</Badge>
                      {s.date ? new Date(s.date + "T00:00:00").toLocaleDateString("es-AR") : "—"}
                      {s.start_time && ` · ${s.start_time}–${s.end_time}`}
                      {s.label && <span className="text-muted-foreground">· {s.label}</span>}
                    </span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(s.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Nuevo horario</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={form.type} onValueChange={(v) => set("type", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {(form.type === "work" || form.type === "break") && (
              <div className="space-y-1.5">
                <Label>Día de la semana</Label>
                <Select value={String(form.day_of_week)} onValueChange={(v) => set("day_of_week", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {(form.type === "holiday" || form.type === "block") && (
              <div className="space-y-1.5">
                <Label>Fecha</Label>
                <Input type="date" value={form.date || ""} onChange={(e) => set("date", e.target.value)} required />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta</Label>
                <Input type="time" value={form.end_time} onChange={(e) => set("end_time", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Etiqueta (opcional)</Label>
              <Input value={form.label || ""} onChange={(e) => set("label", e.target.value)} placeholder="Ej. Almuerzo, Feriado nacional" />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={saving}>{saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Guardar</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}