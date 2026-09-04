import React from "react";
import { Link } from "react-router-dom";
import PracticeProfileSection from "@/components/PracticeProfileSection";

export default function ProfileEditor() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-heading font-semibold">Mi perfil profesional</h1>
        {/* El subtítulo prometía foto, descripción, color y handle — nada de eso se edita
            acá, sino en la página pública. Esa promesa era la que hacía que el profesional
            completara esta pantalla y no entendiera por qué el paso de la guía seguía
            pendiente. */}
        <p className="text-sm text-muted-foreground">
          Tus datos y los del consultorio. La foto, la descripción y tu @usuario se configuran en{" "}
          <Link to="/public-page-editor" className="underline font-medium text-foreground">Mi página pública</Link>.
        </p>
      </div>
      <PracticeProfileSection />
    </div>
  );
}