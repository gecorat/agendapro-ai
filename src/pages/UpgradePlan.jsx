import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fetchScopedProfessionals } from "@/lib/professionals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, getWhatsAppUsage, PLAN_PRICES, PLAN_LABELS, CLINIC_MAX_PROFESSIONALS, showClinicPlan } from "@/lib/plan-utils";
import { Check, Loader2, Sparkles, CreditCard, Lock, MessageCircle, Users, Calendar, XCircle, ShieldCheck, ArrowRightLeft } from "lucide-react";

const BASIC_FEATURES = ["Página pública de reservas", "Agenda manual + calendario", "Gestión de pacientes", "Confirmaciones por email", "Envío manual por WhatsApp"];
const PRO_FEATURES = ["Bot de WhatsApp con IA 24/7", "Conexión de tu propio número", "Recordatorios automáticos por WhatsApp", "Hasta 300 conversaciones mensuales"];
const CLINIC_FEATURES = ["Hasta 3 profesionales con agendas independientes", "Un WhatsApp centralizado que reparte turnos", "Hasta 1.000 conversaciones mensuales", "Reportes por profesional"];

function CurrentPlanCard({ settings, status, subscription, loadingSub, onCancel, cancelling, professionalCount }) {
  const usage = getWhatsAppUsage(settings);
  const hasWhatsAppLimit = status.plan === "pro" || status.plan === "clinic";

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Plan actual</p>
          <p className="font-heading font-bold text-2xl">{PLAN_LABELS[status.plan] || "—"}</p>
        </div>
        <div className="flex items-center gap-2">
          {settings?.plan_granted_by_admin && (
            <Badge className="bg-primary/10 text-primary gap-1"><ShieldCheck className="w-3 h-3" /> Asignado por admin</Badge>
          )}
          {status.isTrial && (
            <Badge className={status.trialExpired ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}>
              {status.trialExpired ? "Prueba expirada" : `${status.daysLeft} días de prueba`}
            </Badge>
          )}
          {status.suspended && <Badge className="bg-destructive/10 text-destructive">Suspendido</Badge>}
        </div>
      </div>

      {hasWhatsAppLimit && (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><MessageCircle className="w-3.5 h-3.5" /> Conversaciones de WhatsApp este mes</span>
            <span className="font-medium">{usage.used} / {usage.total}</span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${Math.min(100, usage.ratio * 100)}%` }} />
          </div>
        </div>
      )}

      {status.plan === "clinic" && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="w-3.5 h-3.5" /> Profesionales en el equipo</span>
          <span className="font-medium">{professionalCount} {professionalCount > CLINIC_MAX_PROFESSIONALS ? `(${professionalCount - CLINIC_MAX_PROFESSIONALS} con costo adicional)` : `/ ${CLINIC_MAX_PROFESSIONALS} incluidos`}</span>
        </div>
      )}

      {!settings?.plan_granted_by_admin && (
        <div className="rounded-xl bg-muted/50 p-3 text-sm">
          {loadingSub ? (
            <span className="text-muted-foreground flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando tu suscripción en Mercado Pago...</span>
          ) : subscription ? (
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="w-3.5 h-3.5" />
                {subscription.status === "authorized"
                  ? `Próximo cobro: ${subscription.next_payment_date ? new Date(subscription.next_payment_date).toLocaleDateString("es-AR") : "—"} · $${(subscription.amount || 0).toLocaleString("es-AR")}`
                  : `Estado en Mercado Pago: ${subscription.status}`}
              </span>
              {subscription.status === "authorized" && (
                <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={onCancel} disabled={cancelling}>
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Cancelar suscripción
                </Button>
              )}
            </div>
          ) : status.hasPaidPlan ? (
            <span className="text-muted-foreground">No encontramos una suscripción de Mercado Pago activa para esta cuenta.</span>
          ) : (
            <span className="text-muted-foreground">Todavía no tenés una suscripción paga.</span>
          )}
        </div>
      )}
    </Card>
  );
}

export default function UpgradePlan() {
  const { toast } = useToast();
  const { settings, reload } = usePracticeSettings();
  const status = getPlanStatus(settings);
  const [paying, setPaying] = useState(null);
  const [mpStatus, setMpStatus] = useState(null);
  const [linkingReturn, setLinkingReturn] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [loadingSub, setLoadingSub] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [professionalCount, setProfessionalCount] = useState(0);
  const [switchConfirmPlan, setSwitchConfirmPlan] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    const preapprovalId = params.get("preapproval_id");
    if (s) {
      setMpStatus(s);
      if (s === "success") {
        toast({ title: "¡Suscripción iniciada!", description: "En cuanto Mercado Pago confirme el pago, tu plan se activa solo." });
      }
    }
    // Mercado Pago agrega el preapproval_id real a la URL al volver del checkout con plan
    // asociado — lo vinculamos a esta cuenta acá, sin haber tenido que pedir el email antes.
    if (preapprovalId) {
      setLinkingReturn(true);
      base44.functions.invoke("linkMpSubscription", { preapproval_id: preapprovalId })
        .then(async () => {
          await reload();
          await refreshSubscription();
        })
        .catch(() => {})
        .finally(() => {
          setLinkingReturn(false);
          const url = new URL(window.location.href);
          url.searchParams.delete("preapproval_id");
          window.history.replaceState({}, "", url.toString());
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toast]);

  const refreshSubscription = async () => {
    const subRes = await base44.functions.invoke("getSubscriptionDetails", {});
    setSubscription(subRes?.data?.subscription || null);
  };

  useEffect(() => {
    if (!settings) return;
    setLoadingSub(true);
    refreshSubscription().finally(() => setLoadingSub(false));
    if (status.plan === "clinic") {
      // activeOnly: false a propósito — el adicional pago se calcula sobre el total de
      // fichas del consultorio (así lo hace inviteProfessional), no solo las activas.
      fetchScopedProfessionals({ activeOnly: false }).then((rows) => setProfessionalCount(rows.length)).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.id, settings?.plan]);

  // Si ya hay una suscripción activa, cambiar de plan actualiza el monto de la MISMA
  // suscripción en Mercado Pago al instante — no hace falta pasar por el checkout de
  // nuevo (el medio de pago ya está cargado), y así nunca queda una suscripción vieja
  // huérfana cobrando en paralelo.
  const handlePay = async (plan) => {
    if (subscription?.status === "authorized") {
      setSwitchConfirmPlan(plan);
      return;
    }
    setPaying(plan);
    try {
      const res = await base44.functions.invoke("createMpPreference", { plan, origin: window.location.origin });
      if (res?.data?.init_point) {
        window.location.href = res.data.init_point;
      } else {
        throw new Error(res?.data?.error || "No se pudo iniciar el pago");
      }
    } catch (err) {
      toast({ title: "No se pudo iniciar el pago", description: err.message, variant: "destructive" });
      setPaying(null);
    }
  };

  const confirmSwitchPlan = async () => {
    const plan = switchConfirmPlan;
    setPaying(plan);
    try {
      const res = await base44.functions.invoke("createMpPreference", { plan, origin: window.location.origin });
      if (res?.data?.applied_immediately) {
        toast({ title: `Listo, ya estás en el plan ${PLAN_LABELS[plan]}`, description: "Se actualizó tu suscripción existente, sin generar un cobro duplicado." });
        await reload();
        await refreshSubscription();
      } else if (res?.data?.init_point) {
        window.location.href = res.data.init_point;
      } else {
        throw new Error(res?.data?.error || "No se pudo cambiar el plan");
      }
    } catch (err) {
      toast({ title: "No se pudo cambiar el plan", description: err.message, variant: "destructive" });
    } finally {
      setPaying(null);
      setSwitchConfirmPlan(null);
    }
  };

  const handleCancel = async () => {
    setCancelling(true);
    try {
      await base44.functions.invoke("cancelSubscription", {});
      toast({ title: "Suscripción cancelada", description: "Se canceló en Mercado Pago y tu cuenta quedó suspendida." });
      setCancelConfirmOpen(false);
      await reload();
      setSubscription((prev) => prev ? { ...prev, status: "cancelled" } : prev);
    } catch (err) {
      toast({ title: "No se pudo cancelar", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-semibold">Centro de planes</h1>
        <p className="text-sm text-muted-foreground">Tu plan actual, uso, y opciones para subir de nivel</p>
      </div>

      {mpStatus === "success" && (
        <Card className="p-4 border-emerald-500 bg-emerald-50">
          <p className="text-sm font-medium text-emerald-700 flex items-center gap-1.5">
            {linkingReturn && <Loader2 className="w-3.5 h-3.5 animate-spin" />} ✓ Suscripción iniciada
          </p>
          <p className="text-sm text-emerald-600 mt-0.5">Mercado Pago va a confirmar el pago automáticamente y tu plan se activa solo, sin que tengas que hacer nada más.</p>
        </Card>
      )}

      <CurrentPlanCard
        settings={settings}
        status={status}
        subscription={subscription}
        loadingSub={loadingSub}
        onCancel={() => setCancelConfirmOpen(true)}
        cancelling={cancelling}
        professionalCount={professionalCount}
      />

      <div>
        <h2 className="font-heading font-semibold mb-3">Cambiar de plan</h2>
        <div className={`grid ${showClinicPlan(status.plan) ? "md:grid-cols-3" : "md:grid-cols-2"} gap-4`}>
          <Card className={`p-6 flex flex-col ${status.plan === "basic" ? "border-2 border-primary" : ""}`}>
            <span className="font-heading font-semibold text-lg">Básico</span>
            <p className="text-3xl font-heading font-bold mt-2">{PLAN_PRICES.basic}<span className="text-sm font-normal text-muted-foreground"> ARS/mes</span></p>
            <ul className="mt-4 space-y-2.5 flex-1">
              {BASIC_FEATURES.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>)}
            </ul>
            <Button className="mt-6" onClick={() => handlePay("basic")} disabled={paying === "basic" || status.plan === "basic"}>
              {paying === "basic" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1" />}
              {status.plan === "basic" ? "Plan actual" : "Suscribirme"}
            </Button>
          </Card>

          <Card className={`p-6 flex flex-col ${status.plan === "pro" ? "border-2 border-primary" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-lg">Pro</span>
              <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">Popular</span>
            </div>
            <p className="text-3xl font-heading font-bold mt-2">{PLAN_PRICES.pro}<span className="text-sm font-normal text-muted-foreground"> ARS/mes</span></p>
            <ul className="mt-4 space-y-2.5 flex-1">
              <li className="text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1">Todo lo del Básico +</li>
              {PRO_FEATURES.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>)}
            </ul>
            <Button className="mt-6" onClick={() => handlePay("pro")} disabled={paying === "pro" || status.plan === "pro"}>
              {paying === "pro" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1" />}
              {status.plan === "pro" ? "Plan actual" : "Suscribirme"}
            </Button>
          </Card>

          {/* Plan Premium oculto temporalmente: solo lo ve quien ya lo tiene contratado
              (ver CLINIC_PLAN_VISIBLE en plan-utils.js). */}
          {showClinicPlan(status.plan) && (
          <Card className={`p-6 flex flex-col ${status.plan === "clinic" ? "border-2 border-primary" : ""}`}>
            <div className="flex items-center gap-2">
              <span className="font-heading font-semibold text-lg">{PLAN_LABELS.clinic}</span>
              <Sparkles className="w-4 h-4 text-amber-500" />
            </div>
            <p className="text-3xl font-heading font-bold mt-2">{PLAN_PRICES.clinic}<span className="text-sm font-normal text-muted-foreground"> ARS/mes</span></p>
            <ul className="mt-4 space-y-2.5 flex-1">
              <li className="text-xs font-medium text-muted-foreground uppercase tracking-wide pb-1">Todo lo del Pro +</li>
              {CLINIC_FEATURES.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>)}
            </ul>
            <p className="text-xs text-muted-foreground mt-2">+$10.000/mes por cada profesional que sumes más allá de los {CLINIC_MAX_PROFESSIONALS} incluidos.</p>
            <Button className="mt-4" onClick={() => handlePay("clinic")} disabled={paying === "clinic" || status.plan === "clinic"}>
              {paying === "clinic" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1" />}
              {status.plan === "clinic" ? "Plan actual" : "Suscribirme"}
            </Button>
          </Card>
          )}
        </div>
      </div>

      <Card className="p-4 bg-accent/40">
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            El pago se procesa de forma segura vía Mercado Pago como suscripción mensual recurrente: se cobra solo, y tu plan se activa y desactiva automáticamente según el estado del pago.
          </p>
        </div>
      </Card>

      <Dialog open={!!switchConfirmPlan} onOpenChange={(open) => !open && setSwitchConfirmPlan(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ArrowRightLeft className="w-4 h-4" /> Cambiar a plan {switchConfirmPlan && PLAN_LABELS[switchConfirmPlan]}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Ya tenés una suscripción activa — se actualiza el monto de la misma suscripción, sin crear una nueva ni cobrarte dos veces. El cambio aplica de inmediato.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSwitchConfirmPlan(null)}>Cancelar</Button>
            <Button onClick={confirmSwitchPlan} disabled={paying === switchConfirmPlan}>
              {paying === switchConfirmPlan && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Confirmar cambio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Cancelar tu suscripción?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-1">
            <p className="text-sm text-muted-foreground">
              Se cancela de inmediato en Mercado Pago y tu cuenta pasa a estar suspendida al toque — no se te va a cobrar de nuevo, pero perdés el acceso a las funciones pagas ahora mismo, no al final del período.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelConfirmOpen(false)}>Volver</Button>
            <Button variant="destructive" onClick={handleCancel} disabled={cancelling}>
              {cancelling && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Sí, cancelar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
