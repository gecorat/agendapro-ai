import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Loader2, Users, Mail, Copy, Check, Clock, UserCheck, ShieldCheck } from "lucide-react";
import { CLINIC_MAX_PROFESSIONALS } from "@/lib/plan-utils";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";

const EMPTY = { first_name: "", last_name: "", specialty: "", color: "#3b82f6", active: true };
const ADDON_PRICE = 10000;

// Gestión del equipo del plan Clinic. "Invitar" crea un enlace único: el profesional lo
// abre, crea SU PROPIA cuenta, y queda asociado a este consultorio con acceso acotado
// (su agenda, sus pacientes). "Agregar manual" sigue existiendo para quien preferís
// cargar vos mismo sin que tenga login propio (solo aparece como opción para el bot).
// El dueño real puede además promover a cualquier profesional invitado a "co-admin":
// ve y gestiona todo el consultorio como el dueño, menos facturación/plan.
export default function ProfessionalsPanel() {
  const { toast } = useToast();
  const { isOwner, professional: myProfessional } = usePracticeSettings();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [togglingAdminId, setTogglingAdminId] = useState(null);
  const [invitingId, setInvitingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      // Antes llamaba Professional.list() directo, sin filtrar por consultorio — mostraba
      // profesionales de OTRAS cuentas mezclados con los propios. Confirmado en vivo.
      const res = await base44.functions.invoke("getScopedProfessionals", {});
      setList(res?.data?.professionals || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const wouldBeAddon = list.length >= CLINIC_MAX_PROFESSIONALS;

  const confirmAddonIfNeeded = () => {
    if (!wouldBeAddon) return true;
    return confirm(
      `Ya tenés ${CLINIC_MAX_PROFESSIONALS} profesionales incluidos en tu plan Clinic. Sumar uno más agrega $${ADDON_PRICE.toLocaleString("es-AR")}/mes a tu suscripción, cobrados automáticamente. ¿Confirmás?`
    );
  };

  const handleInvite = async () => {
    if (!confirmAddonIfNeeded()) return;
    setInviting(true);
    setInviteLink(null);
    try {
      const res = await base44.functions.invoke("inviteProfessional", { origin: window.location.origin });
      setInviteLink(res?.data?.link);
      load();
    } catch (err) {
      toast({ title: "Error al generar la invitación", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  // Darle acceso propio a alguien que ya estaba cargado con "Agregar manual". No pasa por
  // confirmAddonIfNeeded a propósito: no se está sumando un profesional nuevo, así que no
  // hay ningún cobro adicional que confirmar — esta persona ya estaba contada desde que se
  // la creó.
  const handleInviteExisting = async (p) => {
    setInvitingId(p.id);
    setInviteLink(null);
    try {
      const res = await base44.functions.invoke("inviteProfessional", {
        origin: window.location.origin,
        professionalId: p.id,
      });
      setInviteLink(res?.data?.link);
      toast({
        title: `Enlace generado para ${p.first_name || "el profesional"}`,
        description: "Copíalo y mandáselo. Mientras tanto sigue apareciendo normalmente para agendar.",
      });
      load();
    } catch (err) {
      toast({
        title: "No se pudo generar el enlace",
        description: err?.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setInvitingId(null);
    }
  };

  const copyInviteLink = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* noop */ }
  };

  const openNew = () => { setEditing(null); setForm(EMPTY); setOpen(true); };
  const openEdit = (p) => { setEditing(p); setForm({ ...p }); setOpen(true); };
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const save = async (e) => {
    e.preventDefault();
    if (!form.first_name) return;
    if (!editing && !confirmAddonIfNeeded()) return;
    setSaving(true);
    try {
      if (editing) {
        // Toda edición pasa ahora por el backend. La RLS de Professional quedó en
        // solo-admin porque la regla anterior permitía escalar privilegios editando
        // practice_owner_id / is_team_admin a mano desde la consola del navegador (ver el
        // comentario largo en updateProfessionalProfile). Los permisos son exactamente los
        // mismos que antes: cada uno edita su propia ficha, y el dueño edita a su equipo.
        await base44.functions.invoke("updateProfessionalProfile", {
          professionalId: editing.id,
          first_name: form.first_name,
          last_name: form.last_name,
          specialty: form.specialty,
          color: form.color,
          active: form.active,
        });
      } else {
        const me = await base44.auth.me();
        const ownerId = isOwner ? me.id : (myProfessional?.practice_owner_id || me.id);
        await base44.entities.Professional.create({ ...form, practice_owner_id: ownerId, is_paid_addon: wouldBeAddon });
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
    const warn = p.is_paid_addon
      ? `¿Eliminar a ${p.first_name || "este profesional"}? Se va a dar de baja el cobro extra de $${ADDON_PRICE.toLocaleString("es-AR")}/mes automáticamente. Sus turnos y servicios ya cargados no se borran.`
      : `¿Eliminar a ${p.first_name || "este profesional"}? Sus turnos y servicios ya cargados no se borran, quedan sin profesional asignado.`;
    if (!confirm(warn)) return;
    try {
      await base44.functions.invoke("removeProfessional", { professionalId: p.id });
      toast({ title: "Profesional eliminado" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleAdmin = async (p) => {
    const next = !p.is_team_admin;
    const warn = next
      ? `¿Convertir a ${p.first_name} en co-admin? Va a poder ver y gestionar todo el consultorio (invitar gente, editar perfil/servicios/horarios, ver todos los pacientes) — todo menos facturación y el plan.`
      : `¿Sacarle el rol de co-admin a ${p.first_name}? Vuelve a ver solo su propia agenda y pacientes.`;
    if (!confirm(warn)) return;
    setTogglingAdminId(p.id);
    try {
      await base44.functions.invoke("setTeamAdmin", { professionalId: p.id, isTeamAdmin: next });
      toast({ title: next ? `${p.first_name} ahora es co-admin` : `${p.first_name} ya no es co-admin` });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setTogglingAdminId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-heading font-semibold">Profesionales</h2>
          <p className="text-sm text-muted-foreground">Invitá a alguien para que tenga su propia cuenta y agenda, o cargá un perfil simple vos mismo.</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" onClick={openNew} className="shadow-sm">
            <Plus className="w-4 h-4 mr-1" /> Agregar manual
          </Button>
          <Button onClick={handleInvite} disabled={inviting} className="shadow-sm">
            {inviting ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Mail className="w-4 h-4 mr-1" />} Invitar
          </Button>
        </div>
      </div>

      {wouldBeAddon && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-3">
          <p className="text-sm text-amber-800">
            Ya usaste los <strong>{CLINIC_MAX_PROFESSIONALS} profesionales incluidos</strong> en tu plan Clinic. El próximo que sumes agrega <strong>${ADDON_PRICE.toLocaleString("es-AR")}/mes</strong> a tu suscripción, cobrados automáticamente.
          </p>
        </div>
      )}

      {inviteLink && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-3 space-y-2">
          <p className="text-sm font-medium">Enlace de invitación generado</p>
          <div className="flex items-center gap-2">
            <Input value={inviteLink} readOnly className="text-xs font-mono bg-background" />
            <Button size="icon" variant="outline" onClick={copyInviteLink} className="shrink-0">
              {linkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Mandaselo por WhatsApp, email o como prefieras. Al abrirlo, esa persona crea su cuenta y queda asociada a tu equipo.</p>
        </div>
      )}

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
          {list.map((p) => {
            const isPending = p.invite_status === "pending";
            const hasOwnAccount = p.invite_status === "accepted";
            // Cargado a mano: existe como opción para agendar, pero no tiene cuenta propia.
            // A estos se les puede generar un enlace de acceso después de haberlos creado.
            const isManual = !isPending && !hasOwnAccount && !p.user_id;
            const linkAlreadySent = isManual && !!p.invite_token;
            return (
              <div key={p.id} className="bg-card rounded-2xl border border-border p-4 flex items-center gap-3">
                <div className="w-1.5 self-stretch rounded-full shrink-0" style={{ background: p.color || "#3b82f6" }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-heading font-medium">{isPending ? "Invitación pendiente" : `${p.first_name} ${p.last_name || ""}`}</p>
                    {isPending && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700"><Clock className="w-3 h-3" /> Esperando que acepte</span>
                    )}
                    {hasOwnAccount && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700"><UserCheck className="w-3 h-3" /> Cuenta propia activa</span>
                    )}
                    {p.is_team_admin && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"><ShieldCheck className="w-3 h-3" /> Co-admin</span>
                    )}
                    {p.is_paid_addon && (
                      <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">+${ADDON_PRICE.toLocaleString("es-AR")}/mes</span>
                    )}
                    {linkAlreadySent && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-sky-100 text-sky-700"><Mail className="w-3 h-3" /> Enlace de acceso enviado</span>
                    )}
                    {!p.active && !isPending && <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">Inactivo</span>}
                  </div>
                  {p.specialty && <p className="text-sm text-muted-foreground mt-0.5">{p.specialty}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* Un profesional cargado a mano existe como opción para agendar pero no
                      tiene cuenta ni panel propio. Este botón le genera el enlace para que
                      se cree la suya SIN borrarlo ni volver a cargarlo: conserva su ficha,
                      sus turnos ya agendados y su horario. Mismo permiso que "Invitar"
                      (dueño o co-admin), validado en el backend. */}
                  {isManual && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-xs gap-1"
                      onClick={() => handleInviteExisting(p)}
                      disabled={invitingId === p.id}
                    >
                      {invitingId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Mail className="w-3.5 h-3.5" />}
                      {linkAlreadySent ? "Nuevo enlace" : "Dar acceso"}
                    </Button>
                  )}
                  {/* Promover/degradar a co-admin: exclusivo del dueño real, y solo tiene
                      sentido una vez que la persona ya tiene su propia cuenta activa. */}
                  {isOwner && hasOwnAccount && (
                    <Button
                      size="sm"
                      variant={p.is_team_admin ? "outline" : "ghost"}
                      className="text-xs gap-1"
                      onClick={() => toggleAdmin(p)}
                      disabled={togglingAdminId === p.id}
                    >
                      {togglingAdminId === p.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                      {p.is_team_admin ? "Sacar admin" : "Hacer admin"}
                    </Button>
                  )}
                  {!isPending && (
                    <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => openEdit(p)}><Pencil className="w-4 h-4" /></Button>
                  )}
                  <Button size="icon" variant="ghost" className="rounded-lg" onClick={() => remove(p)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editar profesional" : "Agregar profesional manual"}</DialogTitle></DialogHeader>
          {!editing && (
            <p className="text-xs text-muted-foreground -mt-2">Esta persona no va a tener su propia cuenta ni login — solo aparece como opción al agendar. Para que tenga su propia agenda, usá "Invitar" en vez de esto.</p>
          )}
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
