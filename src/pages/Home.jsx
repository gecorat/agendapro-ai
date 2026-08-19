import React, { useState } from "react";
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