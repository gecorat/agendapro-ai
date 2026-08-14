import React from "react";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, CalendarClock, Calendar, Users, Mail, BarChart3 } from "lucide-react";
import { getPlanStatus } from "@/lib/plan-utils";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";

const TRIAL_ACCESS = [
  { icon: CalendarClock, label: "Página de citas" },
  { icon: Calendar, label: "Agenda" },
  { icon: Users, label: "Pacientes" },
  { icon: Mail, label: "Recordatorios" },
  { icon: BarChart3, label: "Reportes" },
];

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
        <Link to="/upgrade-plan" className="ml-auto underline font-medium whitespace-nowrap shrink-0">Ver planes</Link>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-4 py-2 text-sm sm:text-base text-amber-800">
      <div className="flex items-center gap-2">
        <Clock className="w-4 h-4 shrink-0" />
        <span className="truncate">
          <span className="sm:hidden">Prueba:</span>
          <span className="hidden sm:inline">Te quedan</span>
          <strong className="mx-1">{status.daysLeft}</strong>
          <span>día{status.daysLeft === 1 ? "" : "s"}</span>
          <span className="hidden sm:inline"> de prueba.</span>
        </span>
        <Link to="/upgrade-plan" className="ml-auto underline font-medium whitespace-nowrap shrink-0">Ver planes</Link>
      </div>
      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
        {TRIAL_ACCESS.map((item, i) => {
          const Icon = item.icon;
          return (
            <React.Fragment key={item.label}>
              <span className="flex items-center gap-1 text-amber-700 whitespace-nowrap shrink-0">
                <Icon className="w-3 h-3" />
                {item.label}
              </span>
              {i < TRIAL_ACCESS.length - 1 && <span className="text-amber-400 shrink-0">·</span>}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}