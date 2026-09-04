import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { fetchScopedProfessionals } from "@/lib/professionals";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import { Plus, Pencil, Trash2, Clock, DollarSign, Loader2, User } from "lucide-react";

const EMPTY = { name: "", description: "", prep_notes: "", duration_minutes: 30, margin_minutes: 0, color: "#3b82f6", price: "", follow_up_days: 0, active: true, professional_ref_id: "" };
const OWNER_VALUE = "__owner__";

// Única fuente de verdad para gestionar Servicios: la usan tanto la página standalone
// (ServiceManager.jsx) como la pestaña "Servicios" de Configuración, para no mantener dos
// formularios/listas distintas que terminan desincronizadas (a una le faltaban campos).
export default function ServiceManagerPanel({ showHeader = true }) {
  const { toast } = useToast();
  const { settings, professional, isOwner } = usePracticeSettings();
  const status = getPlanStatus(settings);
  const isClinic = status.canUseMultiProfessional;

  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  // A que consultorio pertenece lo que se cree aca. Sin este campo, un servicio nuevo
  // quedaba identificado solo por created_by_id (lo que estampa Base44), y eso ya rompio
  // dos veces: los servicios del onboarding (creados con rol de servicio) no se reconocian
  // como propios, y los creados por un profesional invitado quedaban invisibles para el
  // consultorio. Ver base44/shared/ownership.ts.
  const [practiceOwnerId, setPracticeOwnerId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [filterProId, setFilterProId] = useState("all");

  const load = async () => {
    setLoading(true);
    try {
      // Antes Service.list() traía servicios de TODAS las cuentas mezclados — confirmado
      // en vivo, y era la causa de que a veces no se pudiera borrar (no eran tuyos).
      const me = await base44.auth.me();
      setPracticeOwnerId(isOwner ? me.id : (professional?.practice_owner_id || null));

      const [svcsRes, pros] = await Promise.all([
        base44.functions.invoke("getScopedServices", {}),
        isClinic ? fetchScopedProfessionals() : Promise.resolve([]),
      ]);
      setServices(svcsRes?.data?.services || []);
      setProfessionals(pros || []);
    } finally {
      setLoading(false);
    }
  };

  // Se recarga tambien cuando termina de resolverse quien soy: en el primer render
  // `professional` todavia es null y un profesional invitado se veria a si mismo como
  // dueno, quedandose con el practice_owner_id equivocado.
  useEffect(() => { load(); }, [isClinic, isOwner, professional?.practice_owner_id]);

  const proById = useMemo(() => Object.fromEntries(professionals.map((p) => [p.id, p])), [professionals]);

  const filteredServices = useMemo(() => {
    if (!isClinic || filterProId === "all") return services;
    const target = filterProId === OWNER_VALUE ? "" : filterProId;
    return services.filter((s) => (s.professional_ref_id || "") === target);
  }, [services, filterProId, isClinic]);

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (s) => { setEditing(s); setForm({ ...s, price: s.price ?? "", professional_ref_id: s.professional_ref_id || "" }); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name) return;
    setSaving(true);
    try {
      const data = { ...form, price: form.price === "" ? null : Number(form.price), duration_minutes: Number(form.duration_minutes), margin_minutes: Number(form.margin_minutes), follow_up_days: Number(form.follow_up_days) };
      if (editing) {
        await base44.entities.Service.update(editing.id, data);
      } else {
        await base44.entities.Service.create({ ...data, practice_owner_id: practiceOwnerId || undefined });
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
    } catch (err) {
      // Si ya no existía del lado del servidor (pantalla con datos viejos de una sesión
      // larga), no lo dejamos como tarjeta fantasma imposible de borrar: recargamos.
      toast({ title: "Ese servicio ya no existía", description: "Actualizamos la lista.", variant: "destructive" });
    } finally {
      load();
    }
  };

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        {showHeader ? (
          <div>
            <h2 className="font-heading font-semibold">Servicios</h2>
            <p className="text-sm text-muted-foreground">Tipos de consulta, precios, duración y notas de preparación</p>
          </div>
        ) : <div />}
        <Button onClick={openNew} className="shadow-sm shrink-0"><Plus className="w-4 h-4 mr-1" /> Nuevo</Button>
      </div>

      {isClinic && professionals.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setFilterProId("all")} className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${filterProId === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>Todos</button>
          <button onClick={() => setFilterProId(OWNER_VALUE)} className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${filterProId === OWNER_VALUE ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>Dueño de la cuenta</button>
          {professionals.map((p) => (
            <button key={p.id} onClick={() => setFilterProId(p.id)} className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${filterProId === p.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
              {p.first_name} {p.last_name}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-muted-foreground text-sm">{services.length === 0 ? "Aún no cargaste servicios. Creá tu primer tipo de consulta." : "Sin servicios para este profesional."}</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filteredServices.map((s) => {
            const pro = s.professional_ref_id ? proById[s.professional_ref_id] : null;
            return (
              <div key={s.id} className="bg-card rounded-2xl border border-border p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-start gap-3">
                  <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: s.color || "#3b82f6" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-heading font-medium">{s.name}</p>
                      {!s.active && <Badge variant="secondary">Inactivo</Badge>}
                      {isClinic && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          <User className="w-3 h-3" /> {pro ? `${pro.first_name} ${pro.last_name || ""}`.trim() : "Dueño de la cuenta"}
                        </span>
                      )}
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
            );
          })}
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
            {isClinic && professionals.length > 0 && (
              <div className="space-y-1.5">
                <Label>Profesional</Label>
                <Select value={form.professional_ref_id || OWNER_VALUE} onValueChange={(v) => set("professional_ref_id", v === OWNER_VALUE ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OWNER_VALUE}>Dueño de la cuenta</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
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
