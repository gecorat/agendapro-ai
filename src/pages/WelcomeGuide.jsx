import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import { UserCircle, ClipboardList, CalendarClock, MessageCircle, CreditCard, Check, ArrowRight } from "lucide-react";

const STEPS = [
  { icon: UserCircle, title: "Configurá tu perfil", desc: "Subí tu foto, escribí una descripción y elegí tu @usuario para tu página de reservas pública.", cta: "Ir a mi perfil", to: "/profile-editor" },
  { icon: ClipboardList, title: "Cargá tus servicios", desc: "Creá los tipos de consulta que ofrecés, con duración, precio y notas de preparación.", cta: "Gestionar servicios", to: "/configuracion" },
  { icon: CalendarClock, title: "Definí tus horarios", desc: "Configurá tu disponibilidad semanal, pausas y feriados.", cta: "Configurar horarios", to: "/configuracion" },
  { icon: MessageCircle, title: "Probá el bot", desc: "Simulá conversaciones reales con el asistente usando tus propios servicios y agenda.", cta: "Probar el bot", to: "/bot" },
  { icon: CreditCard, title: "Activá tu plan", desc: "Cuando estés listo, pasá a Pro o Premium para habilitar WhatsApp y funcionalidades premium.", cta: "Ver planes", to: "/upgrade-plan" },
];

export default function WelcomeGuide() {
  const { settings, loading } = usePracticeSettings();
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([
          base44.entities.Service.filter({ active: true }),
          base44.entities.Availability.filter({}),
        ]);
        setServices(s || []);
        setAvailability(a || []);
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  const status = getPlanStatus(settings);

  const done = {
    0: !!(settings?.handle && settings?.published && (settings?.photo_url || settings?.description)),
    1: services.length > 0,
    2: availability.some((a) => a.type === "work"),
    3: (settings?.bot_preview_count || 0) > 0,
    4: status.hasPaidPlan,
  };

  const completedCount = Object.values(done).filter(Boolean).length;
  const allDone = completedCount === STEPS.length;

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-semibold">Guía de bienvenida</h1>
        <p className="text-sm text-muted-foreground">Configurá lo indispensable para que el bot y tu link de reservas funcionen</p>
      </div>

      <Card className="p-4 bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            {allDone ? "¡Todo listo! Ya podés activar tu plan y recibir reservas automáticas." : "Seguí estos pasos en orden. En menos de 10 minutos vas a tener todo configurado."}
          </p>
          <span className="text-sm font-semibold whitespace-nowrap">{completedCount}/{STEPS.length}</span>
        </div>
        <div className="mt-3 h-2 rounded-full bg-primary/10 overflow-hidden">
          <div className="h-full bg-primary transition-all" style={{ width: `${(completedCount / STEPS.length) * 100}%` }} />
        </div>
      </Card>

      <div className="space-y-3">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isDone = done[i];
          return (
            <Card key={s.title} className={`p-4 ${isDone ? "opacity-80" : ""}`}>
              <div className="flex gap-3">
                <div className="shrink-0 flex flex-col items-center">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm ${isDone ? "bg-emerald-500 text-white" : "bg-primary text-primary-foreground"}`}>
                    {isDone ? <Check className="w-4 h-4" /> : i + 1}
                  </div>
                  {i < STEPS.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <Icon className="w-4 h-4 text-primary" />
                    <h3 className={`font-heading font-semibold ${isDone ? "line-through text-muted-foreground" : ""}`}>{s.title}</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{s.desc}</p>
                  <Button size="sm" variant={isDone ? "ghost" : "outline"} className="mt-3" asChild>
                    <Link to={s.to}>{isDone ? "Revisar" : s.cta} {!isDone && <ArrowRight className="w-3.5 h-3.5 ml-1" />}</Link>
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
          <p className="text-sm font-medium">¿Listo para recibir reservas?</p>
        </div>
        <p className="text-sm text-muted-foreground mt-1">Cuando completes los pasos, activá tu plan para habilitar el bot de WhatsApp y las reservas automáticas.</p>
      </Card>
    </div>
  );
}