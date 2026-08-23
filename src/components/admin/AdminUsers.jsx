import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Clock, UserPlus, Trash2, Ban, ShieldCheck, Crown, Copy, Check, Mail, XCircle } from "lucide-react";
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
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]);
  const [settingsByUser, setSettingsByUser] = useState({});
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);
  const [creatingOwnPlan, setCreatingOwnPlan] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const registerLink = (typeof window !== "undefined" ? window.location.origin : "") + "/register";

  const copyRegisterLink = async () => {
    try {
      await navigator.clipboard.writeText(registerLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* noop */ }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [meRes, u, allSettings] = await Promise.all([
        base44.auth.me(),
        base44.entities.User.list(),
        base44.entities.PracticeSettings.list(),
      ]);
      setMe(meRes);
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
      const data = { plan, plan_granted_by_admin: true };
      if (plan === "trial") {
        const end = new Date(); end.setDate(end.getDate() + 14);
        data.trial_ends_at = end.toISOString();
      }
      await base44.entities.PracticeSettings.update(settings.id, data);
      toast({ title: `Plan actualizado a ${PLAN_LABELS[plan]}`, description: "Marcado como asignado por admin — el cobro automático no lo va a tocar." });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // "Quitar override" = dejar de proteger esta cuenta del chequeo automático de
  // Mercado Pago. Mientras tiene el override, VOS controlás el plan a mano y el chequeo
  // de cada hora nunca la toca. Al sacarlo, vuelve a mandar Mercado Pago: si tiene una
  // suscripción real activa, el chequeo puede volver a cambiarle el plan o reactivarla.
  const clearAdminOverride = async (settings) => {
    if (!confirm("¿Dejar de controlar el plan de esta cuenta a mano? A partir de ahora, el chequeo automático de Mercado Pago (cada hora) va a poder cambiarle el plan según su suscripción real, sin que vos intervengas.")) return;
    try {
      await base44.entities.PracticeSettings.update(settings.id, { plan_granted_by_admin: false });
      toast({ title: "Ahora depende del cobro automático de Mercado Pago de nuevo" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const extendTrial = async (settings) => {
    try {
      const end = new Date(); end.setDate(end.getDate() + 14);
      await base44.entities.PracticeSettings.update(settings.id, { trial_ends_at: end.toISOString(), plan: "trial" });
      toast({ title: "Trial extendido 14 días" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const toggleSuspend = async (settings, suspend) => {
    try {
      await base44.entities.PracticeSettings.update(settings.id, {
        suspended: suspend,
        ...(suspend ? { plan_granted_by_admin: true } : {}),
      });
      toast({ title: suspend ? "Cuenta suspendida" : "Cuenta reactivada" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  // "Suspender pago": cancela la suscripción REAL en Mercado Pago. Antes no había
  // ninguna señal visual de que había funcionado más allá del toast (que desaparece) —
  // ahora, una vez cancelada, el botón cambia a un estado fijo "Pago cancelado" en vez
  // de seguir mostrando la misma acción disponible.
  const cancelRealPayment = async (settings) => {
    if (!confirm("¿Cancelar la suscripción REAL de esta cuenta en Mercado Pago? No se le va a cobrar más. Esta acción es sobre el dinero real, no solo sobre el acceso a la app.")) return;
    setCancellingId(settings.id);
    try {
      await base44.functions.invoke("adminCancelSubscription", { practiceSettingsId: settings.id });
      toast({ title: "Suscripción cancelada en Mercado Pago" });
      load();
    } catch (err) {
      toast({ title: "No se pudo cancelar", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setCancellingId(null);
    }
  };

  const grantOwnPlan = async (plan) => {
    setCreatingOwnPlan(true);
    try {
      const existing = settingsByUser[me.id];
      const data = { plan, plan_granted_by_admin: true, suspended: false };
      if (existing) {
        await base44.entities.PracticeSettings.update(existing.id, data);
      } else {
        await base44.entities.PracticeSettings.create({
          ...data,
          practice_name: me.full_name || "Cuenta de administrador",
          professional_email: me.email,
        });
      }
      toast({ title: `Tu cuenta ahora tiene el plan ${PLAN_LABELS[plan]}, gratis` });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreatingOwnPlan(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  const myOwnSettings = me ? settingsByUser[me.id] : null;

  return (
    <div className="space-y-4">
      <Card className="p-4 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-2 mb-2">
          <Crown className="w-4 h-4 text-primary" />
          <h2 className="font-heading font-semibold">Tu cuenta de administrador</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-3">
          Asignate cualquier plan a vos mismo, gratis — sin suscripción real de Mercado Pago detrás, así que nunca hay cobro ni conflicto con el chequeo automático.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">
            Plan actual: <strong>{myOwnSettings ? PLAN_LABELS[myOwnSettings.plan] || myOwnSettings.plan : "Sin configurar"}</strong>
          </span>
          <div className="flex gap-1.5 ml-auto">
            {["trial", "basic", "pro", "clinic"].map((p) => (
              <Button key={p} size="sm" variant={myOwnSettings?.plan === p ? "default" : "outline"} disabled={creatingOwnPlan} onClick={() => grantOwnPlan(p)}>
                {PLAN_LABELS[p]}
              </Button>
            ))}
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3 gap-2">
          <h2 className="font-heading font-semibold">Profesionales ({users.filter((u) => u.role !== "admin").length})</h2>
          <Button size="sm" onClick={() => setInviteOpen(true)}>
            <UserPlus className="w-4 h-4 mr-1" /> Invitar
          </Button>
        </div>
        <Dialog open={inviteOpen} onOpenChange={(o) => setInviteOpen(o)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Enlace rápido de registro</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium flex items-center gap-1.5"><Copy className="w-3.5 h-3.5" /> Enlace para compartir</p>
                <p className="text-xs text-muted-foreground">Cualquiera que lo abra puede registrarse solo, sin que haga falta invitarlo uno por uno.</p>
                <div className="flex items-center gap-2">
                  <Input value={registerLink} readOnly className="text-xs font-mono" />
                  <Button size="icon" variant="outline" onClick={copyRegisterLink} className="shrink-0">
                    {linkCopied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground flex items-start gap-1.5">
                  <Mail className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  Para mandar una invitación personalizada por email (con la marca de Kame Agenda) y poder ver si ya se registró, andá a la pestaña <strong>Invitaciones</strong>, arriba.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInviteOpen(false)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <div className="space-y-2">
          {users.filter((u) => u.role !== "admin").map((u) => {
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
                    {s?.plan_granted_by_admin && (
                      <span className="text-primary font-medium"> · Vos controlás el plan a mano</span>
                    )}
                    {s?.mp_cancelled_by_admin && (
                      <span className="text-muted-foreground font-medium"> · Pago cancelado</span>
                    )}
                    {s?.mercadopago_subscription_id && !s?.mp_cancelled_by_admin && (
                      <span> · con suscripción real de MP</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  {s ? (
                    <>
                      <Select value={s.plan || "trial"} onValueChange={(v) => setPlan(s, v)}>
                        <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="trial">Trial</SelectItem>
                          <SelectItem value="basic">Básico</SelectItem>
                          <SelectItem value="pro">Pro</SelectItem>
                          <SelectItem value="clinic">Clinic</SelectItem>
                        </SelectContent>
                      </Select>
                      {s.plan === "trial" && (
                        <Button size="sm" variant="outline" onClick={() => extendTrial(s)} title="Extender trial 14 días" className="gap-1">
                          <Clock className="w-4 h-4" /> Extender
                        </Button>
                      )}
                      {s.plan_granted_by_admin && (
                        <Button size="sm" variant="outline" onClick={() => clearAdminOverride(s)} title="Dejar de controlar el plan a mano — vuelve a depender del cobro automático de Mercado Pago">
                          Volver a automático
                        </Button>
                      )}
                      {s.mp_cancelled_by_admin ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-border text-muted-foreground">
                          <XCircle className="w-3.5 h-3.5" /> Pago cancelado
                        </span>
                      ) : s.mercadopago_subscription_id && (
                        <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive" onClick={() => cancelRealPayment(s)} disabled={cancellingId === s.id} title="Cancela la suscripción real en Mercado Pago">
                          {cancellingId === s.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />} Suspender pago
                        </Button>
                      )}
                      <Button size="sm" variant={s.suspended ? "outline" : "destructive"} className="gap-1" onClick={() => toggleSuspend(s, !s.suspended)}>
                        <ShieldCheck className="w-4 h-4" /> {s.suspended ? "Activar" : "Suspender"}
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
          {users.filter((u) => u.role !== "admin").length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-6">Aún no hay profesionales registrados.</p>
          )}
        </div>
      </Card>
    </div>
  );
}
