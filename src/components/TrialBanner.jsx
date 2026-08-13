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
      <div className="bg-destructive/10 border-b border-destructive/20 px-3 sm:px-4 py-1.5 text-xs sm:text-sm flex items-center gap-2 text-destructive">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="font-medium truncate">Prueba expirada.</span>
        <span className="text-destructive/80 hidden sm:inline truncate">Adquirí un plan para seguir usando AgendaPro.</span>
        <Link to="/configuracion" className="ml-auto underline font-medium whitespace-nowrap shrink-0">Ver planes</Link>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-4 py-1.5 text-xs sm:text-sm flex items-center gap-2 text-amber-800">
      <Clock className="w-4 h-4 shrink-0" />
      <span className="truncate">
        <span className="sm:hidden">Prueba:</span>
        <span className="hidden sm:inline">Te quedan</span>
        <strong className="mx-1">{status.daysLeft}</strong>
        <span>día{status.daysLeft === 1 ? "" : "s"}</span>
        <span className="hidden sm:inline"> de prueba.</span>
      </span>
      <Link to="/configuracion" className="ml-auto underline font-medium whitespace-nowrap shrink-0">Ver planes</Link>
    </div>
  );
}