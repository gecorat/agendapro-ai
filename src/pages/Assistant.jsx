import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  MessageSquare, Send, Loader2, MessageCircle, ChevronLeft, LogOut, Search,
  Bot, User, Plus, X, Calendar, Phone, Mail, Tag, StickyNote, Clock,
  Smile, Paperclip, ListPlus, ChevronDown, Lock, Sparkles, Crown, Check,
  Pencil, XCircle,
} from "lucide-react";
import DemoChat from "@/components/assistant/DemoChat";
import WhatsAppConnectCard from "@/components/WhatsAppConnectCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";

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

const FILTERS = [
  { value: "all", label: "Todos" },
  { value: "unread", label: "Sin leer" },
  { value: "ai", label: "Atendidos por IA" },
  { value: "manual", label: "Manual / Intervenido" },
];

const PAUSE_OPTIONS = [
  { label: "1 hora", minutes: 60 },
  { label: "24 horas", minutes: 1440 },
  { label: "Indefinido", minutes: null },
];

function fmtShort(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  if (isToday) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function dateSeparatorLabel(dateStr) {
  const d = new Date(dateStr);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return "Hoy";
  if (d.toDateString() === yesterday.toDateString()) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined });
}

function ContactAvatar({ name, url, loading, size = "w-9 h-9", textSize = "text-xs" }) {
  if (url) {
    return <img src={url} alt={name} className={`${size} rounded-full object-cover shrink-0`} />;
  }
  return (
    <div className={`${size} rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold ${textSize} shrink-0`}>
      {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : name?.[0]?.toUpperCase() || "?"}
    </div>
  );
}

function FullAssistant({ settings, reloadSettings }) {
  const [user, setUser] = useState(null);
  const [allMsgs, setAllMsgs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [pauses, setPauses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activePhone, setActivePhone] = useState(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mobileView, setMobileView] = useState("list"); // list | chat | details
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [pauseLoading, setPauseLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [activeAppointments, setActiveAppointments] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [cancellingApptId, setCancellingApptId] = useState(null);
  const messagesEndRef = useRef(null);

  const connected = !!settings?.whatsapp_connected;

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => setUser(null));
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const [msgs, pats, pausesList, tmpl] = await Promise.all([
        base44.entities.Conversation.filter({ professional_id: user.id }, "-created_date", 800),
        base44.entities.Patient.filter({ professional_id: user.id }),
        base44.entities.ChatPause.filter({ professional_id: user.id }),
        base44.entities.MessageTemplate.filter({ professional_id: user.id }).catch(() => []),
      ]);
      setAllMsgs(msgs || []);
      setPatients(pats || []);
      setPauses(pausesList || []);
      setTemplates(tmpl || []);
    } catch (e) {
      console.error("Error loading conversations", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = base44.entities.Conversation.subscribe(() => { load(); });
    return () => { try { unsubscribe(); } catch {} };
  }, [user, load]);

  const patientByPhone = useMemo(() => {
    const map = new Map();
    for (const p of patients) if (p.phone) map.set(p.phone.replace(/[^\d]/g, ""), p);
    return map;
  }, [patients]);

  const pauseByPhone = useMemo(() => {
    const map = new Map();
    for (const p of pauses) map.set(p.phone, p);
    return map;
  }, [pauses]);

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
      // Heurística de "sin leer": mensajes del paciente al final de la conversación que
      // todavía no tienen ninguna respuesta nuestra después.
      let unread = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        if (sorted[i].role === "user") unread++; else break;
      }
      const pause = pauseByPhone.get(phone);
      const patient = patientByPhone.get(phone);
      result.push({
        phone,
        patient,
        messages: sorted,
        lastText: last?.text || "",
        lastDate: last?.created_date || "",
        conversationId: last?.conversation_id || "",
        unread,
        isPaused: !!pause?.paused,
      });
    }
    result.sort((a, b) => new Date(b.lastDate) - new Date(a.lastDate));
    return result;
  }, [allMsgs, pauseByPhone, patientByPhone]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (filter === "unread") list = list.filter((c) => c.unread > 0);
    else if (filter === "ai") list = list.filter((c) => !c.isPaused);
    else if (filter === "manual") list = list.filter((c) => c.isPaused);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.phone.includes(q) || (c.patient?.first_name || "").toLowerCase().includes(q) || (c.patient?.last_name || "").toLowerCase().includes(q));
    }
    return list;
  }, [conversations, filter, search]);

  const activeConvo = conversations.find((c) => c.phone === activePhone) || null;
  const activeMessages = activeConvo?.messages || [];
  const activePatient = activeConvo?.patient || null;
  const chatPaused = activeConvo?.isPaused || false;

  useEffect(() => {
    if (!activePatient?.id) { setActiveAppointments([]); return; }
    base44.entities.Appointment.filter({ patient_id: activePatient.id })
      .then((rows) => {
        const now = new Date();
        const upcoming = (rows || [])
          .filter((a) => a.status !== "cancelled" && new Date(a.start_datetime) >= now)
          .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
        setActiveAppointments(upcoming);
      })
      .catch(() => setActiveAppointments([]));
  }, [activePatient?.id]);

  // Foto real de WhatsApp del contacto (confirmado que WasenderAPI la expone). La URL
  // vence, así que se pide fresca cada vez que cambia la conversación activa — no se
  // guarda en la base para no terminar con fotos rotas al rato.
  useEffect(() => {
    if (!activePhone) { setAvatarUrl(null); return; }
    setAvatarUrl(null);
    setAvatarLoading(true);
    base44.functions.invoke("getContactAvatar", { phone: activePhone })
      .then((res) => setAvatarUrl(res?.data?.imgUrl || null))
      .catch(() => setAvatarUrl(null))
      .finally(() => setAvatarLoading(false));
  }, [activePhone]);

  const handleCancelAppointment = async (apptId) => {
    if (!confirm("¿Cancelar este turno?")) return;
    setCancellingApptId(apptId);
    try {
      await base44.entities.Appointment.update(apptId, { status: "cancelled" });
      setActiveAppointments((prev) => prev.filter((a) => a.id !== apptId));
    } catch (e) {
      console.error(e);
    } finally {
      setCancellingApptId(null);
    }
  };

  const handleTogglePause = async (durationMinutes) => {
    if (!activePhone) return;
    setPauseLoading(true);
    try {
      const res = await base44.functions.invoke("toggleChatPause", { phone: activePhone, paused: !chatPaused, durationMinutes: durationMinutes || undefined });
      setPauses((prev) => {
        const idx = prev.findIndex((p) => p.phone === activePhone);
        const next = { phone: activePhone, professional_id: user.id, paused: res?.data?.paused, paused_until: res?.data?.paused_until };
        if (idx >= 0) { const copy = [...prev]; copy[idx] = next; return copy; }
        return [...prev, next];
      });
    } catch (e) {
      console.error("Error al pausar/reanudar", e);
    } finally {
      setPauseLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Desconectar WhatsApp? La asistente dejará de responder a tus pacientes hasta que reconectes.")) return;
    setDisconnecting(true);
    try {
      await base44.functions.invoke("disconnectWhatsApp", {});
      await reloadSettings?.();
    } catch (e) {
      console.error("Error al desconectar", e);
    } finally {
      setDisconnecting(false);
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, sending]);

  const handleSelect = (phone) => {
    setActivePhone(phone);
    setMobileView("chat");
  };

  const handleSend = async (textOverride) => {
    const content = (textOverride ?? input).trim();
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
      sent_by: "human",
    };
    setAllMsgs((prev) => [...prev, optimistic]);
    try {
      await base44.functions.invoke("zernioSendMessage", {
        phone: activePhone,
        message: content,
        conversationId: activeConvo?.conversationId,
      });
      setPauses((prev) => {
        const idx = prev.findIndex((p) => p.phone === activePhone);
        const next = { phone: activePhone, professional_id: user.id, paused: true };
        if (idx >= 0) { const copy = [...prev]; copy[idx] = next; return copy; }
        return [...prev, next];
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

  const handleAddTag = async () => {
    const tag = newTag.trim();
    if (!tag || !activePatient) return;
    const nextTags = [...(activePatient.tags || []), tag];
    setNewTag("");
    setPatients((prev) => prev.map((p) => (p.id === activePatient.id ? { ...p, tags: nextTags } : p)));
    try {
      await base44.entities.Patient.update(activePatient.id, { tags: nextTags });
    } catch (e) { console.error(e); }
  };

  const handleRemoveTag = async (tag) => {
    if (!activePatient) return;
    const nextTags = (activePatient.tags || []).filter((t) => t !== tag);
    setPatients((prev) => prev.map((p) => (p.id === activePatient.id ? { ...p, tags: nextTags } : p)));
    try {
      await base44.entities.Patient.update(activePatient.id, { tags: nextTags });
    } catch (e) { console.error(e); }
  };

  const handleSaveNotes = async (notes) => {
    if (!activePatient) return;
    setSavingNotes(true);
    setPatients((prev) => prev.map((p) => (p.id === activePatient.id ? { ...p, notes } : p)));
    try {
      await base44.entities.Patient.update(activePatient.id, { notes });
    } catch (e) { console.error(e); } finally { setSavingNotes(false); }
  };

  const fmtPhone = (p) => p || "Número desconocido";
  const contactName = (convo) => (convo.patient ? `${convo.patient.first_name || ""} ${convo.patient.last_name || ""}`.trim() || fmtPhone(convo.phone) : fmtPhone(convo.phone));

  if (!connected) {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto h-full flex flex-col overflow-y-auto">
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

  // ================= Columna 1: lista de chats =================
  const ChatListColumn = (
    <div className={cn("w-full lg:w-[30%] lg:min-w-[280px] lg:max-w-[360px] border-r border-border bg-card flex flex-col shrink-0", mobileView !== "list" && "hidden lg:flex")}>
      <div className="p-3 border-b border-border space-y-2.5 shrink-0">
        <h2 className="font-heading font-semibold text-sm px-1">Conversaciones</h2>
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o número..." className="pl-8 h-9 text-sm" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap",
                filter === f.value ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : filteredConversations.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <MessageSquare className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">No hay conversaciones{search || filter !== "all" ? " con este filtro" : " todavía"}.</p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {filteredConversations.map((convo) => (
              <button
                key={convo.phone}
                onClick={() => handleSelect(convo.phone)}
                className={cn(
                  "w-full text-left px-2.5 py-2.5 rounded-xl transition-colors flex items-start gap-2.5",
                  activePhone === convo.phone ? "bg-accent" : "hover:bg-accent/60"
                )}
              >
                <div className="w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs shrink-0">
                  {contactName(convo)[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{contactName(convo)}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fmtShort(convo.lastDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded-full shrink-0">
                      <MessageCircle className="w-2.5 h-2.5" /> WhatsApp
                    </span>
                    {convo.isPaused && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Manual</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.lastText}</p>
                </div>
                {convo.unread > 0 && (
                  <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-bold flex items-center justify-center mt-0.5">{convo.unread}</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // ================= Columna 2: chat activo =================
  let lastDateLabel = null;
  const ChatColumn = (
    <div className={cn("flex-1 flex flex-col bg-background min-w-0", mobileView !== "chat" && "hidden lg:flex")}>
      {activeConvo ? (
        <>
          <div className="flex items-center gap-3 px-4 h-16 border-b border-border bg-card shrink-0">
            <button onClick={() => setMobileView("list")} className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-accent shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 shrink-0">
              <ContactAvatar name={contactName(activeConvo)} url={avatarUrl} loading={avatarLoading} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{contactName(activeConvo)}</p>
              <p className="text-xs text-muted-foreground truncate">{fmtPhone(activeConvo.phone)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn("text-xs font-medium hidden sm:inline", chatPaused ? "text-amber-600" : "text-emerald-600")}>
                {chatPaused ? "Control Manual" : "IA Activa"}
              </span>
              <Switch checked={!chatPaused} onCheckedChange={() => handleTogglePause(null)} disabled={pauseLoading} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded hover:bg-accent" title="Pausar por tiempo">
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {PAUSE_OPTIONS.map((opt) => (
                    <DropdownMenuItem key={opt.label} onClick={() => handleTogglePause(opt.minutes)}>
                      Pausar IA · {opt.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <button onClick={() => setMobileView("details")} className="lg:hidden p-1.5 rounded-lg hover:bg-accent shrink-0">
              <User className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-1">
            {activeMessages.map((msg, idx) => {
              const label = dateSeparatorLabel(msg.created_date);
              const showSeparator = label !== lastDateLabel;
              lastDateLabel = label;
              const isPatient = msg.role === "user";
              return (
                <React.Fragment key={idx}>
                  {showSeparator && (
                    <div className="flex items-center justify-center py-2">
                      <span className="text-[11px] font-medium text-muted-foreground bg-muted px-2.5 py-1 rounded-full">{label}</span>
                    </div>
                  )}
                  <div className={cn("flex", isPatient ? "justify-start" : "justify-end")}>
                    <div className={cn("max-w-[75%] rounded-2xl px-3.5 py-2.5", isPatient ? "bg-muted text-foreground rounded-bl-md" : "bg-primary text-primary-foreground rounded-br-md")}>
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                      <div className={cn("flex items-center gap-1 mt-1", isPatient ? "justify-start" : "justify-end")}>
                        {!isPatient && (
                          <span className={cn("inline-flex items-center gap-0.5 text-[10px] opacity-80")}>
                            {msg.sent_by === "human" ? <User className="w-2.5 h-2.5" /> : <Bot className="w-2.5 h-2.5" />}
                            {msg.sent_by === "human" ? "Vos" : "IA"}
                          </span>
                        )}
                        <span className="text-[10px] opacity-60">{new Date(msg.created_date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {msg.delivery_failed && (
                        <p className="text-[10px] text-amber-300 mt-0.5">⚠ Puede no haber llegado al WhatsApp del paciente</p>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {sending && (
              <div className="flex justify-end">
                <div className="rounded-2xl rounded-br-md bg-primary/60 px-4 py-3 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary-foreground" />
                  <span className="text-sm text-primary-foreground">Enviando…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t border-border bg-card p-3 shrink-0">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí tu respuesta…"
                disabled={sending}
                rows={1}
                className="flex-1 min-h-[38px] max-h-28 resize-none py-2"
              />
              <div className="flex items-center gap-1 shrink-0">
                <button type="button" title="Adjuntar (próximamente)" disabled className="p-2 rounded-lg text-muted-foreground/50 cursor-not-allowed">
                  <Paperclip className="w-4 h-4" />
                </button>
                <button type="button" title="Emojis (próximamente)" disabled className="p-2 rounded-lg text-muted-foreground/50 cursor-not-allowed">
                  <Smile className="w-4 h-4" />
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" title="Respuestas rápidas" className="p-2 rounded-lg hover:bg-accent text-muted-foreground">
                      <ListPlus className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {templates.length === 0 ? (
                      <div className="px-2 py-2 text-xs text-muted-foreground">Sin plantillas todavía. Creá una desde Ajustes.</div>
                    ) : templates.map((t) => (
                      <DropdownMenuItem key={t.id} onClick={() => setInput((prev) => (prev ? `${prev} ${t.body}` : t.body))}>
                        <span className="truncate">{t.title}</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={() => handleSend()} disabled={!input.trim() || sending} size="icon" className="h-9 w-9 shrink-0 bg-emerald-600 hover:bg-emerald-700">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
              {chatPaused ? "La IA está en pausa para esta conversación." : "Si respondés, la IA se pausa automáticamente. Reanudala con el switch de arriba."}
            </p>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <MessageCircle className="w-12 h-12 text-muted-foreground/40 mb-3" />
          <h3 className="font-heading font-semibold text-lg">Bandeja de WhatsApp</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">Seleccioná una conversación para ver el historial y responder.</p>
        </div>
      )}
    </div>
  );

  // ================= Columna 3: ficha del contacto =================
  const DetailsColumn = activeConvo && (
    <div className={cn("w-full lg:w-[25%] lg:min-w-[260px] lg:max-w-[340px] border-l border-border bg-card flex flex-col shrink-0", mobileView !== "details" && "hidden lg:flex")}>
      <div className="flex items-center gap-2 p-3 border-b border-border shrink-0">
        <button onClick={() => setMobileView("chat")} className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-accent">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h2 className="font-heading font-semibold text-sm">Ficha del contacto</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-lg mx-auto mb-2">
            {contactName(activeConvo)[0]?.toUpperCase() || "?"}
          </div>
          <p className="font-semibold text-sm">{contactName(activeConvo)}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <Phone className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span className="truncate">{fmtPhone(activeConvo.phone)}</span>
          </div>
          {activePatient?.email && (
            <div className="flex items-center gap-2 text-sm">
              <Mail className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">{activePatient.email}</span>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Tag className="w-3 h-3" /> Etiquetas</p>
          <div className="flex flex-wrap gap-1.5">
            {(activePatient?.tags || []).map((tag) => (
              <span key={tag} className="inline-flex items-center gap-1 text-[11px] font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                {tag}
                <button onClick={() => handleRemoveTag(tag)}><X className="w-2.5 h-2.5" /></button>
              </span>
            ))}
          </div>
          {activePatient ? (
            <div className="flex items-center gap-1.5">
              <Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())} placeholder="Nueva etiqueta..." className="h-7 text-xs" />
              <Button size="icon" variant="outline" className="h-7 w-7 shrink-0" onClick={handleAddTag}><Plus className="w-3.5 h-3.5" /></Button>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground">Este contacto todavía no tiene ficha de paciente (se crea al agendar su primer turno).</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Calendar className="w-3 h-3" /> Próximas citas</p>
          </div>
          {activeAppointments.length === 0 ? (
            <p className="text-[11px] text-muted-foreground">Sin turnos agendados.</p>
          ) : (
            <div className="space-y-1.5">
              {activeAppointments.map((a) => (
                <div key={a.id} className="text-xs bg-muted/60 rounded-lg p-2">
                  <p className="font-medium">{a.service_name}</p>
                  <p className="text-muted-foreground">{new Date(a.start_datetime).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  <span className={cn("inline-block mt-1 text-[10px] px-1.5 py-0.5 rounded-full font-medium", a.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                    {a.status === "confirmed" ? "Confirmado" : "Pendiente"}
                  </span>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" asChild>
            <Link to="/agenda"><Plus className="w-3.5 h-3.5" /> Agendar turno manual</Link>
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Control de automatización</p>
          <div className="grid grid-cols-3 gap-1.5">
            {PAUSE_OPTIONS.map((opt) => (
              <button
                key={opt.label}
                onClick={() => handleTogglePause(opt.minutes)}
                className="text-[10px] font-medium py-1.5 rounded-lg border border-border hover:bg-accent transition-colors"
              >
                {opt.label}
              </button>
            ))}
          </div>
          {chatPaused && (
            <button onClick={() => handleTogglePause(null)} className="w-full text-[11px] font-medium py-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors flex items-center justify-center gap-1">
              <Check className="w-3 h-3" /> Reanudar IA ahora
            </button>
          )}
        </div>

        {activePatient && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><StickyNote className="w-3 h-3" /> Notas internas</p>
            <Textarea
              defaultValue={activePatient.notes || ""}
              onBlur={(e) => handleSaveNotes(e.target.value)}
              placeholder="Notas privadas, solo las ves vos..."
              rows={4}
              className="text-xs"
            />
            {savingNotes && <p className="text-[10px] text-muted-foreground">Guardando...</p>}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-hidden flex flex-col">
      <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-border bg-card shrink-0">
        <p className="text-xs text-muted-foreground truncate">{settings?.whatsapp_phone_number || settings?.zernio_phone || "WhatsApp conectado"}</p>
        <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="h-7 px-2 gap-1.5 text-xs shrink-0">
          {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
          Desconectar
        </Button>
      </div>
      <div className="flex-1 min-h-0 flex">
        {ChatListColumn}
        {ChatColumn}
        {DetailsColumn}
      </div>
    </div>
  );
}

export default function Assistant() {
  const { settings, loading, reload } = usePracticeSettings();
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
      <div className="p-4 md:p-6 max-w-2xl mx-auto h-full flex flex-col overflow-y-auto">
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

  return <FullAssistant settings={settings} reloadSettings={reload} />;
}
