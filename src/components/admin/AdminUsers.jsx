import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Clock, Calendar, UserPlus, Trash2 } from "lucide-react";
import { PLAN_LABELS } from "@/lib/plan-utils";

function statusFor(settings) {
  if (!settings) return { label: "Sin configurar", color: "text-muted-foreground" };
  const plan = settings.plan || "trial";
  if (settings.suspended) return { label: "Suspendido", color: "text-destructive" };
  if (plan === "trial") {
    const end = settings.trial_ends_at ? new Date(settings.trial_ends_at) : null;
    const expired = end && end < new Date();
    return expired
      ? { label: "Trial expirado", color: "text-destructive" }
      : { label: "Trial activo", color: "text-emerald-600" };
  }
  return { label: PLAN_LABELS[plan], color: "text-primary" };
}

export default function AdminUsers() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [settingsByUser, setSettingsByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const inviteUser = async () => {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(email, "user");
      toast({ title: "Invitación enviada", description: `${email} recibirá un correo para registrarse.` });
      setInviteEmail("");
      setInviteOpen(false);
      load();
    } catch (err) {
      toast({ title: "Error al invitar", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [u, allSettings] = await Promise.all([
        base44.entities.User.list(),
        base44.entities.PracticeSettings.list(),
      ]);
      setUsers(u || []);
      const map = {};
      (allSettings || []).forEach((s) => {
        map[s.created_by_id] = s;
      });
      setSettingsByUser(map);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const deleteUser = async (u, settings) => {
    if (!window.confirm(`¿Eliminar a ${u.full_name || u.email}? Se borrarán sus datos de configuración. Esta acción no se puede deshacer.`)) return;
    try {
      if (settings?.id) {
        try { await base44.entities.PracticeSettings.delete(settings.id); } catch {}
      }
      await base44.entities.User.delete(u.id);
      toast({ title: "Profesional eliminado" });
      load();
    } catch (err) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    }
  };

  const setPlan = async (settings, plan) => {
    try {
      const data = { plan, suspended: false };
      if (plan === "trial") {
        const end = new Date(); end.setDate(end.getDate() + 14);
        data.trial_ends_at = end.toISOString();
      }
      await base44.entities.PracticeSettings.update(settings.id, data);
      toast({ title: `Plan actualizado a ${PLAN_LABELS[plan]}` });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const extendTrial = async (settings) => {
    try {
      const end = new Date(); end.setDate(end.getDate() + 14);
      await base44.entities.PracticeSettings.update(settings.id, { trial_ends_at: end.toISOString(), plan: "trial", suspended: false });
      toast({ title: "Trial extendido 14 días" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleSuspend = async (settings, suspend) => {
    try {
      await base44.entities.PracticeSettings.update(settings.id, { suspended: suspend });
      toast({ title: suspend ? "Cuenta suspendida" : "Cuenta reactivada" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 gap-2">
        <h2 className="font-heading font-semibold">Profesionales ({users.filter(u => u.role !== "admin").length})</h2>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <UserPlus className="w-4 h-4 mr-1" /> Invitar
        </Button>
      </div>
      <Dialog open={inviteOpen} onOpenChange={(o) => setInviteOpen(o)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Invitar profesional</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">El invitado recibirá un correo para registrarse. Una vez que complete el onboarding, podrá asignarle un plan (incluido Premium) desde esta misma lista.</p>
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email</Label>
              <Input id="invite-email" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="profesional@email.com" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancelar</Button>
            <Button onClick={inviteUser} disabled={inviting || !inviteEmail.trim()}>
              {inviting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Enviar invitación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="space-y-2">
        {users.filter(u => u.role !== "admin").map((u) => {
          const s = settingsByUser[u.id];
          const st = statusFor(s);
          return (
            <div key={u.id} className="p-3 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{u.full_name || u.email}</p>
                {u.full_name && <p className="text-xs text-muted-foreground truncate">{u.email}</p>}
                <p className="text-xs text-muted-foreground truncate">
                  {s ? `Origen: ${s.trial_origin || "landing"}` : "Sin onboarding"}{" · "}
                  <span className={st.color}>{st.label}</span>
                  {s?.trial_ends_at && s.plan === "trial" && (
                    <span> · hasta {new Date(s.trial_ends_at).toLocaleDateString("es-AR")}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {s ? (
                  <>
                    <Select value={s.plan || "trial"} onValueChange={(v) => setPlan(s, v)}>
                      <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="trial">Trial</SelectItem>
                        <SelectItem value="pro">Pro</SelectItem>
                        <SelectItem value="premium">Premium</SelectItem>
                      </SelectContent>
                    </Select>
                    {s.plan === "trial" && (
                      <Button size="sm" variant="outline" onClick={() => extendTrial(s)} title="Extender trial 14 días" className="gap-1">
                        <Clock className="w-4 h-4" /> Extender
                      </Button>
                    )}
                    <Button size="sm" variant={s.suspended ? "outline" : "destructive"} onClick={() => toggleSuspend(s, !s.suspended)}>
                      {s.suspended ? "Activar" : "Suspender"}
                    </Button>
                  </>
                ) : null}
                <Button size="sm" variant="destructive" onClick={() => deleteUser(u, s)} title="Eliminar profesional">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {users.filter(u => u.role !== "admin").length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-6">Aún no hay profesionales registrados.</p>
        )}
      </div>
    </Card>
  );
}