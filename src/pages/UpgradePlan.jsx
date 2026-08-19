import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";
import { Check, Loader2, Sparkles, CreditCard, Lock } from "lucide-react";

const BASIC_FEATURES = ["Página pública de reservas", "Agenda manual + calendario", "Gestión de pacientes", "Confirmaciones por email", "Envío manual por WhatsApp"];
const PRO_FEATURES = ["Bot de WhatsApp con IA 24/7", "Conexión de tu propio número", "Recordatorios automáticos por WhatsApp", "Hasta 300 conversaciones mensuales"];
const CLINIC_FEATURES = ["Hasta 3 profesionales con agendas independientes", "Un WhatsApp centralizado que reparte turnos", "Hasta 1.000 conversaciones mensuales", "Reportes por profesional"];

export default function UpgradePlan() {
  const { toast } = useToast();
  const { settings } = usePracticeSettings();
  const status = getPlanStatus(settings);
  const [paying, setPaying] = useState(null);
  const [mpStatus, setMpStatus] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get("status");
    if (s) {
      setMpStatus(s);
      if (s === "success") {
        toast({ title: "¡Suscripción iniciada!", description: "En cuanto Mercado Pago confirme el pago, tu plan se activa solo." });
      }
    }
  }, [toast]);

  const handlePay = async (plan) => {
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
    } finally {
      setPaying(null);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-semibold">Centro de planes</h1>
        <p className="text-sm text-muted-foreground">Elegí tu plan y desbloqueá las funciones premium</p>
      </div>

      {mpStatus === "success" && (
        <Card className="p-4 border-emerald-500 bg-emerald-50">
          <p className="text-sm font-medium text-emerald-700">✓ Suscripción iniciada</p>
          <p className="text-sm text-emerald-600 mt-0.5">Mercado Pago va a confirmar el pago automáticamente y tu plan se activa solo, sin que tengas que hacer nada más.</p>
        </Card>
      )}

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Plan actual</p>
            <p className="font-heading font-semibold text-lg">{PLAN_LABELS[status.plan] || "—"}</p>
          </div>
          {status.isTrial && (
            <Badge className={status.trialExpired ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}>
              {status.trialExpired ? "Prueba expirada" : `${status.daysLeft} días de prueba`}
            </Badge>
          )}
        </div>
      </Card>

      <div className="grid md:grid-cols-3 gap-4">
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
          <Button className="mt-6" onClick={() => handlePay("clinic")} disabled={paying === "clinic" || status.plan === "clinic"}>
            {paying === "clinic" ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <CreditCard className="w-4 h-4 mr-1" />}
            {status.plan === "clinic" ? "Plan actual" : "Suscribirme"}
          </Button>
        </Card>
      </div>

      <Card className="p-4 bg-accent/40">
        <div className="flex items-start gap-2">
          <Lock className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
          <p className="text-sm text-muted-foreground">
            El pago se procesa de forma segura vía Mercado Pago como suscripción mensual recurrente: se cobra solo, y tu plan se activa y desactiva automáticamente según el estado del pago.
          </p>
        </div>
      </Card>
    </div>
  );
}
