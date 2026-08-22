import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Loader2, ListPlus } from "lucide-react";

const EMPTY = { title: "", body: "" };

// Las plantillas cargadas acá aparecen en el selector de "Respuestas rápidas" (ícono de
// lista) dentro de Chats, al responder manualmente a un paciente.
export default function MessageTemplatesPanel() {
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
      setList((await base44.entities.MessageTemplate.list("-created_date")) || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (t) => { setEditing(t); setForm({ title: t.title, body: t.body }); setOpen(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await base44.entities.MessageTemplate.update(editing.id, form);
      } else {
        const me = await base44.auth.me();
        await base44.entities.MessageTemplate.create({ ...form, professional_id: me.id });
      }
      toast({ title: editing ? "Plantilla actualizada" : "Plantilla creada" });
      setOpen(false);
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (t) => {
    if (!confirm(`¿Eliminar la plantilla "${t.title}"?`)) return;
    try {
      await base44.entities.MessageTemplate.delete(t.id);
      toast({ title: "Plantilla eliminada" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-heading font-semibold">Respuestas rápidas</h2>
          <p className="text-sm text-muted-foreground">Aparecen en Chats al responder manualmente a un paciente.</p>
        </div>
        <Button onClick={openNew} className="shadow-sm shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Nueva
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : list.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <ListPlus className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm">Todavía no cargaste ninguna respuesta rápida.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {list.map((t) => (
            <div key={t.id} className="bg-card rounded-2xl border border-border p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-heading font-medium">{t.title}</p>
                <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">{t.body}</p>
              </div>
              <div className="flex gap-0.5 shrink-0">
                <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => openEdit(t)}><Pencil className="w-4 h-4" /></Button>
                <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => remove(t)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar plantilla" : "Nueva respuesta rápida"}</DialogTitle></DialogHeader>
          <form onSubmit={save} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Título (solo para vos, en el selector)</Label>
              <Input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Ej. Confirmar turno" required />
            </div>
            <div className="space-y-1.5">
              <Label>Texto que se manda</Label>
              <Textarea value={form.body} onChange={(e) => set("body", e.target.value)} rows={4} placeholder="Ej. ¡Perfecto! Te confirmo tu turno. Cualquier cosa avisame." required />
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
