import React from "react";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle } from "lucide-react";
import { getPlanStatus, PLAN_LABELS } from "@/lib/plan-utils";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";

export default function TrialBanner() {
  const { settings } = usePracticeSettings();
  const status = getPlanStatus(settings);

  if (!status.loaded) return null;
  if (status.hasPaidPlan) return null;

  if (status.trialExpired) {
    return (
      <div className="bg-destructive/10 border-b border-destructive/20 px-4 py-2.5 text-sm flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="font-medium">Tu período de prueba terminó.</span>
        <span className="text-destructive/80 hidden sm:inline">Adquirí un plan para seguir usando AgendaPro.</span>
        <Link to="/configuracion" className="ml-auto underline font-medium whitespace-nowrap">Ver planes</Link>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm flex items-center gap-2 text-amber-800">
      <Clock className="w-4 h-4 shrink-0" />
      <span>Periodo de prueba: te quedan <strong>{status.daysLeft}</strong> día{status.daysLeft === 1 ? "" : "s"}.</span>
      <Link to="/configuracion" className="ml-auto underline font-medium whitespace-nowrap">Ver planes</Link>
    </div>
  );
}