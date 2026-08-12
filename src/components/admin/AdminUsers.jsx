import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Clock, Calendar } from "lucide-react";
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
      <h2 className="font-heading font-semibold mb-3">Profesionales ({users.filter(u => u.role !== "admin").length})</h2>
      <div className="space-y-2">
        {users.filter(u => u.role !== "admin").map((u) => {
          const s = settingsByUser[u.id];
          const st = statusFor(s);
          return (
            <div key={u.id} className="p-3 rounded-lg border border-border flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{u.full_name || u.email}</p>
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
                      <Button size="sm" variant="outline" onClick={() => extendTrial(s)} title="Extender trial 14 días">
                        <Clock className="w-4 h-4" />
                      </Button>
                    )}
                    <Button size="sm" variant={s.suspended ? "outline" : "destructive"} onClick={() => toggleSuspend(s, !s.suspended)}>
                      {s.suspended ? "Activar" : "Suspender"}
                    </Button>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground">Pendiente</span>
                )}
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