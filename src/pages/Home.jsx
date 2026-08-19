import React, { useState } from "react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import WelcomeGuide from "@/pages/WelcomeGuide";
import Dashboard from "@/pages/Dashboard";
import { Link2, Check, ExternalLink, Copy, Share2 } from "lucide-react";

function PublicLinkBar({ handle, practiceName, brand }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const cleanHandle = (handle || "").trim().replace(/^@/, "").replace(/\s+/g, "");
  if (!cleanHandle) return null;
  const url = (typeof window !== "undefined" ? window.location.origin : "") + `/u/${cleanHandle}`;
  const color = brand || "#0000ff";

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: practiceName || "Reservá tu turno", text: "Reservá tu turno online:", url });
      } catch { /* usuario canceló */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl border" style={{ borderColor: `${color}33`, background: `${color}0d` }}>
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${color}22` }}>
          <Link2 className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-mono truncate" style={{ color }}>{url}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-card hover:bg-muted transition-colors" style={{ borderColor: `${color}44`, color }}>
          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copiado" : "Copiar"}
        </button>
        <button onClick={share} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-card hover:bg-muted transition-colors" style={{ borderColor: `${color}44`, color }}>
          <Share2 className="w-3.5 h-3.5" /> {shared ? "Copiado" : "Compartir"}
        </button>
        <a href={`/u/${cleanHandle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white transition-colors" style={{ backgroundColor: color }}>
          <ExternalLink className="w-3.5 h-3.5" /> Ver página
        </a>
      </div>
    </div>
  );
}

export default function Home() {
  const { settings, loading } = usePracticeSettings();

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
      {settings?.handle && <PublicLinkBar handle={settings.handle} practiceName={settings.practice_name} brand={settings.page_color} />}
      {status.hasPaidPlan ? <Dashboard /> : <WelcomeGuide />}
    </div>
  );
}