import React, { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar, Mail, CheckCircle2, Check, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import PracticeProfileSection from "@/components/PracticeProfileSection";
import AvailabilityEditor from "@/components/AvailabilityEditor";
import WhatsAppConnectCard from "@/components/WhatsAppConnectCard";
import WhatsAppUsageCard from "@/components/WhatsAppUsageCard";
import ServiceManagerPanel from "@/components/ServiceManagerPanel";
import ProfessionalsPanel from "@/components/ProfessionalsPanel";
import PlanGate from "@/components/PlanGate";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";

export default function Settings() {
  return (
    <div className="px-3 py-3 md:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">Gestioná tu consultorio</p>
      </div>

      <Tabs defaultValue="services">
        <TabsList className="grid grid-cols-6 w-full bg-muted/60 rounded-xl p-1 h-auto">
          <TabsTrigger value="profile" className="rounded-lg text-xs sm:text-sm py-1.5">Perfil</TabsTrigger>
          <TabsTrigger value="services" className="rounded-lg text-xs sm:text-sm py-1.5">Servicios</TabsTrigger>
          <TabsTrigger value="team" className="rounded-lg text-xs sm:text-sm py-1.5">Equipo</TabsTrigger>
          <TabsTrigger value="hours" className="rounded-lg text-xs sm:text-sm py-1.5">Horarios</TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-lg text-xs sm:text-sm py-1.5">Integraciones</TabsTrigger>
          <TabsTrigger value="plan" className="rounded-lg text-xs sm:text-sm py-1.5">Plan</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="mt-4">
          <div className="bg-card rounded-2xl border border-border p-6">
            <PracticeProfileSection />
          </div>
        </TabsContent>

        <TabsContent value="services" className="mt-4">
          <ServiceManagerPanel />
        </TabsContent>

        <TabsContent value="team" className="mt-4">
          <PlanRequiredTeamTab />
        </TabsContent>

        <TabsContent value="hours" className="mt-4">
          <AvailabilityEditor />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-3 mt-4">
          <div>
            <h2 className="font-heading font-semibold">Integraciones</h2>
            <p className="text-sm text-muted-foreground">Conectá tus cuentas para automatizar</p>
          </div>

          <PublicLinkCard />

          <IntegrationCard icon={Calendar} name="Google Calendar" description="Sincronización bidireccional de citas" state="soon" />
          <WhatsAppConnectCard />
          <WhatsAppUsageCard />
          <IntegrationCard icon={Mail} name="Email" description="Recordatorios y confirmaciones automáticas a tus pacientes" state="connected" />
        </TabsContent>

        <TabsContent value="plan" className="mt-4">
          <PlanSection />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PlanSection() {
  const { settings } = usePracticeSettings();
  const status = getPlanStatus(settings);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-semibold">Tu plan</h2>
        <p className="text-sm text-muted-foreground">Gestión de suscripción</p>
      </div>
      <div className="bg-card rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Plan actual</p>
            <p className="font-heading font-semibold text-lg">{PLAN_LABELS[status.plan] || "—"}</p>
          </div>
          {status.isTrial && (
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${status.trialExpired ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}`}>
              {status.trialExpired ? "Prueba expirada" : `${status.daysLeft} días restantes`}
            </span>
          )}
        </div>
        {status.isTrial && !status.trialExpired && (
          <p className="text-xs text-muted-foreground mt-2">Estás en período de prueba. Elegí tu plan antes de que termine.</p>
        )}
        {status.trialExpired && (
          <p className="text-xs text-destructive mt-2">Tu prueba terminó. Suscribite abajo para reactivar tu cuenta.</p>
        )}
        <Button asChild size="sm" className="mt-3">
          <Link to="/upgrade-plan">Ver planes y suscribirme</Link>
        </Button>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div className={`bg-card rounded-2xl p-5 border ${status.plan === "pro" ? "border-2 border-primary" : "border-border"}`}>
          <p className="font-heading font-semibold">Pro</p>
          <p className="text-2xl font-heading font-bold mt-1">{PLAN_PRICES.pro}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>· Bot de WhatsApp con IA</li>
            <li>· Agenda y reservas online</li>
            <li>· Recordatorios automáticos</li>
            <li>· Hasta 300 conversaciones mensuales</li>
          </ul>
        </div>
        <div className={`bg-card rounded-2xl p-5 border ${status.plan === "clinic" ? "border-2 border-primary" : "border-border"}`}>
          <p className="font-heading font-semibold">Clinic</p>
          <p className="text-2xl font-heading font-bold mt-1">{PLAN_PRICES.clinic}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>· Todo lo de Pro</li>
            <li>· Hasta 3 profesionales con agendas propias</li>
            <li>· WhatsApp centralizado que reparte turnos</li>
            <li>· Hasta 1.000 conversaciones mensuales</li>
          </ul>
        </div>
      </div>
      <div className="bg-muted/50 rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">Para activar o cambiar tu plan, contactanos. La recurrencia automática con Mercado Pago se habilita próximamente.</p>
      </div>
    </div>
  );
}

function PublicLinkCard() {
  const { settings } = usePracticeSettings();
  const [copied, setCopied] = useState(false);
  const handle = (settings?.handle || "").replace(/^@/, "");
  const url = (typeof window !== "undefined" ? window.location.origin : "") + (handle ? `/u/${handle}` : "");

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <p className="font-medium mb-1">Enlace público de reservas</p>
      <p className="text-sm text-muted-foreground mb-3">
        Compartí este link con tus pacientes. Reservan solos, sin escribirte.
      </p>
      {handle ? (
        <div className="flex gap-2">
          <Input value={url} readOnly className="font-mono text-xs rounded-xl" />
          <Button variant="outline" size="sm" onClick={copy} className="shrink-0 rounded-xl">
            {copied ? <Check className="w-4 h-4" /> : "Copiar"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Elegí tu @usuario en la pestaña <strong>Perfil</strong> para activar tu enlace.</p>
      )}
    </div>
  );
}

// state: "connected" | "soon" (todavía no integrado — mostramos esto en vez de un botón
// "Conectar" que no hacía nada al hacer clic)
function IntegrationCard({ icon: Icon, name, description, state }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground truncate">{description}</p>
        </div>
      </div>
      {state === "connected" ? (
        <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium shrink-0">
          <CheckCircle2 className="w-4 h-4" />
          Conectado
        </span>
      ) : (
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full shrink-0">
          <Clock3 className="w-3.5 h-3.5" />
          Próximamente
        </span>
      )}
    </div>
  );
}
