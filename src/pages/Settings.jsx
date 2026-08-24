import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, Clock3 } from "lucide-react";
import { Link } from "react-router-dom";
import PublicLinkCard from "@/components/PublicLinkCard";
import PracticeProfileSection from "@/components/PracticeProfileSection";
import AvailabilityEditor from "@/components/AvailabilityEditor";
import WhatsAppConnectCard from "@/components/WhatsAppConnectCard";
import GoogleCalendarConnectCard from "@/components/GoogleCalendarConnectCard";
import WhatsAppUsageCard from "@/components/WhatsAppUsageCard";
import ServiceManagerPanel from "@/components/ServiceManagerPanel";
import ProfessionalsPanel from "@/components/ProfessionalsPanel";
import MessageTemplatesPanel from "@/components/MessageTemplatesPanel";
import PlanGate from "@/components/PlanGate";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";

export default function Settings() {
  const { canManageBilling } = usePracticeSettings();

  return (
    <div className="px-3 py-3 md:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground text-sm">Gestioná tu consultorio</p>
      </div>

      <Tabs defaultValue="services">
        <TabsList className={`grid w-full bg-muted/60 rounded-xl p-1 h-auto ${canManageBilling ? "grid-cols-7" : "grid-cols-6"}`}>
          <TabsTrigger value="profile" className="rounded-lg text-xs sm:text-sm py-1.5">Perfil</TabsTrigger>
          <TabsTrigger value="services" className="rounded-lg text-xs sm:text-sm py-1.5">Servicios</TabsTrigger>
          <TabsTrigger value="team" className="rounded-lg text-xs sm:text-sm py-1.5">Equipo</TabsTrigger>
          <TabsTrigger value="hours" className="rounded-lg text-xs sm:text-sm py-1.5">Horarios</TabsTrigger>
          <TabsTrigger value="templates" className="rounded-lg text-xs sm:text-sm py-1.5">Plantillas</TabsTrigger>
          <TabsTrigger value="integrations" className="rounded-lg text-xs sm:text-sm py-1.5">Integraciones</TabsTrigger>
          {/* La pestaña Plan es exclusiva del dueño real de la cuenta — un co-admin ve y
              gestiona todo lo demás, pero nunca facturación. */}
          {canManageBilling && <TabsTrigger value="plan" className="rounded-lg text-xs sm:text-sm py-1.5">Plan</TabsTrigger>}
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

        <TabsContent value="templates" className="mt-4">
          <MessageTemplatesPanel />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-3 mt-4">
          <div>
            <h2 className="font-heading font-semibold">Integraciones</h2>
            <p className="text-sm text-muted-foreground">Conectá tus cuentas para automatizar</p>
          </div>

          <PublicLinkSection />

          {/* Oculto temporalmente hasta terminar la verificación de scope sensible en Google
              Cloud Console (ver conversación con soporte). El backend sigue activo: quien ya
              lo había conectado sigue sincronizando normalmente, solo se esconde la entrada
              para nuevos usuarios mientras la app está en modo Testing. */}
          {/* <GoogleCalendarConnectCard /> */}
          <WhatsAppConnectCard />
          <WhatsAppUsageCard />
          <IntegrationCard icon={Mail} name="Email" description="Recordatorios y confirmaciones automáticas a tus pacientes" state="connected" />
        </TabsContent>

        {canManageBilling && (
          <TabsContent value="plan" className="mt-4">
            <PlanSection />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function PlanRequiredTeamTab() {
  const { settings } = usePracticeSettings();
  const status = getPlanStatus(settings);
  if (!status.canUseMultiProfessional) {
    return (
      <PlanGate
        feature="Equipo multi-profesional"
        requiredPlan="clinic"
        description={`Sumá hasta 3 profesionales con agendas independientes bajo un mismo WhatsApp. Disponible desde el plan ${PLAN_LABELS.clinic}.`}
      />
    );
  }
  return <ProfessionalsPanel />;
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
          <p className="font-heading font-semibold">{PLAN_LABELS.clinic}</p>
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
        <p className="text-sm text-muted-foreground">Suscripción con cobro automático mensual por Mercado Pago. Para cambiar de plan, andá a "Ver planes y suscribirme" arriba.</p>
      </div>
    </div>
  );
}

function PublicLinkSection() {
  const { settings } = usePracticeSettings();
  const handle = (settings?.handle || "").replace(/^@/, "");
  const url = (typeof window !== "undefined" ? window.location.origin : "") + (handle ? `/u/${handle}` : "");
  if (!handle) {
    return (
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="font-medium mb-1">Tu página de reservas</p>
        <p className="text-sm text-muted-foreground">Elegí tu @usuario en la pestaña <strong>Perfil</strong> para activar tu enlace.</p>
      </div>
    );
  }
  return <PublicLinkCard url={url} practiceName={settings?.practice_name} brand={settings?.page_color} />;
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
