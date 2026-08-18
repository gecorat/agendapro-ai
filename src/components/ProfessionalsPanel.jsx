import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";

const EMPTY = { first_name: "", last_name: "", specialty: "", color: "#3b82f6", active: true };

// Gestión del equipo del plan Clinic. Cada Professional creado acá queda disponible
// para asignarle servicios/horarios propios y para que el bot de WhatsApp lo ofrezca
// como opción al paciente.
export default function ProfessionalsPanel() {
  const { toast } = useToast();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      setList((await base44.entities.Professional.list("-created_date")) || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p }); setOpen(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.first_name) return;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.Professional.update(editing.id, form);
      } else {
        const me = await base44.auth.me();
        await base44.entities.Professional.create({ ...form, practice_owner_id: me.id });
      }
      toast({ title: editing ? "Profesional actualizado" : "Profesional agregado" });
      setOpen(false);
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (p) => {
    if (!confirm(`¿Eliminar a ${p.first_name} ${p.last_name || ""}? Sus turnos y servicios ya cargados no se borran, quedan sin profesional asignado.`)) return;
    try {
      await base44.entities.Professional.delete(p.id);
      toast({ title: "Profesional eliminado" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold">Profesionales</h2>
          <p className="text-sm text-muted-foreground">Tu equipo. El bot de WhatsApp les pregunta a los pacientes con quién quieren agendar.</p>
        </div>
        <Button onClick={openNew} className="shadow-sm shrink-0"><Plus className="w-4 h-4 mr-1" /> Nuevo</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <Users className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Todavía no cargaste a nadie más de tu equipo.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((p) => (
            <div key={p.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
              <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: p.color || "#3b82f6" }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-heading font-medium">{p.first_name} {p.last_name}</p>
                  {!p.active && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactivo</span>}
                </div>
                {p.specialty && <p className="text-sm text-muted-foreground mt-0.5">{p.specialty}</p>}
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => remove(p)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar profesional" : "Nuevo profesional"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre *</Label>
                <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} required />
              </div>
              <div className="space-y-1.5">
                <Label>Apellido</Label>
                <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Especialidad / rol</Label>
              <Input value={form.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="Ej. Ortodoncia, Barbería clásica..." />
            </div>
            <div className="flex items-center gap-3">
              <div className="space-y-1.5">
                <Label>Color</Label>
                <Input type="color" value={form.color} onChange={(e) => set("color", e.target.value)} className="h-9 w-16 p-1" />
              </div>
              <div className="flex items-center justify-between rounded-md border px-3 py-2 flex-1 mt-5">
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
