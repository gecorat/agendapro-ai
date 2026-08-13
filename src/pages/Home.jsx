import React, { useState } from "react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import WelcomeGuide from "@/pages/WelcomeGuide";
import Dashboard from "@/pages/Dashboard";
import { Link as LinkIcon, Check, ExternalLink } from "lucide-react";

function PublicLinkBar({ handle }) {
  const [copied, setCopied] = useState(false);
  const cleanHandle = (handle || "").trim().replace(/^@/, "").replace(/\s+/g, "");
  if (!cleanHandle) return null;
  const url = (typeof window !== "undefined" ? window.location.origin : "") + `/u/${cleanHandle}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <LinkIcon className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="text-xs font-mono text-emerald-700 truncate">{url}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button onClick={copy} className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md border border-emerald-500/30 text-emerald-700 hover:bg-emerald-500/10 transition-colors">
          {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : "Copiar"}
        </button>
        <a href={`/u/${cleanHandle}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">
          <ExternalLink className="w-3.5 h-3.5" /> Abrir página
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
    <div className="p-4 md:p-6 space-y-4">
      {settings?.handle && <PublicLinkBar handle={settings.handle} />}
      {status.hasPaidPlan ? <Dashboard /> : <WelcomeGuide />}
    </div>
  );
}