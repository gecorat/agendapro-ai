import React from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import WelcomeGuide from "@/pages/WelcomeGuide";
import Dashboard from "@/pages/Dashboard";
import PublicLinkCard from "@/components/PublicLinkCard";

function PublicLinkBar({ handle, practiceName, brand }) {
  const cleanHandle = (handle || "").trim().replace(/^@/, "").replace(/\s+/g, "");
  if (!cleanHandle) return null;
  const url = (typeof window !== "undefined" ? window.location.origin : "") + `/u/${cleanHandle}`;
  return <PublicLinkCard url={url} practiceName={practiceName} brand={brand || "#0000ff"} variant="bar" />;
}

// Un profesional invitado por una cuenta Clinic ve este aviso en su Panel — nunca tuvo
// su propia página ni su propio bot, así que vale la pena mostrarle qué se está
// perdiendo, sin ser invasivo (una sola tarjeta, no un modal que interrumpa).
function OwnPlanTeaser() {
  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
        <Sparkles className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-heading font-semibold text-sm">Tené tu propio consultorio</p>
        <p className="text-xs text-muted-foreground mt-0.5">Además de atender por acá, podrías tener tu propia página de reservas, tu bot de WhatsApp y tu agenda 100% independiente.</p>
        <Link to="/upgrade-plan" className="inline-block mt-2 text-xs font-medium text-primary hover:underline">Ver planes →</Link>
      </div>
    </div>
  );
}

export default function Home() {
  const { settings, loading, isInvitedProfessional } = usePracticeSettings();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const status = getPlanStatus(settings);

  return (
    <div className="px-3 py-3 md:p-6 space-y-4">
      {isInvitedProfessional && <OwnPlanTeaser />}
      {settings?.handle && <PublicLinkBar handle={settings.handle} practiceName={settings.practice_name} brand={settings.page_color} />}
      {status.hasPaidPlan ? <Dashboard /> : <WelcomeGuide />}
    </div>
  );
}
