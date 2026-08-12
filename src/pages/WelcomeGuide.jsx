import React from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserCircle, ClipboardList, CalendarClock, MessageCircle, CreditCard, Check } from "lucide-react";

const STEPS = [
  { icon: UserCircle, title: "Configurá tu perfil", desc: "Subí tu foto, escribí una descripción y elegí tu handle para tu página de reservas pública.", cta: "Ir a mi perfil", to: "/profile-editor" },
  { icon: ClipboardList, title: "Cargá tus servicios", desc: "Creá los tipos de consulta que ofrecés, con duración, precio y notas de preparación.", cta: "Gestionar servicios", to: "/service-manager" },
  { icon: CalendarClock, title: "Definí tus horarios", desc: "Configurá tu disponibilidad semanal y las excepciones (feriados, bloques).", cta: "Configurar horarios", to: "/availability-settings" },
  { icon: MessageCircle, title: "Probá el bot", desc: "Simulá conversaciones reales con el asistente usando tus propios servicios y agenda.", cta: "Probar el bot", to: "/bot" },
  { icon: CreditCard, title: "Activá tu plan", desc: "Cuando estés listo, pasá a Pro o Premium para habilitar WhatsApp y funcionalidades premium.", cta: "Ver planes", to: "/upgrade-plan" },
];

export default function WelcomeGuide() {
  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-semibold">Guía de bienvenida</h1>
        <p className="text-sm text-muted-foreground">5 pasos para tener tu agenda automatizada funcionando</p>
      </div>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <p className="text-sm">
          👋 ¡Bienvenido a AgendaPro! Seguí estos pasos en orden. En menos de 10 minutos vas a tener tu consultorio configurado y el bot listo para probar.
        </p>
      </Card>

      <div className="space-y-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <Card key={s.title} className="p-4">
              <div className="flex gap-3">
                <div className="shrink-0 flex flex-col items-center">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{i + 1}</div>
                  {i < STEPS.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <h3 className="font-heading font-semibold">{s.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                  <Button size="sm" variant="outline" className="mt-3" asChild>
                    <Link to={s.to}>{s.cta}</Link>
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Check className="w-4 h-4 text-emerald-500" />
          <p className="text-sm font-medium">¿Listo?</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Cuando completes los pasos, tu consultorio estará listo para recibir reservas automáticas por WhatsApp.</p>
      </Card>
    </div>
  );
}