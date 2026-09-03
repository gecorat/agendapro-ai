import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fetchScopedProfessionals } from "@/lib/professionals";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, getWhatsAppUsage, getUsagePeriod, formatDate, PLAN_PRICES, PLAN_LABELS, PLAN_INCLUDES, CLINIC_MAX_PROFESSIONALS, showClinicPlan } from "@/lib/plan-utils";
import { Check, Loader2, Sparkles, CreditCard, Lock, MessageCircle, Users, Calendar, XCircle, ShieldCheck, ArrowRightLeft, RefreshCw, Wallet, CalendarCheck, Clock, Package, Repeat } from "lucide-react";

const BASIC_FEATURES = ["Página pública de reservas", "Agenda manual + calendario", "Gestión de pacientes", "Confirmaciones por email", "Envío manual por WhatsApp"];
const PRO_FEATURES = ["Bot de WhatsApp con IA 24/7", "Conexión de tu propio número", "Recordatorios automáticos por WhatsApp", "Hasta 300 conversaciones mensuales"];
const CLINIC_FEATURES = ["Hasta 3 profesionales con agendas independientes", "Un WhatsApp centralizado que reparte turnos", "Hasta 1.000 conversaciones mensuales", "Reportes por profesional"];

// Etiquetas en castellano de los estados que devuelve Mercado Pago, para no mostrarle al
// usuario el string crudo de la API.
const MP_STATUS = {
  authorized: { label: "Activa", className: "bg-emerald-100 text-emerald-700" },
  pending: { label: "Pendiente de aprobación", className: "bg-amber-100 text-amber-700" },
  paused: { label: "Pausada", className: "bg-amber-100 text-amber-700" },
  cancelled: { label: "Cancelada", className: "bg-destructive/10 text-destructive" },
};

const FREQUENCY_LABELS = { months: "mes", days: "día" };

function DetailRow({ icon: Icon, label, value, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/50 last:border-0 last:pb-0">
      <span className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
        <Icon className="w-3.5 h-3.5" /> {label}
      </span>
      <span className="text-sm font-medium text-right min-w-0">
        {value}
        {hint && <span className="block text-xs font-normal text-muted-foreground mt-0.5">{hint}</span>}
      </span>
    </div>
  );
}

function CurrentPlanCard({ settings, status, subscription, loadingSub, onCancel, cancelling, professionalCount }) {
  const usage = getWhatsAppUsage(settings);
  const period = getUsagePeriod(settings);
  const hasWhatsAppLimit = status.plan === "pro" || status.plan === "clinic";
  const includes = PLAN_INCLUDES[status.plan] || [];
  const pct = Math.min(100, Math.round(usage.ratio * 100));
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : "bg-primary";
  const mp = subscription ? MP_STATUS[subscription.status] : null;

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Plan actual</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <p className="font-heading font-bold text-2xl">{PLAN_LABELS[status.plan] || "—"}</p>
            {PLAN_PRICES[status.plan] && (
              <span className="text-sm text-muted-foreground">{PLAN_PRICES[status.plan]} ARS / mes</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {settings?.plan_granted_by_admin && (
            <Badge className="bg-primary/10 text-primary gap-1"><ShieldCheck className="w-3 h-3" /> Asignado por admin</Badge>
          )}
          {status.isTrial && (
            <Badge className={status.trialExpired ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}>
              {status.trialExpired ? "Prueba expirada" : `${status.daysLeft} días de prueba`}
            </Badge>
          )}
          {status.active
            ? <Badge className="bg-emerald-100 text-emerald-700">Cuenta activa</Badge>
            : <Badge className="bg-destructive/10 text-destructive">{status.suspended ? "Cuenta suspendida" : "Cuenta inactiva"}</Badge>}
        </div>
      </div>

      {includes.length > 0 && (
        <div className="rounded-xl border border-border/60 p-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Tu plan incluye</p>
          <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {includes.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-1" /> {f}
              </li>
            ))}
          </ul>
        </div>
      )}

      {status.isTrial && (
        <div className="rounded-xl bg-muted/50 p-3">
          <DetailRow
            icon={Clock}
            label="Tu prueba termina"
            value={formatDate(settings?.trial_ends_at, { day: "numeric", month: "long", year: "numeric" })}
            hint={status.trialExpired ? "Ya venció — elegí un plan para reactivar la cuenta" : `Te quedan ${status.daysLeft} días`}
          />
        </div>
      )}

      {hasWhatsAppLimit && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground"><MessageCircle className="w-3.5 h-3.5" /> Conversaciones de WhatsApp</span>
            <span className="font-medium">{usage.used} / {usage.total} <span className={pct >= 90 ? "text-amber-600" : "text-muted-foreground"}>({pct}%)</span></span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
          </div>
          <div className="rounded-xl bg-muted/50 px-3 py-1">
            <DetailRow
              icon={Package}
              label="Cupo del período"
              value={`${usage.total} conversaciones`}
              hint={usage.addon > 0 ? `${usage.base} del plan + ${usage.addon} de packs adicionales` : `Incluidas en el plan ${PLAN_LABELS[status.plan]}`}
            />
            <DetailRow
              icon={Calendar}
              label="Ciclo en curso"
              value={`Desde el ${formatDate(period.start)}`}
              hint={`Te quedan ${usage.remaining} conversaciones disponibles`}
            />
            <DetailRow
              icon={RefreshCw}
              label="Se renueva el cupo"
              value={formatDate(period.resetsAt, { day: "numeric", month: "long", year: "numeric" })}
              hint={`${period.daysToReset === 1 ? "Mañana" : `En ${period.daysToReset} días`} · el mismo día de tu cobro`}
            />
          </div>
        </div>
      )}

      {status.plan === "clinic" && (
        <div className="flex items-center justify-between text-sm">
          <span className="flex items-center gap-1.5 text-muted-foreground"><Users className="w-3.5 h-3.5" /> Profesionales en el equipo</span>
          <span className="font-medium">{professionalCount} {professionalCount > CLINIC_MAX_PROFESSIONALS ? `(${professionalCount - CLINIC_MAX_PROFESSIONALS} con costo adicional)` : `/ ${CLINIC_MAX_PROFESSIONALS} incluidos`}</span>
        </div>
      )}

      {settings?.plan_granted_by_admin ? (
        <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
          Este plan te lo asignó un administrador de Kame Agenda: no hay suscripción de Mercado Pago detrás, así que no se te cobra nada.
        </div>
      ) : (
        <div className="rounded-xl bg-muted/50 p-3">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Facturación</p>
            {mp && <Badge className={mp.className}>Suscripción {mp.label.toLowerCase()}</Badge>}
          </div>

          {loadingSub ? (
            <span className="text-sm text-muted-foreground flex items-center gap-1.5 py-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Consultando tu suscripción en Mercado Pago...
            </span>
          ) : subscription ? (
            <>
              <DetailRow
                icon={Wallet}
                label="Monto mensual"
                value={`$${(subscription.amount || 0).toLocaleString("es-AR")} ARS`}
                hint={subscription.frequency ? `Cobro automático cada ${subscription.frequency} ${FREQUENCY_LABELS[subscription.frequency_type] || subscription.frequency_type || "mes"}${subscription.frequency > 1 ? "es" : ""}` : "Cobro automático mensual"}
              />
              {subscription.status === "authorized" && (
                <DetailRow
                  icon={Calendar}
                  label="Próximo cobro"
                  value={formatDate(subscription.next_payment_date, { day: "numeric", month: "long", year: "numeric" })}
                />
              )}
              {subscription.last_charged_date && (
                <DetailRow
                  icon={CalendarCheck}
                  label="Último cobro"
                  value={formatDate(subscription.last_charged_date, { day: "numeric", month: "long", year: "numeric" })}
                  hint={subscription.last_charged_amount ? `$${Number(subscription.last_charged_amount).toLocaleString("es-AR")} ARS` : null}
                />
              )}
              {subscription.created_at && (
                <DetailRow
                  icon={Repeat}
                  label="Suscripción activa desde"
                  value={formatDate(subscription.created_at, { day: "numeric", month: "long", year: "numeric" })}
                  hint={subscription.charged_quantity ? `${subscription.charged_quantity} cobro${subscription.charged_quantity > 1 ? "s" : ""} realizado${subscription.charged_quantity > 1 ? "s" : ""}` : null}
                />
              )}
              {subscription.status === "authorized" && (
                <div className="pt-3">
                  <Button size="sm" variant="outline" className="gap-1.5 text-destructive hover:text-destructive" onClick={onCancel} disabled={cancelling}>
                    {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Cancelar suscripción
                  </Button>
                </div>
              )}
            </>
          ) : status.hasPaidPlan ? (
            <p className="text-sm text-muted-foreground py-2">No encontramos una suscripción de Mercado Pago activa para esta cuenta.</p>
          ) : (
            <p className="text-sm text-muted-foreground py-2">Todavía no tenés una suscripción paga. Cuando elijas un plan acá abajo vas a ver el detalle de tus cobros.</p>
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
