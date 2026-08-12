import React from "react";
import { Link } from "react-router-dom";
import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";

export default function PlanGate({ feature, requiredPlan = "pro", description }) {
  const price = PLAN_PRICES[requiredPlan] || "";
  return (
    <div className="relative rounded-xl border border-dashed border-border bg-accent/40 p-6 text-center">
      <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
        <Lock className="w-5 h-5 text-primary" />
      </div>
      <p className="font-heading font-semibold">{feature}</p>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
        {description || `Esta función está disponible a partir del plan ${PLAN_LABELS[requiredPlan]}.`}
      </p>
      <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-card border border-border px-3 py-1.5 text-sm">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <span className="font-semibold">{PLAN_LABELS[requiredPlan]}</span>
        <span className="text-muted-foreground">{price} ARS / mes</span>
      </div>
      <div className="mt-4">
        <Button asChild>
          <Link to="/configuracion">Pasar a {PLAN_LABELS[requiredPlan]}</Link>
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        Contactanos para activar tu plan. La recurrencia automática con Mercado Pago se habilita próximamente.
      </p>
    </div>
  );
}