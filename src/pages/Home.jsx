import React from "react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import WelcomeGuide from "@/pages/WelcomeGuide";
import Dashboard from "@/pages/Dashboard";

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
  if (!status.hasPaidPlan) {
    return <WelcomeGuide />;
  }
  return <Dashboard />;
}