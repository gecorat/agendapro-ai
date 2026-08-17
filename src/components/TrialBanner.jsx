import React from "react";
import { Link } from "react-router-dom";
import { Clock, AlertTriangle, CalendarClock, Calendar, Users, Mail, ChevronRight } from "lucide-react";
import { getPlanStatus } from "@/lib/plan-utils";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";

const TRIAL_ACCESS = [
  { icon: CalendarClock, label: "Reservas" },
  { icon: Calendar, label: "Agenda" },
  { icon: Users, label: "Pacientes" },
  { icon: Mail, label: "Recordatorios" },
];

export default function TrialBanner() {
  const { settings } = usePracticeSettings();
  const status = getPlanStatus(settings);

  if (!status.loaded) return null;
  if (status.hasPaidPlan) return null;

  if (status.trialExpired) {
    return (
      <div className="bg-red-50 border-b border-red-200 px-3 sm:px-4 py-2 text-sm text-red-800">
        <div className="flex items-center gap-2 max-w-7xl mx-auto">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-medium truncate">Tu prueba gratuita terminó.</span>
          <span className="text-red-700/80 hidden sm:inline truncate">Activá un plan para seguir usando Kame Agenda.</span>
          <Link to="/upgrade-plan" className="ml-auto inline-flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white text-xs font-medium px-3 py-1.5 rounded-md whitespace-nowrap shrink-0">
            Ver planes <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-amber-50 border-b border-amber-200 px-3 sm:px-4 py-2 text-amber-900">
      <div className="flex items-center gap-2 max-w-7xl mx-auto">
        <Clock className="w-4 h-4 shrink-0 text-amber-600" />
        <span className="text-sm font-medium truncate">
          Te quedan <strong>{status.daysLeft}</strong> día{status.daysLeft === 1 ? "" : "s"} de prueba
        </span>
        <Link to="/upgrade-plan" className="ml-auto inline-flex items-center gap-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium px-3 py-1.5 rounded-md whitespace-nowrap shrink-0">
          Ver planes <ChevronRight className="w-3 h-3" />
        </Link>
      </div>
      <div className="flex items-center gap-x-3 gap-y-1 mt-1.5 flex-wrap max-w-7xl mx-auto">
        <span className="text-xs text-amber-700 font-medium">Incluido:</span>
        {TRIAL_ACCESS.map((item) => {
          const Icon = item.icon;
          return (
            <span key={item.label} className="flex items-center gap-1 text-xs text-amber-800">
              <Icon className="w-3 h-3" />
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}