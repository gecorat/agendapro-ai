import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, Send, Loader2, Lock, Sparkles } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";
import { getTypeLabel } from "@/lib/professional-presets";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function buildContext(settings, services, availability) {
  const lines = [];
  lines.push(`- Consultorio: ${settings.practice_name || "No especificado"}`);
  lines.push(`- Profesional: ${getTypeLabel(settings.professional_type)}`);
  if (settings.specialty) lines.push(`- Especialidad: ${settings.specialty}`);
  if (settings.address) lines.push(`- Dirección: ${settings.address}`);
  if (settings.phone) lines.push(`- Teléfono: ${settings.phone}`);

  if (services.length) {
    lines.push("");
    lines.push("Servicios disponibles:");
    services.forEach((s) => {
      let line = `  · ${s.name} — ${s.duration_minutes} min`;
      if (s.price) line += ` · $${s.price}`;
      if (s.description) line += ` (${s.description})`;
      lines.push(line);
    });
  } else {
    lines.push("Servicios disponibles: (aún no cargó servicios)");
  }

  const work = availability.filter((a) => a.type === "work");
  if (work.length) {
    lines.push("");
    lines.push("Horarios de atención:");
    const byDay = {};
    work.forEach((a) => {
      const d = DAYS[a.day_of_week] || `Día ${a.day_of_week}`;
      byDay[d] = byDay[d] || [];
      byDay[d].push(`${a.start_time}-${a.end_time}`);
    });
    Object.entries(byDay).forEach(([d, ranges]) => lines.push(`  · ${d}: ${ranges.join(", ")}`));
  } else {
    lines.push("Horarios de atención: lunes a viernes 09:00-18:00 (por defecto)");
  }
  return lines.join("\n");
}

function buildPrompt(masterPrompt, context, history, newMessage) {
  const convo = history.map((m) => `${m.role === "user" ? "Paciente" : "Bot"}: ${m.content}`).join("\n");
  return `${masterPrompt || "Sos la asistente virtual de un consultorio. Respondé de forma amable y breve en español."}

=== CONTEXTO DEL CONSULTORIO ===
${context}

=== REGLAS DE LA SIMULACIÓN ===
Estás en MODO DEMO dentro de la plataforma. El profesional está probando cómo responderías a sus pacientes por WhatsApp.
- Respondé en español, de forma amable y breve, como lo harías en WhatsApp.
- Podés proponer horarios y servicios según el contexto del consultorio.
- NO confirmes ni agendes realmente: decile al paciente que para confirmar debe completar la reserva o esperar la confirmación.
- No des consejos médicos ni diagnósticos.
- Mantené la conversación enfocada en agendar.

=== CONVERSACIÓN ===
${convo ? convo + "\n" : ""}Paciente: ${newMessage}
Bot:`;
}

export default function BotPreview() {
  const { settings, save, reload } = usePracticeSettings();
  const status = getPlanStatus(settings);
  const [services, setServices] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [masterPrompt, setMasterPrompt] = useState("");
  const [limit, setLimit] = useState(20);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const scrollRef = useRef(null);

  const count = settings?.bot_preview_count || 0;
  const reachedLimit = count >= limit;

  const loadContext = useCallback(async () => {
    try {
      const [servs, avail, botCfg] = await Promise.all([
        base44.entities.Service.filter({ active: true }),
        base44.entities.Availability.filter({}),
        base44.entities.BotConfig.filter({}),
      ]);
      setServices(servs || []);
      setAvailability(avail || []);
      setMasterPrompt(botCfg?.[0]?.system_prompt || "");
      setLimit(botCfg?.[0]?.bot_preview_limit || 20);
    } finally {
      setLoadingCtx(false);
    }
  }, []);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending || reachedLimit) return;
    if (status.trialExpired) return;

    const history = [...messages, { role: "user", content: text }];
    setMessages(history);
    setInput("");
    setSending(true);

    try {
      const context = buildContext(settings, services, availability);
      const prompt = buildPrompt(masterPrompt, context, messages, text);
      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      const reply = typeof res === "string" ? res : res?.output || "Disculpá, no entendí. ¿Podés repetirlo?";
      setMessages([...history, { role: "assistant", content: reply }]);

      const newCount = count + 1;
      await save({ bot_preview_count: newCount });
    } catch (err) {
      setMessages([...history, { role: "assistant", content: "Hubo un error de conexión. Probá de nuevo." }]);
    } finally {
      setSending(false);
    }
  };

  if (loadingCtx) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (status.trialExpired) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <div className="rounded-xl border border-dashed border-border bg-accent/40 p-8 text-center">
          <Lock className="w-8 h-8 mx-auto text-muted-foreground" />
          <p className="font-heading font-semibold mt-3">Tu prueba terminó</p>
          <p className="text-sm text-muted-foreground mt-1">Adquirí un plan para seguir probando el bot y usarlo con tus pacientes.</p>
          <Button className="mt-4" asChild><Link to="/configuracion">Ver planes</Link></Button>
        </div>
      </div>
    );
  }

  const remaining = Math.max(0, limit - count);

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h1 className="text-xl font-heading font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> Probar el bot
          </h1>
          <p className="text-xs text-muted-foreground">Simulá cómo respondería el bot a tus pacientes. No se guardan ni agendan citas reales.</p>
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {remaining}/{limit} mensajes
        </span>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-[50vh]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-accent/20">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Escribí como si fueras tu paciente. Ej: <em>"Hola, quería sacar un turno para limpieza"</em>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap ${
                m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-card border border-border rounded-bl-sm"
              }`}>
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-card border border-border rounded-2xl rounded-bl-sm px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}
        </div>

        {reachedLimit ? (
          <div className="border-t border-border p-4 text-center bg-accent/30">
            <Sparkles className="w-5 h-5 mx-auto text-amber-500" />
            <p className="font-medium text-sm mt-1">Alcanzaste el límite de la demo</p>
            <p className="text-xs text-muted-foreground mt-0.5">Con el plan Pro el bot responde a tus pacientes sin límites.</p>
            <Button size="sm" className="mt-3" asChild><Link to="/configuracion">Pasar a Pro ({PLAN_PRICES.pro} ARS)</Link></Button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="border-t border-border p-3 flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Escribí como tu paciente…"
              disabled={sending}
            />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        )}
      </Card>

      <p className="text-xs text-muted-foreground text-center mt-2">
        Esta es una simulación. El bot real por WhatsApp se activa con el plan {PLAN_LABELS.pro}.
      </p>
    </div>
  );
}