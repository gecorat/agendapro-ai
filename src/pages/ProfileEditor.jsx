import React from "react";
import PracticeProfileSection from "@/components/PracticeProfileSection";

export default function ProfileEditor() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-heading font-semibold">Mi perfil profesional</h1>
        <p className="text-sm text-muted-foreground">Configurá tu foto, descripción, color de marca y handle público</p>
      </div>
      <PracticeProfileSection />
    </div>
  );
}