import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Clock, DollarSign, Loader2 } from "lucide-react";

const EMPTY = { name: "", description: "", prep_notes: "", duration_minutes: 30, margin_minutes: 0, color: "#3b82f6", price: "", follow_up_days: 0, active: true };

export default function ServiceManager() {
  const { toast } = useToast();
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setServices((await base44.entities.Service.list("-created_date")) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s, price: s.price ?? "" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      const data = { ...form, price: form.price === "" ? null : Number(form.price), duration_minutes: Number(form.duration_minutes), margin_minutes: Number(form.margin_minutes), follow_up_days: Number(form.follow_up_days) };
      if (editing) {
        await base44.entities.Service.update(editing.id, data);
      } else {
        await base44.entities.Service.create(data);
      }
      toast({ title: editing ? "Servicio actualizado" : "Servicio creado" });
      setOpen(false);
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (s) => {
    if (!confirm(`¿Eliminar "${s.name}"?`)) return;
    try {
      await base44.entities.Service.delete(s.id);
      toast({ title: "Servicio eliminado" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="px-3 py-3 md:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Servicios</h1>
          <p className="text-sm text-muted-foreground">Tipos de consulta, precios, duración y notas de preparación</p>
        </div>
        <Button onClick={openNew} className="shadow-sm"><Plus className="w-4 h-4 mr-1" /> Nuevo</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : services.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">Aún no cargaste servicios. Creá tu primer tipo de consulta.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {services.map((s) => (
            <div key={s.id} className="bg-card rounded-2xl border border-border p-4 hover:shadow-sm transition-shadow">
              <div className="flex items-start gap-3">
                <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: s.color || "#3b82f6" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-heading font-medium">{s.name}</p>
                    {!s.active && <Badge variant="secondary">Inactivo</Badge>}
                  </div>
                  {s.description && <p className="text-sm text-muted-foreground mt-0.5">{s.description}</p>}
                  {s.prep_notes && <p className="text-xs text-muted-foreground mt-1.5 bg-muted/60 rounded-lg px-2.5 py-1.5">📋 {s.prep_notes}</p>}
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                    <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {s.duration_minutes} min</span>
                    {s.margin_minutes > 0 && <span>+{s.margin_minutes} min margen</span>}
                    {s.price ? <span className="flex items-center gap-1"><DollarSign className="w-3.5 h-3.5" /> ${s.price}</span> : null}
                    {s.follow_up_days > 0 && <span>Control en {s.follow_up_days}d</span>}
                  </div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => openEdit(s)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => remove(s)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing ? "Editar servicio" : "Nuevo servicio"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Nombre *</Label>
              <Input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Ej. Consulta general" required />
            </div>
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => set("description", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Notas de preparación</Label>
              <Textarea rows={2} value={form.prep_notes} onChange={(e) => set("prep_notes", e.target.value)} placeholder="Ej. Ayuno de 8hs, traer radiografías previas..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Duración (min)</Label>
                <Input type="number" value={form.duration_minutes} onChange={(e) => set("duration_minutes", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Margen (min)</Label>
                <Input type="number" value={form.margin_minutes} onChange={(e) => set("margin_minutes", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Precio (ARS)</Label>
                <Input type="number" value={form.price} onChange={(e) => set("price", e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-1.5">
                <Label>Seguimiento (días)</Label>
                <Input type="number" value={form.follow_up_days} onChange={(e) => set("follow_up_days", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="h-9 p-1" />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3">
                <Label htmlFor="active">Activo</Label>
                <Switch id="active" checked={form.active} onCheckedChange={(v) => set("active", v)} />
              </div>
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