import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { Loader2, Bot, RotateCcw, Save, Target, Sparkles, Timer, MessageSquareText, UserCircle2, Power, IdCard, Users } from "lucide-react";
import { getBotPauseStatus } from "@/lib/bot-status";
import BotPauseButton from "@/components/BotPauseButton";
import BotPauseBanner from "@/components/BotPauseBanner";

// Ejemplo estático de cómo queda el mensaje de confirmación real que arma el bot (no es
// editable acá — el formato en sí es fijo, a propósito, para que el paciente SIEMPRE lea
// datos reales de la cita y no algo que la IA redactó libremente). Lo que SÍ se puede
// ajustar es el tono general de conversación, más abajo.
const EXAMPLE_CONFIRMATION = `✅ *Turno confirmado*
📅 *Día y horario:* martes 26 de agosto, 10:00
🩺 *Servicio:* Consulta general
👤 *Profesional:* Gonzalo Corat
📍 *Dirección:* Av. Siempre Viva 742, Córdoba
🗺️ https://maps.google.com/?q=...

¡Te esperamos! 😊 Si necesitás reagendar o cancelar, avisanos por este mismo medio.
⏰ Te vamos a recordar la cita unas horas antes.`;

export default function BotSettingsPanel() {
  const { toast } = useToast();
  const { settings, save, hasFullAccess } = usePracticeSettings();
  const [defaults, setDefaults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("");
  const [assistantName, setAssistantName] = useState("");
  const [personaMode, setPersonaMode] = useState("assistant");
  const [requiredFields, setRequiredFields] = useState(["last_name"]);
  const [delaySeconds, setDelaySeconds] = useState(15);
  const [initialized, setInitialized] = useState(false);
  const botPauseStatus = getBotPauseStatus(settings);

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("getBotDefaults", {});
        setDefaults(res?.data || null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Se completa recién cuando llegan AMBOS: la configuración actual del consultorio Y
  // los valores predeterminados. Si el profesional todavía no personalizó nada, el campo
  // arranca YA CARGADO con el texto predeterminado (editable ahí mismo) — no vacío — así
  // se ve de entrada qué es lo que el bot está usando hoy en la conversación real.
  useEffect(() => {
    if (!settings || !defaults || initialized) return;
    setObjective(settings.bot_objective_prompt || defaults.objectivePrompt || "");
    setTone(settings.bot_tone_prompt || defaults.tonePrompt || "");
    setAssistantName(settings.bot_assistant_name || "");
    setPersonaMode(settings.bot_persona_mode === "professional" ? "professional" : "assistant");
    setRequiredFields(Array.isArray(settings.bot_required_patient_fields) ? settings.bot_required_patient_fields : ["last_name"]);
    setDelaySeconds(settings.bot_response_delay_seconds || defaults.responseDelaySeconds || 15);
    setInitialized(true);
  }, [settings, defaults, initialized]);

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        bot_objective_prompt: objective.trim(),
        bot_tone_prompt: tone.trim(),
        bot_assistant_name: assistantName.trim(),
        bot_persona_mode: personaMode,
        bot_required_patient_fields: requiredFields,
        bot_response_delay_seconds: delaySeconds,
      });
      toast({ title: "Configuración del bot guardada", description: "Los próximos mensajes por WhatsApp ya usan estos cambios." });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Interruptor GENERAL: distinto de desconectar WhatsApp — el número sigue conectado,
  // pero el bot deja de contestar automáticamente a cualquier paciente hasta reactivarlo
  // (a mano, o solo hasta que venza la duración elegida). Los mensajes que lleguen mientras
  // tanto se siguen guardando en la bandeja de Chats. El control con las duraciones
  // (BotPauseButton) usa `save` directamente.

  if (loading || !settings || !initialized) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!hasFullAccess) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Solo el dueño de la cuenta (o un co-admin) puede configurar el bot.
      </div>
    );
  }

  const objectiveIsDefault = objective === (defaults?.objectivePrompt || "");
  const toneIsDefault = tone === (defaults?.tonePrompt || "");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-heading font-semibold">Configuración del bot de WhatsApp</h2>
          <p className="text-sm text-muted-foreground">Ajustá cómo agenda y cómo habla la asistente virtual. Arranca con el predeterminado ya cargado — editalo o restauralo cuando quieras.</p>
        </div>
      </div>

      {/* Interruptor general del bot */}
      <div className={`rounded-2xl border p-4 space-y-3 ${botPauseStatus.paused ? "bg-amber-500/5 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${botPauseStatus.paused ? "bg-amber-500/10" : "bg-emerald-100"}`}>
              <Power className={`w-4 h-4 ${botPauseStatus.paused ? "text-amber-600" : "text-emerald-600"}`} />
            </div>
            <div className="min-w-0">
              <p className="font-medium text-sm">{botPauseStatus.paused ? "Bot pausado" : "Bot activo"}</p>
              <p className="text-xs text-muted-foreground">{botPauseStatus.paused ? "No le está respondiendo a nadie." : "Está respondiendo automáticamente por WhatsApp."}</p>
            </div>
          </div>
          <BotPauseButton settings={settings} save={save} />
        </div>
        <BotPauseBanner settings={settings} className="!bg-transparent !p-0" />
      </div>

      {/* Nombre del asistente */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <UserCircle2 className="w-4 h-4 text-primary" />
          <Label className="font-medium">Nombre del asistente</Label>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Opcional. Si lo cargás, el bot se presenta con ese nombre al saludar o si el paciente le pregunta cómo se llama.</p>
        <Input
          value={assistantName}
          onChange={(e) => setAssistantName(e.target.value)}
          placeholder="Ej: Sofía"
          className="max-w-xs"
        />
      </div>

      {/* Objetivo */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-primary" />
            <Label className="font-medium">Objetivo (qué tiene que lograr)</Label>
          </div>
          <Button
            type="button" variant="ghost" size="sm"
            className="text-xs text-muted-foreground gap-1 h-7"
            onClick={() => setObjective(defaults?.objectivePrompt || "")}
            disabled={objectiveIsDefault}
          >
            <RotateCcw className="w-3 h-3" /> Restaurar predeterminado
          </Button>
        </div>
        <Textarea
          rows={10}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          className="text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {objectiveIsDefault ? "Estás usando el texto predeterminado tal cual." : "Personalizado — distinto del predeterminado de la plataforma."}
        </p>
      </div>

      {/* Tono */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <Label className="font-medium">Tono y personalidad (cómo tiene que hablar)</Label>
          </div>
          <Button
            type="button" variant="ghost" size="sm"
            className="text-xs text-muted-foreground gap-1 h-7"
            onClick={() => setTone(defaults?.tonePrompt || "")}
            disabled={toneIsDefault}
          >
            <RotateCcw className="w-3 h-3" /> Restaurar predeterminado
          </Button>
        </div>
        <Textarea
          rows={7}
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {toneIsDefault ? "Estás usando el texto predeterminado tal cual." : "Personalizado — distinto del predeterminado de la plataforma."}
        </p>
      </div>

      {/* Demora de respuesta */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-primary" />
          <Label className="font-medium">Demora antes de responder</Label>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Para que la conversación no se sienta instantánea. La cita ya queda guardada al instante en tu Agenda; esto solo demora el mensaje que recibe el paciente.</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {(defaults?.responseDelayOptions || [
            { value: 5, label: "5 segundos" },
            { value: 15, label: "15 segundos (recomendado)" },
            { value: 30, label: "30 segundos" },
            { value: 60, label: "1 minuto" },
          ]).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setDelaySeconds(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                delaySeconds === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ejemplo del mensaje de confirmación */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <MessageSquareText className="w-4 h-4 text-primary" />
          <Label className="font-medium">Así queda el mensaje de confirmación</Label>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">
          Este formato es fijo (no editable) para que el paciente siempre reciba los datos reales de la cita, nunca un texto libre de la IA. Ejemplo:
        </p>
        <div className="rounded-xl bg-[#e7fce3] border border-emerald-100 p-3">
          <pre className="text-[13px] whitespace-pre-wrap font-sans text-emerald-950 leading-relaxed">{EXAMPLE_CONFIRMATION}</pre>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="shadow-sm">
        {saving ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Save className="w-4 h-4 mr-1.5" />}
        Guardar configuración del bot
      </Button>
    </div>
  );
}
