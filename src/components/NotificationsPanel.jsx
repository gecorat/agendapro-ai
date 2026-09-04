import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_LABELS } from "@/lib/plan-utils";
import { Loader2, Mail, MessageCircle, Lock, CheckCircle2 } from "lucide-react";

// Notificaciones, disponible en TODOS los planes.
//
// Antes, lo único configurable de esto era un switch escondido dentro del asistente de la
// página pública, y solo aparecía en Básico/Trial. Acá está todo junto, y cada cosa dice
// qué puede y qué no según el plan en vez de desaparecer sin explicación.
function Row({ icon: Icon, title, description, control }) {
  return (
    <div className="flex items-start justify-between gap-3 p-3 rounded-lg border border-border">
      <div className="flex gap-2.5 min-w-0">
        {Icon && <Icon className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />}
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      <div className="shrink-0 pt-0.5">{control}</div>
    </div>
  );
}

export default function NotificationsPanel() {
  const { settings, save } = usePracticeSettings();
  const { toast } = useToast();
  const [saving, setSaving] = useState(null);

  const status = getPlanStatus(settings);
  // En Pro/Clinic el backend confirma SIEMPRE (createPublicAppointment), así que acá se
  // muestra fijo en activado en vez de ofrecer un switch que no haría nada.
  const forcedAutoConfirm = status.plan === "pro" || status.plan === "clinic";
  // null/undefined = activado: es el valor por defecto desde el 3/9/2026.
  const autoConfirm = forcedAutoConfirm || settings?.auto_confirm_public_bookings !== false;
  const remindersOn = settings?.reminders_enabled !== false;
  const whatsappReady = status.canUseWhatsApp && settings?.whatsapp_connected;

  async function update(field, value) {
    setSaving(field);
    try {
      await save({ [field]: value });
    } catch (err) {
      toast({
        title: "No se pudo guardar",
        description: err?.response?.data?.error || err.message,
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-semibold">Notificaciones</h2>
        <p className="text-sm text-muted-foreground">Qué se le avisa a tus pacientes y cómo</p>
      </div>

      <div className="space-y-3">
        <Row
          icon={CheckCircle2}
          title="Confirmar reservas automáticamente"
          description={
            forcedAutoConfirm
              ? `En el plan ${PLAN_LABELS[status.plan]} las reservas de tu página siempre quedan confirmadas al instante.`
              : autoConfirm
                ? "Las reservas de tu página quedan confirmadas al instante y el paciente recibe el aviso solo."
                : "Las reservas quedan pendientes hasta que las aprobés desde la campanita o la Agenda. Ojo: el paciente no tiene forma de saber que falta tu aprobación."
          }
          control={
            forcedAutoConfirm ? (
              <span className="text-xs text-muted-foreground flex items-center gap-1"><Lock className="w-3 h-3" /> Siempre</span>
            ) : (
              <Switch
                checked={autoConfirm}
                disabled={saving === "auto_confirm_public_bookings"}
                onCheckedChange={(v) => update("auto_confirm_public_bookings", v)}
              />
            )
          }
        />

        <Row
          icon={Mail}
          title="Recordatorios automáticos"
          description={
            remindersOn
              ? "Le avisamos al paciente 24 horas y 3 horas antes del turno. Solo para turnos reservados con anticipación."
              : "Apagados: no se envía ningún recordatorio previo al turno."
          }
          control={
            <Switch
              checked={remindersOn}
              disabled={saving === "reminders_enabled"}
              onCheckedChange={(v) => update("reminders_enabled", v)}
            />
          }
        />

        <Row
          icon={Mail}
          title="Avisos por email"
          description="Confirmación, recordatorios y avisos de cambio o cancelación. Siempre activos, en todos los planes."
          control={<span className="text-xs text-emerald-600 font-medium">Activo</span>}
        />

        <Row
          icon={MessageCircle}
          title="Avisos por WhatsApp"
          description={
            !status.canUseWhatsApp
              ? `Disponible desde el plan ${PLAN_LABELS.pro}. Con tu plan actual los avisos salen por email.`
              : whatsappReady
                ? "Conectado. Los pacientes que eligen WhatsApp reciben los avisos por ahí."
                : "Tu plan lo incluye, pero todavía no conectaste tu número."
          }
          control={
            !status.canUseWhatsApp ? (
              <Button size="sm" variant="outline" asChild>
                <Link to="/upgrade-plan">Ver planes</Link>
              </Button>
            ) : whatsappReady ? (
              <span className="text-xs text-emerald-600 font-medium">Conectado</span>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <Link to="/configuracion?tab=integrations">Conectar</Link>
              </Button>
            )
          }
        />
      </div>

      {saving && (
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Guardando…
        </p>
      )}

      <div className="bg-muted/50 rounded-2xl p-4">
        <p className="text-sm text-muted-foreground">
          El texto de cada aviso se edita en la pestaña <strong>Plantillas</strong>.
        </p>
      </div>
    </div>
  );
}
