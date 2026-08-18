import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, getWhatsAppUsage, ADDON_PACKS } from "@/lib/plan-utils";
import { Gauge, Loader2 } from "lucide-react";

export default function WhatsAppUsageCard() {
  const { settings } = usePracticeSettings();
  const { toast } = useToast();
  const [buying, setBuying] = useState(null);

  const status = getPlanStatus(settings);
  if (!status.canUseWhatsApp) return null;

  const usage = getWhatsAppUsage(settings);
  const pct = Math.min(100, Math.round(usage.ratio * 100));
  const barColor = pct >= 100 ? "bg-red-500" : pct >= 90 ? "bg-amber-500" : "bg-emerald-500";

  const buyPack = async (packId) => {
    setBuying(packId);
    try {
      const res = await base44.functions.invoke("buyWhatsAppAddonPack", { pack: packId, origin: window.location.origin });
      if (res?.data?.init_point) {
        window.location.href = res.data.init_point;
      } else {
        throw new Error(res?.data?.error || "No se pudo iniciar el pago");
      }
    } catch (e) {
      toast({ title: "No se pudo iniciar el pago", description: e?.response?.data?.error || e.message, variant: "destructive" });
      setBuying(null);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Gauge className="w-4 h-4 text-muted-foreground" />
        <p className="font-medium text-sm">Uso del bot este mes</p>
      </div>

      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">{usage.used} de {usage.total} conversaciones</span>
          <span className={pct >= 90 ? "font-semibold text-amber-600" : "text-muted-foreground"}>{pct}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>

      {pct >= 80 && (
        <div className="pt-1 space-y-2">
          <p className="text-xs text-muted-foreground">
            {pct >= 100
              ? "Se agotó el cupo de este mes. Mientras tanto, avisamos automáticamente a tus pacientes que los contactás vos directo."
              : "Te estás por quedar sin cupo. Sumá un pack para no interrumpir la atención."}
          </p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(ADDON_PACKS).map(([id, pack]) => (
              <Button key={id} size="sm" variant="outline" className="rounded-lg" onClick={() => buyPack(id)} disabled={buying === id}>
                {buying === id ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
                {pack.label} · ${pack.price.toLocaleString("es-AR")}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
