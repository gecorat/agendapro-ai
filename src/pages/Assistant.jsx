import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { MessageSquare, Send, Loader2, MessageCircle, ChevronLeft } from "lucide-react";
import MessageBubble from "@/components/assistant/MessageBubble";
import DemoChat from "@/components/assistant/DemoChat";
import WhatsAppConnectCard from "@/components/WhatsAppConnectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";
import { Lock, Sparkles, Crown } from "lucide-react";

function UpgradeBlock({ plan }) {
  return (
    <Card className="border-amber-200 bg-gradient-to-br from-amber-50 to-white p-4 mb-4">
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-heading font-semibold text-sm">Conectá WhatsApp con un plan superior</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tu plan {PLAN_LABELS[plan] || "actual"} permite probar el bot en la app. Para que la asistente atienda a tus pacientes por WhatsApp de forma automática, pasate a Pro o Premium.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 mt-3">
            <Button size="sm" asChild className="gap-1.5">
              <Link to="/upgrade-plan">
                <Crown className="w-3.5 h-3.5" />
                Pasar a Pro ({PLAN_PRICES.pro})
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link to="/upgrade-plan">
                <Sparkles className="w-3.5 h-3.5" />
                Ver {PLAN_LABELS.clinic} ({PLAN_PRICES.clinic})
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FullAssistant({ settings }) {
  const [user, setUser] = useState(null);
  const [allMsgs, setAllMsgs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhone, setActivePhone] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef(null);

  // Antes esto exigía específicamente zernio_account_id, así que un profesional conectado
  // por QR (WasenderAPI) apareciera como "conectado" en la tarjeta de arriba pero la
  // bandeja de chats lo trataba igual que si no hubiera conectado nada.
  const connected = !!settings?.whatsapp_connected;

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => setUser(null));
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const list = await base44.entities.Conversation.filter({ professional_id: user.id }, "-created_date", 500);
      setAllMsgs(list || []);
    } catch (e) {
      console.error("Error loading conversations", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Conversation.subscribe(() => { load(); });
    return () => { try { unsubscribe(); } catch {} };
  }, [user, load]);

  const conversations = useMemo(() => {
    const map = new Map();
    for (const m of allMsgs) {
      const key = m.phone;
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(m);
    }
    const result = [];
    for (const [phone, msgs] of map) {
      const sorted = msgs.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
      const last = sorted[sorted.length - 1];
      result.push({
        phone,
        messages: sorted,
        lastText: last?.text || "",
        lastDate: last?.created_date || "",
        conversationId: last?.conversation_id || "",
      });
    }
    result.sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
    return result;
  }, [allMsgs]);

  const activeConvo = conversations.find((c) => c.phone === activePhone) || null;
  const activeMessages = activeConvo?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, sending]);

  const handleSelect = (phone) => {
    setActivePhone(phone);
    setMobileShowChat(true);
  };

  const handleSend = async () => {
    const content = input.trim();
    if (!content || sending || !activePhone || !user) return;
    setInput("");
    setSending(true);
    const optimistic = {
      phone: activePhone,
      professional_id: user.id,
      role: "assistant",
      text: content,
      created_date: new Date().toISOString(),
      conversation_id: activeConvo?.conversationId || "",
    };
    setAllMsgs((prev) => [...prev, optimistic]);
    try {
      await base44.functions.invoke("zernioSendMessage", {
        phone: activePhone,
        message: content,
        conversationId: activeConvo?.conversationId,
      });
    } catch (e) {
      console.error("Error sending message", e);
      setAllMsgs((prev) => prev.filter((m) => m !== optimistic));
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const fmtPhone = (p) => p || "Número desconconocido";

  // Not connected yet → show connect card + helper
  if (!connected) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto h-full flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-heading font-semibold">Chats</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Conectá tu WhatsApp para que la asistente atienda a tus pacientes y las conversaciones aparezcan acá.
        </p>
        <WhatsAppConnectCard />
        <Card className="p-6 mt-4 text-center">
          <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">
            Una vez conectado, cada paciente que te escriba por WhatsApp aparecerá en esta bandeja. Vas a poder responder a mano o dejar que la IA siga atendiendo sola.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)] border-t border-border">
      <div className={cn("w-full md:w-80 border-r border-border bg-card flex flex-col", mobileShowChat && "hidden md:flex")}>
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-sm">Conversaciones</h2>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{settings?.whatsapp_phone_number || settings?.zernio_phone || "WhatsApp conectado"}</p>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No hay conversaciones todavía.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Aparecerán acá cuando tus pacientes te escriban por WhatsApp.</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.map((convo) => (
                <button
                  key={convo.phone}
                  onClick={() => handleSelect(convo.phone)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                    activePhone === convo.phone
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <p className="font-medium truncate">{fmtPhone(convo.phone)}</p>
                  <p className={cn(
                    "text-xs truncate mt-0.5",
                    activePhone === convo.phone ? "text-primary-foreground/70" : "text-muted-foreground"
                  )}>
                    {convo.lastText}
                  </p>
                  {convo.lastDate && (
                    <p className={cn(
                      "text-[10px] mt-0.5",
                      activePhone === convo.phone ? "text-primary-foreground/60" : "text-muted-foreground/70"
                    )}>
                      {new Date(convo.lastDate).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className={cn("flex-1 flex flex-col bg-background", !mobileShowChat && "hidden md:flex")}>
        {activeConvo ? (
          <>
            <div className="md:hidden flex items-center gap-2 p-3 border-b border-border bg-card">
              <button onClick={() => setMobileShowChat(false)} className="p-1.5 rounded-lg hover:bg-accent">
                <ChevronLeft className="w-5 h-5" />
              </button>
              <span className="font-medium text-sm truncate">{fmtPhone(activeConvo.phone)}</span>
            </div>
            <div className="hidden md:flex items-center gap-2 px-4 h-12 border-b border-border bg-card">
              <span className="font-medium text-sm truncate">{fmtPhone(activeConvo.phone)}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {activeMessages.map((msg, idx) => (
                <MessageBubble key={idx} message={{ role: msg.role, content: msg.text }} />
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Enviando…</span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-border p-3 bg-card">
              <div className="flex items-end gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Escribí tu respuesta…"
                  disabled={sending}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={!input.trim() || sending} size="icon" className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                Si respondés, la IA pausa para esta conversación. Cuando el paciente vuelva a escribir, retoma sola.
              </p>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <MessageCircle className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-heading font-semibold text-lg">Bandeja de WhatsApp</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Seleccioná una conversación para ver el historial y responder, o esperá que tus pacientes te escriban.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Assistant() {
  const { settings, loading } = usePracticeSettings();
  const planStatus = getPlanStatus(settings);

  if (loading || !settings) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!planStatus.canUseWhatsApp) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto h-full flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <MessageCircle className="w-5 h-5 text-emerald-600" />
          <h1 className="text-xl font-heading font-semibold">Chats</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Tu asistente de IA atiende a tus pacientes por WhatsApp. Conectá tu número cuando pases a un plan superior.
        </p>
        <UpgradeBlock plan={planStatus.plan} />
        <div className="flex-1 min-h-0">
          <DemoChat settings={settings} />
        </div>
      </div>
    );
  }

  return <FullAssistant settings={settings} />;
}