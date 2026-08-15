import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { MessageSquare, Plus, Send, Loader2, MessageCircle, ChevronLeft, Lock, Sparkles, Crown } from "lucide-react";
import MessageBubble from "@/components/assistant/MessageBubble";
import DemoChat from "@/components/assistant/DemoChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";

const AGENT_NAME = "appointment_assistant";

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
                Ver Premium ({PLAN_PRICES.premium})
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function FullAssistant() {
  const [conversations, setConversations] = useState([]);
  const [loadingConvos, setLoadingConvos] = useState(true);
  const [activeConvo, setActiveConvo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [whatsappUrl, setWhatsappUrl] = useState(null);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const messagesEndRef = useRef(null);

  const loadConversations = useCallback(async () => {
    try {
      const convos = await base44.agents.listConversations({ agent_name: AGENT_NAME });
      setConversations(convos || []);
    } catch (e) {
      console.error("Error loading conversations", e);
    } finally {
      setLoadingConvos(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    try {
      setWhatsappUrl(base44.agents.getWhatsAppConnectURL(AGENT_NAME));
    } catch (e) {
      console.error("WhatsApp URL error", e);
    }
  }, [loadConversations]);

  useEffect(() => {
    if (!activeConvo?.id) return;
    const unsubscribe = base44.agents.subscribeToConversation(activeConvo.id, (data) => {
      setMessages(data.messages || []);
    });
    return () => unsubscribe();
  }, [activeConvo?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSelectConvo = async (convo) => {
    try {
      const full = await base44.agents.getConversation(convo.id);
      setActiveConvo(full);
      setMessages(full.messages || []);
      setMobileShowChat(true);
    } catch (e) {
      console.error("Error loading conversation", e);
    }
  };

  const handleNewConversation = async () => {
    try {
      const convo = await base44.agents.createConversation({
        agent_name: AGENT_NAME,
        metadata: { name: "Nueva conversación", description: "" },
      });
      setActiveConvo(convo);
      setMessages(convo.messages || []);
      setMobileShowChat(true);
      await loadConversations();
    } catch (e) {
      console.error("Error creating conversation", e);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || sending) return;

    let convo = activeConvo;
    if (!convo) {
      try {
        convo = await base44.agents.createConversation({
          agent_name: AGENT_NAME,
          metadata: { name: "Nueva conversación", description: "" },
        });
        setActiveConvo(convo);
        setMobileShowChat(true);
        loadConversations();
      } catch (e) {
        console.error("Error creating conversation", e);
        return;
      }
    }

    const content = input.trim();
    setInput("");
    setSending(true);
    setMessages((prev) => [...prev, { role: "user", content }]);

    try {
      await base44.agents.addMessage(convo, { role: "user", content });
    } catch (e) {
      console.error("Error sending message", e);
      setMessages((prev) => prev.filter((m) => m.content !== content));
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

  const convoName = (c) => c.metadata?.name || "Conversación";

  return (
    <div className="flex h-[calc(100vh-3.5rem)] md:h-[calc(100vh-3.5rem)] border-t border-border">
      <div className={cn("w-full md:w-80 border-r border-border bg-card flex flex-col", mobileShowChat && "hidden md:flex")}>
        <div className="p-4 border-b border-border space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold text-sm">Conversaciones</h2>
            <Button size="sm" variant="outline" onClick={handleNewConversation} className="h-8 gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              Nueva
            </Button>
          </div>
          {whatsappUrl && (
            <a href={whatsappUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" className="w-full h-8 gap-1.5 bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20">
                <MessageCircle className="w-3.5 h-3.5" />
                Conectar WhatsApp
              </Button>
            </a>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConvos ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : conversations.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">No hay conversaciones todavía.</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Conectá WhatsApp para empezar a recibir mensajes.</p>
            </div>
          ) : (
            <div className="space-y-1 p-2">
              {conversations.map((convo) => (
                <button
                  key={convo.id}
                  onClick={() => handleSelectConvo(convo)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-colors",
                    activeConvo?.id === convo.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <p className="font-medium truncate">{convoName(convo)}</p>
                  {convo.updated_date && (
                    <p className={cn(
                      "text-xs truncate mt-0.5",
                      activeConvo?.id === convo.id ? "text-primary-foreground/70" : "text-muted-foreground"
                    )}>
                      {new Date(convo.updated_date).toLocaleDateString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
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
              <span className="font-medium text-sm truncate">{convoName(activeConvo)}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full text-center px-4">
                  <MessageCircle className="w-10 h-10 text-muted-foreground/40 mb-3" />
                  <p className="text-sm text-muted-foreground">
                    Escribí un mensaje para empezar a conversar con la asistente.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Puede agendar, confirmar, reprogramar y recordar citas.
                  </p>
                </div>
              )}
              {messages.map((msg, idx) => (
                <MessageBubble key={idx} message={msg} />
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-md bg-muted px-4 py-3 flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Pensando…</span>
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
                  placeholder="Escribí tu mensaje…"
                  disabled={sending}
                  className="flex-1"
                />
                <Button onClick={handleSend} disabled={!input.trim() || sending} size="icon" className="h-9 w-9 shrink-0">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <MessageCircle className="w-12 h-12 text-muted-foreground/40 mb-3" />
            <h3 className="font-heading font-semibold text-lg">Asistente de agendamiento</h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Tu recepcionista virtual. Agendá, confirmá, reprogramá y recordá citas conversando con la IA.
            </p>
            <Button onClick={handleNewConversation} className="mt-4 gap-1.5">
              <Plus className="w-4 h-4" />
              Nueva conversación
            </Button>
            {whatsappUrl && (
              <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="mt-2">
                <Button variant="outline" className="gap-1.5 bg-emerald-500/10 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20">
                  <MessageCircle className="w-4 h-4" />
                  Conectar WhatsApp
                </Button>
              </a>
            )}
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

  return <FullAssistant />;
}