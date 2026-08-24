import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { Loader2, Bot, RotateCcw, Save, Target, Sparkles, Timer, MessageSquareText } from "lucide-react";

// Ejemplo est\u00e1tico de c\u00f3mo queda el mensaje de confirmaci\u00f3n real que arma el bot (no es
// editable ac\u00e1 -- el formato en s\u00ed es fijo, a prop\u00f3sito, para que el paciente SIEMPRE lea
// datos reales de la cita y no algo que la IA redact\u00f3 libremente). Lo que S\u00cd se puede
// ajustar es el tono general de conversaci\u00f3n, m\u00e1s abajo.
const EXAMPLE_CONFIRMATION = `\u2705 *Turno confirmado*
\ud83d\udcc5 *D\u00eda y horario:* martes 26 de agosto, 10:00
\ud83e\ude7a *Servicio:* Consulta general
\ud83d\udc64 *Profesional:* Gonzalo Corat
\ud83d\udccd *Direcci\u00f3n:* Av. Siempre Viva 742, C\u00f3rdoba
\ud83d\uddfa\ufe0f https://maps.google.com/?q=...

\u00a1Te esperamos! \ud83d\ude0a Si necesit\u00e1s reagendar o cancelar, avisanos por este mismo medio.
\u23f0 Te vamos a recordar la cita unas horas antes.`;

export default function BotSettingsPanel() {
  const { toast } = useToast();
  const { settings, save, hasFullAccess } = usePracticeSettings();
  const [defaults, setDefaults] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [objective, setObjective] = useState("");
  const [tone, setTone] = useState("");
  const [delaySeconds, setDelaySeconds] = useState(15);

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

  // Se completa reci\u00e9n cuando llegan AMBOS: la configuraci\u00f3n actual del consultorio Y
  // los valores predeterminados (para poder mostrar el default como placeholder cuando el
  // profesional todav\u00eda no personaliz\u00f3 nada).
  useEffect(() => {
    if (!settings || !defaults) return;
    setObjective(settings.bot_objective_prompt || "");
    setTone(settings.bot_tone_prompt || "");
    setDelaySeconds(settings.bot_response_delay_seconds || defaults.responseDelaySeconds || 15);
  }, [settings, defaults]);

  const isCustomObjective = objective.trim().length > 0;
  const isCustomTone = tone.trim().length > 0;

  async function handleSave() {
    setSaving(true);
    try {
      await save({
        bot_objective_prompt: objective.trim(),
        bot_tone_prompt: tone.trim(),
        bot_response_delay_seconds: delaySeconds,
      });
      toast({ title: "Configuraci\u00f3n del bot guardada", description: "Los pr\u00f3ximos mensajes por WhatsApp ya usan estos cambios." });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!hasFullAccess) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        Solo el due\u00f1o de la cuenta (o un co-admin) puede configurar el bot.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="font-heading font-semibold">Configuraci\u00f3n del bot de WhatsApp</h2>
          <p className="text-sm text-muted-foreground">Ajust\u00e1 c\u00f3mo agenda y c\u00f3mo habla la asistente virtual. Los valores vac\u00edos usan el predeterminado de la plataforma.</p>
        </div>
      </div>

      {/* Objetivo */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-primary" />
            <Label className="font-medium">Objetivo (qu\u00e9 tiene que lograr)</Label>
          </div>
          <Button
            type="button" variant="ghost" size="sm"
            className="text-xs text-muted-foreground gap-1 h-7"
            onClick={() => setObjective(defaults?.objectivePrompt || "")}
            disabled={!isCustomObjective && objective === (defaults?.objectivePrompt || "")}
          >
            <RotateCcw className="w-3 h-3" /> Restaurar predeterminado
          </Button>
        </div>
        <Textarea
          rows={10}
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder={defaults?.objectivePrompt}
          className="text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {isCustomObjective ? "Est\u00e1s usando tu propia versi\u00f3n." : "Vac\u00edo: se est\u00e1 usando el predeterminado de la plataforma (lo ves arriba, en gris)."}
        </p>
      </div>

      {/* Tono */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary" />
            <Label className="font-medium">Tono y personalidad (c\u00f3mo tiene que hablar)</Label>
          </div>
          <Button
            type="button" variant="ghost" size="sm"
            className="text-xs text-muted-foreground gap-1 h-7"
            onClick={() => setTone(defaults?.tonePrompt || "")}
            disabled={!isCustomTone && tone === (defaults?.tonePrompt || "")}
          >
            <RotateCcw className="w-3 h-3" /> Restaurar predeterminado
          </Button>
        </div>
        <Textarea
          rows={7}
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          placeholder={defaults?.tonePrompt}
          className="text-sm font-mono"
        />
        <p className="text-xs text-muted-foreground">
          {isCustomTone ? "Est\u00e1s usando tu propia versi\u00f3n." : "Vac\u00edo: se est\u00e1 usando el predeterminado de la plataforma (lo ves arriba, en gris)."}
        </p>
      </div>

      {/* Demora de respuesta */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <Timer className="w-4 h-4 text-primary" />
          <Label className="font-medium">Demora antes de responder</Label>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Para que la conversaci\u00f3n no se sienta instant\u00e1nea. La cita ya queda guardada al instante en tu Agenda; esto solo demora el mensaje que recibe el paciente.</p>
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

      {/* Ejemplo del mensaje de confirmaci\u00f3n */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-2.5">
        <div className="flex items-center gap-1.5">
          <MessageSquareText className="w-4 h-4 text-primary" />
          <Label className="font-medium">As\u00ed queda el mensaje de confirmaci\u00f3n</Label>
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
        Guardar configuraci\u00f3n del bot
      </Button>
    </div>
  );
}
