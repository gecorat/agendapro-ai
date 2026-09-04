import React, { useEffect, useRef, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { MessageCircle, Send, Loader2, Lock, Sparkles, RefreshCw, CalendarCheck2, Info } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";

const DEMO_TTL_MS = 5 * 60 * 1000;

function formatTime() {
  return new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
}

export default function BotPreview() {
  const { settings, save } = usePracticeSettings();
  const status = getPlanStatus(settings);
  const [limit, setLimit] = useState(20);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingCtx, setLoadingCtx] = useState(true);
  const scrollRef = useRef(null);
  const cleanupTimers = useRef([]);

  const count = settings?.bot_preview_count || 0;
  const reachedLimit = count >= limit;
  const botName = settings?.bot_assistant_name || settings?.practice_name || "Asistente";

  useEffect(() => {
    (async () => {
      try {
        const botCfg = await base44.entities.BotConfig.filter({});
        setLimit(botCfg?.[0]?.bot_preview_limit || 20);
      } finally {
        setLoadingCtx(false);
      }
    })();
  }, []);

  useEffect(() => {
    // Por si quedan timers de limpieza pendientes al salir de la pantalla, no hacemos nada
    // especial (el backend igual limpia lo vencido en el próximo mensaje que se mande) —
    // esto es solo para no dejar timers corriendo sobre un componente ya desmontado.
    return () => { cleanupTimers.current.forEach(clearTimeout); };
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, sending]);

  const scheduleDemoCleanup = useCallback((appointmentId) => {
    const id = setTimeout(() => {
      base44.functions.invoke("deleteDemoAppointment", { appointment_id: appointmentId }).catch(() => {});
    }, DEMO_TTL_MS);
    cleanupTimers.current.push(id);
  }, []);

  const handleSend = async (e) => {
    e?.preventDefault();
    const text = input.trim();
    if (!text || sending || reachedLimit) return;
    if (status.trialExpired) return;

    const history = [...messages, { role: "user", content: text, time: formatTime() }];
    setMessages(history);
    setInput("");
    setSending(true);

    try {
      const res = await base44.functions.invoke("botPreviewMessage", {
        message: text,
        history: messages.map((m) => ({ role: m.role, content: m.content })),
      });
      const reply = res?.data?.reply || "Disculpá, no entendí. ¿Podés repetirlo?";
      const booked = !!res?.data?.booked;
      const appointment = res?.data?.appointment;
      // Segundo mensaje con la confirmación, igual que hace el bot real por WhatsApp.
      const secondaryReply = res?.data?.secondaryReply;

      setMessages([
        ...history,
        { role: "assistant", content: reply, time: formatTime() },
        ...(secondaryReply ? [{ role: "assistant", content: secondaryReply, time: formatTime() }] : []),
        ...(booked && appointment ? [{ role: "system", appointment, time: formatTime() }] : []),
      ]);
      if (booked && appointment?.id) scheduleDemoCleanup(appointment.id);

      const newCount = count + 1;
      await save({ bot_preview_count: newCount });
    } catch {
      setMessages([...history, { role: "assistant", content: "Hubo un error de conexión. Probá de nuevo.", time: formatTime() }]);
    } finally {
      setSending(false);
    }
  };

  const handleReset = () => setMessages([]);

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
      <div className="flex items-center justify-between mb-2">
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-heading font-semibold flex items-center gap-2">
            <MessageCircle className="w-5 h-5" /> Probar el bot
          </h1>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">
            {remaining}/{limit}
          </span>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" onClick={handleReset} title="Reiniciar conversación">
              <RefreshCw className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-primary/5 border border-primary/15 px-3 py-2.5 mb-3">
        <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          Responde con tu configuración real (servicios, horarios y personalidad del bot que cargaste en Configuración). Si en la charla llegás a confirmar un turno, se crea de verdad en tu <span className="font-medium text-foreground">Agenda</span> y se borra solo a los 5 minutos — así ves exactamente cómo se vería, sin ensuciar tus datos. Con el plan {PLAN_LABELS.pro}, el bot haría esto mismo automáticamente por WhatsApp con tus pacientes reales.
        </p>
      </div>

      <Card className="flex-1 flex flex-col overflow-hidden min-h-[50vh] p-0">
        {/* WhatsApp-style header */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#075e54] text-white shrink-0">
          <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
            <MessageCircle className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm truncate">{botName}</p>
            <p className="text-xs text-white/70">{sending ? "escribiendo…" : "en línea"}</p>
          </div>
        </div>

        {/* Chat body */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 bg-[#efeae2]">
          {messages.length === 0 && (
            <div className="text-center text-sm text-slate-500 py-8 px-4">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              Escribí como si fueras tu paciente. Ej: <em>"Hola, quería sacar un turno para limpieza"</em>
            </div>
          )}
          {messages.map((m, i) => {
            if (m.role === "system") {
              return (
                <div key={i} className="flex justify-center py-1">
                  <div className="flex items-center gap-1.5 bg-emerald-100 text-emerald-800 text-xs font-medium rounded-full px-3 py-1.5 shadow-sm">
                    <CalendarCheck2 className="w-3.5 h-3.5" />
                    Turno de prueba creado en tu Agenda — se borra solo en 5 min
                    <Link to="/agenda" className="underline ml-1">Ver</Link>
                  </div>
                </div>
              );
            }
            return (
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
            );
          })}
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
          <div className="border-t border-border p-4 text-center bg-accent/30 shrink-0">
            <Sparkles className="w-5 h-5 mx-auto text-amber-500" />
            <p className="font-medium text-sm mt-1">Alcanzaste el límite de la demo</p>
            <p className="text-xs text-muted-foreground mt-0.5">Usaste {count} de {limit} mensajes. Con el plan Pro el bot responde a tus pacientes sin límites.</p>
            <Button size="sm" className="mt-3" asChild><Link to="/configuracion">Pasar a Pro ({PLAN_PRICES.pro} ARS)</Link></Button>
          </div>
        ) : (
          <form onSubmit={handleSend} className="border-t border-border p-3 flex gap-2 bg-card shrink-0">
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
    </div>
  );
}
