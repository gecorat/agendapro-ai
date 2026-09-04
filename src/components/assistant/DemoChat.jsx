import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MessageCircle, Send, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { PLAN_PRICES } from "@/lib/plan-utils";
import { getTypeLabel } from "@/lib/professional-presets";
import { formatArTime } from "@/lib/timezone";

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

function formatTime() {
  return formatArTime(new Date());
}

export default function DemoChat({ settings }) {
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
  const botName = settings?.practice_name || "Asistente";

  const loadContext = useCallback(async () => {
    try {
      // Servicios y horarios por las funciones con alcance: los que crea el onboarding
      // llevan el id del servidor en created_by_id (ver base44/shared/ownership.ts), así
      // que una consulta directa desde el cliente devolvía vacío y el simulador del bot
      // arrancaba sin ningún servicio ni horario que ofrecer.
      const [servs, avail, botCfg] = await Promise.all([
        base44.functions.invoke("getScopedServices", {}).catch(() => null),
        base44.functions.invoke("getScopedAvailability", {}).catch(() => null),
        base44.entities.BotConfig.filter({}),
      ]);
      setServices((servs?.data?.services || []).filter((s) => s.active !== false));
      setAvailability(avail?.data?.availability || []);
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

    const history = [...messages, { role: "user", content: text, time: formatTime() }];
    setMessages(history);
    setInput("");
    setSending(true);

    try {
      const context = buildContext(settings, services, availability);
      const prompt = buildPrompt(masterPrompt, context, messages, text);
      const res = await base44.integrations.Core.InvokeLLM({ prompt });
      const reply = typeof res === "string" ? res : res?.output || "Disculpá, no entendí. ¿Podés repetirlo?";
      setMessages([...history, { role: "assistant", content: reply, time: formatTime() }]);
    } catch (err) {
      setMessages([...history, { role: "assistant", content: "Hubo un error de conexión. Probá de nuevo.", time: formatTime() }]);
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

  const remaining = Math.max(0, limit - count);

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs text-muted-foreground">Probá cómo respondería el bot a tus pacientes</p>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{remaining}/{limit}</span>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setMessages([])} title="Reiniciar">
              <RefreshCw className="w-3.5 h-3.5" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden min-h-[40vh] rounded-xl border border-border bg-card">
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#075e54] text-white shrink-0 rounded-t-xl">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{botName}</p>
            <p className="text-xs text-white/70">{sending ? "escribiendo…" : "en línea"}</p>
          </div>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2 bg-[#efeae2]">
          {messages.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-8 px-4">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Escribí como si fueras tu paciente. Ej: <em>"Hola, quería sacar un turno"</em>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} gap-1.5`}>
              {m.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-[#075e54] flex items-center justify-center shrink-0 self-end mb-1">
                  <MessageCircle className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-[75%] rounded-lg px-2.5 py-1.5 text-sm whitespace-pre-wrap shadow-sm ${
                m.role === "user"
                  ? "bg-[#dcf8c6] text-foreground rounded-br-none"
                  : "bg-white text-foreground border border-slate-100 rounded-bl-none"
              }`}>
                {m.content}
                <span className="text-[10px] text-slate-400 ml-2 align-bottom">{m.time}</span>
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start gap-1.5">
              <div className="w-8 h-8 rounded-full bg-[#075e54] flex items-center justify-center shrink-0 self-end mb-1">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <div className="bg-white border border-slate-100 rounded-lg rounded-bl-none px-4 py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              </div>
            </div>
          )}
        </div>

        {reachedLimit ? (
          <div className="border-t border-border p-3 text-center bg-accent/30 shrink-0">
            <Sparkles className="w-5 h-5 mx-auto text-amber-500" />
            <p className="font-medium text-sm mt-1">Alcanzaste el límite de la demo</p>
            <p className="text-xs text-muted-foreground mt-0.5">Con el plan Pro el bot responde a tus pacientes sin límites.</p>
            <Button size="sm" className="mt-2" asChild><Link to="/upgrade-plan">Pasar a Pro ({PLAN_PRICES.pro})</Link></Button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="border-t border-border p-3 flex gap-2 bg-card shrink-0 rounded-b-xl">
            <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Escribí como tu paciente…" disabled={sending} />
            <Button type="submit" size="icon" disabled={sending || !input.trim()}>
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}