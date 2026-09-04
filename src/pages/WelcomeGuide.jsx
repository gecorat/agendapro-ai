import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import { UserCircle, ClipboardList, CalendarClock, MessageCircle, CreditCard, Check, ArrowRight, Globe } from "lucide-react";

// OJO con el primer paso: antes decía "Configurá tu perfil", llevaba a /profile-editor
// (que edita los datos del consultorio) y sin embargo se daba por cumplido con handle +
// publicada + foto/descripción, que se cargan en OTRA pantalla (la página pública). O sea
// que el profesional completaba todo lo que esa pantalla le pedía y el paso seguía
// pendiente, sin ninguna pista de qué faltaba. Ahora son dos pasos distintos, cada uno
// apuntando a donde se hace de verdad, y cada uno se marca con lo que esa pantalla guarda.
const STEPS = [
  {
    icon: UserCircle,
    title: "Completá los datos de tu consultorio",
    desc: "Tu nombre, teléfono y dirección. Es lo que aparece en las confirmaciones y recordatorios que reciben tus pacientes.",
    cta: "Ir a Configuración",
    to: "/configuracion?tab=profile",
  },
  {
    icon: ClipboardList,
    title: "Cargá tus servicios",
    desc: "Creá los tipos de consulta que ofrecés, con duración, precio y notas de preparación.",
    cta: "Gestionar servicios",
    to: "/configuracion?tab=services",
  },
  {
    icon: CalendarClock,
    title: "Definí tus horarios",
    desc: "Configurá tu disponibilidad semanal, pausas y feriados.",
    cta: "Configurar horarios",
    to: "/configuracion?tab=hours",
  },
  {
    icon: Globe,
    title: "Prepará tu página de reservas",
    desc: "Elegí tu @usuario, subí tu foto y escribí una descripción. Ese es el link que compartís con tus pacientes.",
    cta: "Editar mi página",
    to: "/public-page-editor",
  },
  {
    icon: MessageCircle,
    title: "Probá el bot",
    desc: "Simulá conversaciones reales con el asistente usando tus propios servicios y agenda.",
    cta: "Probar el bot",
    to: "/bot",
  },
  {
    icon: CreditCard,
    title: "Activá tu plan",
    desc: "Cuando estés listo, pasá al plan Pro para habilitar WhatsApp y las funciones automáticas.",
    cta: "Ver planes",
    to: "/upgrade-plan",
  },
];

export default function WelcomeGuide() {
  const { settings, loading } = usePracticeSettings();
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    (async () => {
      // Por las funciones con alcance, NO leyendo las entidades directo: los servicios y
      // horarios que crea el onboarding quedan con el id del servidor en created_by_id
      // (ver base44/shared/ownership.ts), así que una consulta directa desde el cliente no
      // devolvía ninguno y los pasos "Cargá tus servicios" y "Definí tus horarios" nunca se
      // marcaban como completos, por más que estuvieran cargados.
      try {
        const [s, a] = await Promise.all([
          base44.functions.invoke("getScopedServices", {}).catch(() => null),
          base44.functions.invoke("getScopedAvailability", {}).catch(() => null),
        ]);
        setServices(s?.data?.services || []);
        setAvailability(a?.data?.availability || []);
      } finally {
        setLoadingData(false);
      }
    })();
  }, []);

  const status = getPlanStatus(settings);

  // Cada paso se da por cumplido con lo que guarda SU pantalla, ni más ni menos.
  const done = {
    0: !!(settings?.practice_name && (settings?.phone || settings?.address)),
    1: services.filter((s) => s.active !== false).length > 0,
    2: availability.some((a) => a.type === "work"),
    3: !!(settings?.handle && settings?.published),
    4: (settings?.bot_preview_count || 0) > 0,
    5: status.hasPaidPlan,
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
        <Button size="sm" className="mt-3" asChild>
          <Link to="/upgrade-plan">Ver planes <ArrowRight className="w-3.5 h-3.5 ml-1" /></Link>
        </Button>
      </Card>
    </div>
  );
}