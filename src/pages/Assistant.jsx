import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import {
  MessageSquare, Send, Loader2, MessageCircle, ChevronLeft, LogOut, Search,
  Bot, User, Plus, X, Calendar, Phone, Mail, Tag, StickyNote, Clock,
  Smile, Paperclip, ListPlus, ChevronDown, Lock, Sparkles, Crown, Check,
  Pencil, XCircle, IdCard, BellRing, RefreshCw,
} from "lucide-react";
import DemoChat from "@/components/assistant/DemoChat";
import PatientForm from "@/components/PatientForm";
import { loadReadState, saveChatLastRead, getLocalChatLastRead } from "@/lib/read-state";
import WhatsAppConnectCard from "@/components/WhatsAppConnectCard";
import BotPauseButton from "@/components/BotPauseButton";
import BotPauseBanner from "@/components/BotPauseBanner";
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
            <Button size="sm" asChild className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Link to="/bot">
                <Sparkles className="w-3.5 h-3.5" />
                Probar el bot ahora
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link to="/upgrade-plan">
                <Crown className="w-3.5 h-3.5" />
                Pasar a Pro ({PLAN_PRICES.pro})
              </Link>
            </Button>
            <Button size="sm" variant="outline" asChild className="gap-1.5">
              <Link to="/upgrade-plan">
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

// Paleta inspirada en WhatsApp Web, para que la bandeja se sienta familiar de un vistazo:
// verde de marca, burbujas verde claro para lo que mandás vos/la IA, blanco para lo que
// manda el paciente, y un fondo cálido en el área de mensajes (como el "papel tapiz" de
// WhatsApp real) en vez de los grises genéricos que tenía antes.
const WA = {
  accent: "#00A884",
  accentDark: "#008069",
  panelHeader: "#F0F2F5",
  chatBg: "#EFEAE2",
  outgoing: "#D9FDD3",
  incoming: "#FFFFFF",
  selected: "#F0F2F5",
  border: "#E9EDEF",
};

const PAUSE_OPTIONS = [
  { label: "1 hora", minutes: 60 },
  { label: "24 horas", minutes: 1440 },
  { label: "Indefinido", minutes: null },
];

// Todas las fechas/horas del chat se muestran SIEMPRE en hora de Argentina, sin importar
// en qué zona horaria esté configurado el celu/navegador de quien mira la pantalla.
const AR_TZ = "America/Argentina/Buenos_Aires";

// Base44 guarda created_date en UTC pero SIN el sufijo "Z" (ej. "2026-08-25T14:31:03").
// Sin esa "Z", `new Date(...)` del navegador interpreta el string como si YA fuera hora
// local en vez de UTC — confirmado en vivo: un mensaje guardado a las 14:31 UTC (11:31 hora
// real de Argentina) se mostraba como "14:31", el valor crudo sin convertir, en vez de
// restarle las 3 horas de diferencia. Forzamos la "Z" al parsear para que se interprete
// como UTC real y así sí se convierta bien a hora de Argentina al formatear.
function parseServerDate(dateStr) {
  if (!dateStr) return new Date(NaN);
  const hasTz = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(dateStr);
  return new Date(hasTz ? dateStr : `${dateStr}Z`);
}

function arDateKey(d) {
  return d.toLocaleDateString("en-CA", { timeZone: AR_TZ }); // YYYY-MM-DD, comparable como string
}

function fmtShort(dateStr) {
  if (!dateStr) return "";
  const d = parseServerDate(dateStr);
  const now = new Date();
  const isToday = arDateKey(d) === arDateKey(now);
  if (isToday) return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: AR_TZ });
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short", timeZone: AR_TZ });
}

function dateSeparatorLabel(dateStr) {
  const d = parseServerDate(dateStr);
  const now = new Date();
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
  if (arDateKey(d) === arDateKey(now)) return "Hoy";
  if (arDateKey(d) === arDateKey(yesterday)) return "Ayer";
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: d.getFullYear() !== now.getFullYear() ? "numeric" : undefined, timeZone: AR_TZ });
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

function FullAssistant({ settings, reloadSettings, save }) {
  const [user, setUser] = useState(null);
  const [allMsgs, setAllMsgs] = useState([]);
  const [patients, setPatients] = useState([]);
  const [pauses, setPauses] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [waNames, setWaNames] = useState([]);
  const [syncingContacts, setSyncingContacts] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  // Edición del nombre del contacto desde la ficha de la derecha. `null` = no se está
  // editando; un string (aunque sea vacío) = hay un input abierto con ese valor.
  const [editingName, setEditingName] = useState(null);
  const [savingName, setSavingName] = useState(false);
  const [newPatientOpen, setNewPatientOpen] = useState(false);
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
  const [selectedDuration, setSelectedDuration] = useState(null);
  // "No leído" tenía una heurística sola (mensajes del paciente al final sin respuesta
  // nuestra después) sin ningún registro de si vos ya abriste ese chat — confirmado en
  // vivo: abrir el chat no lo marcaba como leído, se quedaba marcado hasta que alguien
  // (vos o el bot) mandaba una respuesta. Ahora guardamos, por teléfono, la última vez que
  // abriste esa conversación, en el servidor (UserReadState) para que valga en todos tus
  // dispositivos, con el localStorage como caché para pintar bien al instante.
  const [lastReadMap, setLastReadMap] = useState(() => getLocalChatLastRead());
  const [readStateRowId, setReadStateRowId] = useState(null);
  const readStateRowIdRef = useRef(null);
  const lastReadMapRef = useRef(lastReadMap);
  useEffect(() => { lastReadMapRef.current = lastReadMap; }, [lastReadMap]);
  useEffect(() => { readStateRowIdRef.current = readStateRowId; }, [readStateRowId]);

  useEffect(() => {
    let cancelled = false;
    loadReadState().then(({ chatLastRead, rowId }) => {
      if (cancelled) return;
      setReadStateRowId(rowId);
      if (chatLastRead) setLastReadMap(chatLastRead);
    });
    return () => { cancelled = true; };
  }, []);

  const markPhoneRead = useCallback((phone) => {
    if (!phone) return;
    const now = new Date().toISOString();
    const next = { ...lastReadMapRef.current, [phone]: now };
    lastReadMapRef.current = next;
    setLastReadMap(next);
    saveChatLastRead(readStateRowIdRef.current, next).then((id) => {
      if (id && id !== readStateRowIdRef.current) {
        readStateRowIdRef.current = id;
        setReadStateRowId(id);
      }
    });
  }, []);
  const messagesEndRef = useRef(null);

  const connected = !!settings?.whatsapp_connected;

  useEffect(() => {
    base44.auth.me().then((u) => setUser(u)).catch(() => setUser(null));
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    // safeFetch envuelve CADA llamada en su propia función anónima: si
    // base44.entities.Patient.filter(...) revienta de forma SINCRÓNICA (no como promesa
    // rechazada, sino literalmente al evaluarla — confirmado en vivo: las llamadas de
    // Patient/ChatPause/MessageTemplate ni siquiera llegaban a dispararse en la pestaña
    // Red), ese error queda atrapado ADENTRO de safeFetch y nunca corta la construcción
    // del arreglo que le pasamos a Promise.all — así las otras 3 llamadas sí se disparan.
    // El try/finally de afuera es una segunda red de seguridad: pase lo que pase,
    // setLoading(false) siempre se ejecuta.
    const safeFetch = async (fn, label) => {
      try {
        return await fn();
      } catch (e) {
        console.error(`Error cargando ${label}`, e);
        return [];
      }
    };
    try {
      // Todo por funciones con alcance de EQUIPO, no consultando las entidades directo.
      // El webhook de WhatsApp guarda las conversaciones con el id del DUEÑO del
      // consultorio, así que filtrar por `user.id` dejaba a los profesionales invitados con
      // la bandeja completamente vacía — y sin ningún error: decía "No hay conversaciones
      // todavía". Mismo patrón que ya usan la Agenda y Pacientes.
      const [inboxRes, patsRes] = await Promise.all([
        safeFetch(() => base44.functions.invoke("getScopedConversations", {}), "conversaciones"),
        safeFetch(() => base44.functions.invoke("getScopedPatients", {}), "pacientes"),
      ]);
      const inbox = inboxRes?.data || {};
      setAllMsgs(inbox.conversations || []);
      setPatients(patsRes?.data?.patients || []);
      setPauses(inbox.pauses || []);
      setTemplates(inbox.templates || []);
      setWaNames(inbox.contacts || []);
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
    // Mismo criterio que el backend (base44/shared/phone-utils.ts): comparamos por los
    // últimos 10 dígitos, no el string completo — así "+5493425526816" (con el 9 de
    // celular) y "+543425526816" (sin él, si alguien lo cargó a mano en la ficha del
    // paciente) matchean con la MISMA conversación, en vez de que la bandeja muestre el
    // número pelado en vez del nombre real del paciente.
    const canonical = (phone) => {
      const digits = (phone || "").replace(/\D/g, "");
      return digits.length <= 10 ? digits : digits.slice(-10);
    };
    const map = new Map();
    for (const p of patients) if (p.phone) map.set(canonical(p.phone), p);
    return map;
  }, [patients]);

  const pauseByPhone = useMemo(() => {
    const map = new Map();
    for (const p of pauses) map.set((p.phone || "").replace(/\D/g, ""), p);
    return map;
  }, [pauses]);

  // Nombre con el que la persona figura en WhatsApp. Sirve para que un chat de alguien que
  // todavía no tiene ficha de paciente no aparezca como un número pelado. Se compara por
  // los últimos 10 dígitos, igual que con los pacientes.
  const waNameByPhone = useMemo(() => {
    const canonical = (phone) => {
      const digits = (phone || "").replace(/\D/g, "");
      return digits.length <= 10 ? digits : digits.slice(-10);
    };
    const map = new Map();
    // Los de la agenda del celular pisan a los de perfil: son los que el profesional
    // reconoce. Se cargan en segundo lugar para que ganen.
    for (const c of waNames) if (c.phone && c.source !== "agenda") map.set(canonical(c.phone), c.name);
    for (const c of waNames) if (c.phone && c.source === "agenda") map.set(canonical(c.phone), c.name);
    return map;
  }, [waNames]);

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
      // todavía no tienen ninguna respuesta nuestra después, Y que llegaron después de la
      // última vez que abriste ese chat (si nunca lo abriste, cuentan todos).
      const readAt = lastReadMap[phone] ? new Date(lastReadMap[phone]) : null;
      let unread = 0;
      for (let i = sorted.length - 1; i >= 0; i--) {
        // Los avisos automáticos (recordatorios, confirmaciones) NO cuentan como "te
        // respondimos": los dispara el reloj, no una lectura del mensaje del paciente. Sin
        // este `continue`, un paciente que escribe "necesito cancelar" y después recibe su
        // recordatorio de 3hs quedaba con el chat en cero sin leer, y el profesional no se
        // enteraba nunca. Los mensajes del bot y los tuyos sí cortan la cuenta, porque ahí
        // la conversación efectivamente siguió.
        if (sorted[i].sent_by === "system") continue;
        if (sorted[i].role !== "user") break;
        if (readAt && parseServerDate(sorted[i].created_date) <= readAt) break;
        unread++;
      }
      // `phone` acá es el que vino tal cual en la Conversation (webhook de WhatsApp): puede
      // traer o no el "+" según el proveedor (Zernio sí, Evolution no). ChatPause siempre
      // guarda el teléfono normalizado (solo dígitos), así que normalizamos acá antes de
      // buscar — si no, la pausa nunca matchea en cuentas conectadas por Zernio.
      const pause = pauseByPhone.get(phone.replace(/\D/g, ""));
      // Para el paciente sí usamos los últimos 10 dígitos (canonicalizamos igual que al
      // armar `patientByPhone`) para que matchee sin importar el formato exacto con el que
      // haya quedado guardado el teléfono del paciente.
      const canonicalPhone = phone.replace(/\D/g, "").slice(-10);
      const patient = patientByPhone.get(canonicalPhone);
      const waName = waNameByPhone.get(canonicalPhone) || "";
      result.push({
        phone,
        patient,
        waName,
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
  }, [allMsgs, pauseByPhone, patientByPhone, waNameByPhone, lastReadMap]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (filter === "unread") list = list.filter((c) => c.unread > 0);
    else if (filter === "ai") list = list.filter((c) => !c.isPaused);
    else if (filter === "manual") list = list.filter((c) => c.isPaused);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.phone.includes(q) || (c.patient?.first_name || "").toLowerCase().includes(q) || (c.patient?.last_name || "").toLowerCase().includes(q) || (c.waName || "").toLowerCase().includes(q));
    }
    return list;
  }, [conversations, filter, search]);

  const activeConvo = conversations.find((c) => c.phone === activePhone) || null;
  const activeMessages = activeConvo?.messages || [];
  const activePatient = activeConvo?.patient || null;
  const chatPaused = activeConvo?.isPaused || false;

  // Reflejamos qué duración quedó activa (tildado visual) al abrir cada conversación:
  // si hay una fecha de vencimiento, mostramos ese botón resaltado; sin vencimiento pero
  // pausado, es "Indefinido"; sin pausa, ninguno.
  useEffect(() => {
    const p = pauseByPhone.get((activePhone || "").replace(/\D/g, ""));
    if (!p?.paused) { setSelectedDuration(null); return; }
    if (!p.paused_until) { setSelectedDuration(null); return; }
    const remainingMin = (new Date(p.paused_until) - new Date()) / 60000;
    const closest = PAUSE_OPTIONS.filter((o) => o.minutes).reduce((best, o) =>
      Math.abs(o.minutes - remainingMin) < Math.abs((best?.minutes ?? Infinity) - remainingMin) ? o : best, null);
    setSelectedDuration(closest?.minutes ?? null);
  }, [activePhone, pauseByPhone]);

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

  // Foto real de WhatsApp del contacto (vía Evolution API). La URL
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
      try {
        await base44.functions.invoke("syncAppointmentGoogle", { appointmentId: apptId });
      } catch { /* no romper el flujo si Google falla */ }
      try {
        await base44.functions.invoke("notifyPatientOfAppointmentChange", { appointmentId: apptId, changeType: "cancelled" });
      } catch { /* no romper el flujo si el aviso falla */ }
      setActiveAppointments((prev) => prev.filter((a) => a.id !== apptId));
    } catch (e) {
      console.error(e);
    } finally {
      setCancellingApptId(null);
    }
  };

  const handleTogglePause = async () => {
    if (!activePhone) return;
    setPauseLoading(true);
    try {
      const res = await base44.functions.invoke("toggleChatPause", { phone: activePhone, paused: !chatPaused });
      applyPauseResult(res);
    } catch (e) {
      console.error("Error al pausar/reanudar", e);
    } finally {
      setPauseLoading(false);
    }
  };

  // Antes esto y el switch compartian la misma función, que siempre mandaba
  // paused: !chatPaused — si ya estaba pausado y tocás "1 hora" para CAMBIAR la duración,
  // en realidad se reactivaba el bot en vez de actualizar el tiempo. Ahora esto siempre
  // fuerza paused:true con la duración elegida, sin importar el estado actual.
  const handleSetDuration = async (minutes) => {
    if (!activePhone) return;
    setPauseLoading(true);
    setSelectedDuration(minutes);
    try {
      const res = await base44.functions.invoke("toggleChatPause", { phone: activePhone, paused: true, durationMinutes: minutes || undefined });
      applyPauseResult(res);
    } catch (e) {
      console.error("Error al fijar duración de pausa", e);
    } finally {
      setPauseLoading(false);
    }
  };

  function applyPauseResult(res) {
    // El backend guarda la pausa con el teléfono NORMALIZADO (solo dígitos) y ahora lo
    // devuelve. Antes acá se comparaba contra `activePhone` crudo, que en las cuentas
    // conectadas por Zernio trae "+": nunca matcheaba la fila existente y se agregaba una
    // duplicada al estado local, así que el botón mostraba un estado que no era el real.
    const key = res?.data?.phone || (activePhone || "").replace(/\D/g, "");
    setPauses((prev) => {
      const idx = prev.findIndex((p) => (p.phone || "").replace(/\D/g, "") === key);
      const base = idx >= 0 ? prev[idx] : { phone: key };
      const next = { ...base, phone: key, paused: res?.data?.paused, paused_until: res?.data?.paused_until };
      if (idx >= 0) { const copy = [...prev]; copy[idx] = next; return copy; }
      return [...prev, next];
    });
  }

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

  // Interruptor GENERAL del bot: a diferencia de "Desconectar" (corta la sesión de
  // WhatsApp por completo), esto deja el número conectado pero el bot deja de contestar a
  // CUALQUIER paciente hasta que se reactive — los mensajes entrantes se siguen guardando
  // en la bandeja para responder a mano. Útil para pausar del todo sin perder la conexión
  // (ej. vacaciones, feriados, mientras se ajusta la configuración). El control con las
  // duraciones (BotPauseButton) usa `save` directamente, ya no hace falta este wrapper.

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeMessages.length, sending]);

  // Si llega un mensaje nuevo mientras el chat ya está abierto (activePhone === ese
  // teléfono), lo marcamos leído al toque — si no, apenas llega quedaría marcado como "no
  // leído" en la lista aunque lo estés viendo en pantalla en ese mismo momento.
  useEffect(() => {
    if (activePhone) markPhoneRead(activePhone);
  }, [activeMessages.length, activePhone]);

  const handleSelect = (phone) => {
    setActivePhone(phone);
    setMobileView("chat");
    markPhoneRead(phone);
    // Cerrar la edición del nombre al cambiar de chat: si no, lo que estabas escribiendo para
    // un contacto quedaba abierto sobre otro y se podía guardar en la ficha equivocada.
    setEditingName(null);
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
      // Responder a mano pausa el bot para esta conversación (lo hace el backend). Acá se
      // refleja en pantalla usando la MISMA clave normalizada con la que se guarda, para no
      // agregar una fila duplicada que muestre un estado que no es el real.
      const key = (activePhone || "").replace(/\D/g, "");
      setPauses((prev) => {
        const idx = prev.findIndex((p) => (p.phone || "").replace(/\D/g, "") === key);
        const base = idx >= 0 ? prev[idx] : { phone: key };
        const next = { ...base, phone: key, paused: true, paused_until: null };
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

  // Nombre principal del chat: manda la ficha de paciente (es la que cargó el profesional),
  // después el nombre de WhatsApp, y recién al final el número pelado.
  const contactName = (convo) => {
    const fromPatient = convo.patient ? `${convo.patient.first_name || ""} ${convo.patient.last_name || ""}`.trim() : "";
    return fromPatient || convo.waName || fmtPhone(convo.phone);
  };

  // El nombre de WhatsApp se muestra APARTE, y solo cuando aporta algo: si ya es el nombre
  // principal del chat no tiene sentido repetirlo.
  const waTag = (convo) => {
    if (!convo.waName) return "";
    if (contactName(convo) === convo.waName) return "";
    return convo.waName;
  };

  // Guarda el nombre escrito a mano. Se manda al backend (y no se escribe la entidad desde
  // acá) porque la fila se guarda con el id del DUEÑO del consultorio: un profesional
  // invitado no podría crearla la primera vez. Queda con origen "manual", que ninguna
  // sincronización de contactos pisa después.
  const handleSaveName = async () => {
    if (!activePhone) return;
    setSavingName(true);
    try {
      await base44.functions.invoke("setContactName", { phone: activePhone, name: (editingName || "").trim() });
      setEditingName(null);
      await load();
    } catch (err) {
      console.error("No se pudo guardar el nombre", err);
    } finally {
      setSavingName(false);
    }
  };

  const handleSyncContacts = async () => {
    setSyncingContacts(true);
    setSyncResult(null);
    try {
      const res = await base44.functions.invoke("syncWhatsAppContacts", {});
      const d = res?.data || {};
      if (d.chats_matched > 0) {
        setSyncResult({ ok: true, text: `Listo: ${d.chats_matched} de ${d.chats_total} ${d.chats_total === 1 ? "chat" : "chats"} con el nombre de tu agenda.` });
      } else {
        // Que vuelva vacío NO es un error: WhatsApp restringió la sincronización de la
        // agenda del celular y a veces no manda los nombres. Se explica en vez de mostrar
        // un éxito engañoso.
        setSyncResult({ ok: false, text: "WhatsApp no compartió nombres de tu agenda. Los chats siguen mostrando el nombre de perfil de cada persona." });
      }
      await load();
    } catch (err) {
      const message = err?.response?.data?.message || "No se pudo sincronizar. Probá de nuevo en un rato.";
      setSyncResult({ ok: false, text: message });
    } finally {
      setSyncingContacts(false);
    }
  };

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
    <div className={cn("w-full lg:w-[30%] lg:min-w-[280px] lg:max-w-[360px] border-r flex flex-col shrink-0 bg-white", mobileView !== "list" && "hidden lg:flex")} style={{ borderColor: WA.border }}>
      <div className="p-3 border-b space-y-2.5 shrink-0" style={{ borderColor: WA.border, background: WA.panelHeader }}>
        <div className="flex items-center justify-between gap-2 px-1">
          <h2 className="font-heading font-semibold text-sm">Conversaciones</h2>
          {/* Trae los nombres que WhatsApp haya sincronizado de la agenda del celular. Solo
              actualiza chats que ya existen: no importa la agenda entera. */}
          <button
            onClick={handleSyncContacts}
            disabled={syncingContacts}
            className="shrink-0 inline-flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border transition-colors disabled:opacity-50"
            style={{ borderColor: WA.border, color: "#54656F", background: "#fff" }}
            title="Traer los nombres de contacto desde WhatsApp"
          >
            {syncingContacts ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            Contactos
          </button>
        </div>
        {syncResult && (
          <p className={cn("text-[11px] px-1 leading-snug", syncResult.ok ? "text-emerald-700" : "text-muted-foreground")}>
            {syncResult.text}
          </p>
        )}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar por nombre o número..." className="pl-8 h-9 text-sm bg-white" />
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
          {FILTERS.map((f) => {
            const active = filter === f.value;
            return (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className="shrink-0 px-2.5 py-1 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap"
                style={active ? { background: WA.accent, borderColor: WA.accent, color: "#fff" } : { borderColor: WA.border, color: "#54656F", background: "#fff" }}
              >
                {f.label}
              </button>
            );
          })}
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
            {filteredConversations.map((convo) => {
              const isActive = activePhone === convo.phone;
              return (
              <button
                key={convo.phone}
                onClick={() => handleSelect(convo.phone)}
                className="w-full text-left px-2.5 py-2.5 rounded-xl transition-colors flex items-start gap-2.5"
                style={isActive ? { background: WA.selected } : undefined}
                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = "#F5F6F6"; }}
                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = ""; }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs shrink-0" style={{ background: "#DFE5E7", color: WA.accentDark }}>
                  {contactName(convo)[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-sm truncate">{contactName(convo)}</p>
                    <span className="text-[10px] text-muted-foreground shrink-0">{fmtShort(convo.lastDate)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0" style={{ color: WA.accentDark, background: "#E7F8F3" }}>
                      <MessageCircle className="w-2.5 h-2.5" /> WhatsApp
                    </span>
                    {convo.isPaused && (
                      <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded-full shrink-0">Manual</span>
                    )}
                    {waTag(convo) && (
                      <span className="text-[10px] text-muted-foreground truncate min-w-0" title={`Así figura en WhatsApp: ${waTag(convo)}`}>WA: {waTag(convo)}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.lastText}</p>
                </div>
                {convo.unread > 0 && (
                  <span className="shrink-0 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center mt-0.5" style={{ background: WA.accent }}>{convo.unread}</span>
                )}
              </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ================= Columna 2: chat activo =================
  let lastDateLabel = null;
  const ChatColumn = (
    <div className={cn("flex-1 flex flex-col min-w-0", mobileView !== "chat" && "hidden lg:flex")} style={{ background: WA.chatBg }}>
      {activeConvo ? (
        <>
          <div className="flex items-center gap-3 px-4 h-16 border-b shrink-0" style={{ background: WA.panelHeader, borderColor: WA.border }}>
            <button onClick={() => setMobileView("list")} className="lg:hidden p-1.5 -ml-1.5 rounded-lg hover:bg-accent shrink-0">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <ContactAvatar name={contactName(activeConvo)} url={avatarUrl} loading={avatarLoading} />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm truncate">{contactName(activeConvo)}</p>
              <p className="text-xs text-muted-foreground truncate">{fmtPhone(activeConvo.phone)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={cn("text-xs font-medium hidden sm:inline", chatPaused ? "text-amber-600" : "text-emerald-600")}>
                {chatPaused ? "Control Manual" : "IA Activa"}
              </span>
              <Switch checked={!chatPaused} onCheckedChange={handleTogglePause} disabled={pauseLoading} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded hover:bg-accent" title="Pausar por tiempo">
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {PAUSE_OPTIONS.map((opt) => (
                    <DropdownMenuItem key={opt.label} onClick={() => handleSetDuration(opt.minutes)}>
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
                      <span className="text-[11px] font-medium px-2.5 py-1 rounded-lg shadow-sm" style={{ background: "#FFFFFF", color: "#54656F" }}>{label}</span>
                    </div>
                  )}
                  <div className={cn("flex", isPatient ? "justify-start" : "justify-end")}>
                    <div
                      className="max-w-[75%] rounded-lg px-2.5 py-1.5 shadow-sm"
                      style={isPatient
                        ? { background: WA.incoming, color: "#111B21", borderTopLeftRadius: 4 }
                        : { background: WA.outgoing, color: "#111B21", borderTopRightRadius: 4 }}
                    >
                      <p className="text-sm whitespace-pre-wrap break-words">{msg.text}</p>
                      <div className={cn("flex items-center gap-1 mt-1", isPatient ? "justify-start" : "justify-end")}>
                        {!isPatient && (
                          // Tres orígenes distintos, no dos: "system" son los avisos
                          // automáticos de la plataforma (confirmación, recordatorio,
                          // reprogramación, cancelación). Antes ni siquiera se guardaban acá,
                          // así que el chat mostraba un hueco donde sí le habíamos hablado al
                          // paciente — y los pocos que se guardaban aparecían como "IA".
                          <span className="inline-flex items-center gap-0.5 text-[10px]" style={{ color: "#667781" }}>
                            {msg.sent_by === "human" ? <User className="w-2.5 h-2.5" />
                              : msg.sent_by === "system" ? <BellRing className="w-2.5 h-2.5" />
                              : <Bot className="w-2.5 h-2.5" />}
                            {msg.sent_by === "human" ? "Vos" : msg.sent_by === "system" ? "Automático" : "IA"}
                          </span>
                        )}
                        <span className="text-[10px]" style={{ color: "#667781" }}>{parseServerDate(msg.created_date).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: AR_TZ })}</span>
                      </div>
                      {msg.delivery_failed && (
                        <p className="text-[10px] text-amber-600 mt-0.5">⚠ Puede no haber llegado al WhatsApp del paciente</p>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })}
            {sending && (
              <div className="flex justify-end">
                <div className="rounded-lg px-4 py-3 flex items-center gap-2 shadow-sm" style={{ background: WA.outgoing }}>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" style={{ color: "#111B21" }} />
                  <span className="text-sm" style={{ color: "#111B21" }}>Enviando…</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="border-t p-3 shrink-0" style={{ borderColor: WA.border, background: WA.panelHeader }}>
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribí tu respuesta…"
                disabled={sending}
                rows={1}
                className="flex-1 min-h-[38px] max-h-28 resize-none py-2 bg-white"
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
          <div className="mx-auto mb-2 w-14 h-14">
            <ContactAvatar name={contactName(activeConvo)} url={avatarUrl} loading={avatarLoading} size="w-14 h-14" textSize="text-lg" />
          </div>
          {editingName === null ? (
            <div className="flex items-center justify-center gap-1.5">
              <p className="font-semibold text-sm">{contactName(activeConvo)}</p>
              <button
                onClick={() => setEditingName(activeConvo.waName || (activeConvo.patient ? contactName(activeConvo) : ""))}
                className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground shrink-0"
                title="Cambiar el nombre de este contacto"
              >
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <div className="space-y-1.5">
              <Input
                autoFocus
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); handleSaveName(); }
                  if (e.key === "Escape") setEditingName(null);
                }}
                placeholder="Nombre del contacto"
                className="h-8 text-sm text-center"
              />
              <div className="flex items-center justify-center gap-1.5">
                <Button size="sm" className="h-7 text-xs" onClick={handleSaveName} disabled={savingName}>
                  {savingName && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}Guardar
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setEditingName(null)} disabled={savingName}>
                  Cancelar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                Vacío vuelve a mostrar el nombre de WhatsApp. Si es un paciente, mejor creá su ficha más abajo.
              </p>
            </div>
          )}
          {editingName === null && waTag(activeConvo) && (
            <p className="text-[11px] text-muted-foreground mt-0.5">En WhatsApp figura como «{waTag(activeConvo)}»</p>
          )}
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
          {activePatient?.dni && (
            <div className="flex items-center gap-2 text-sm">
              <IdCard className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <span className="truncate">DNI {activePatient.dni}</span>
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
            <div className="space-y-1.5">
              <p className="text-[11px] text-muted-foreground">Este contacto todavía no tiene ficha de paciente.</p>
              <Button size="sm" variant="outline" className="h-7 text-xs w-full" onClick={() => setNewPatientOpen(true)}>
                <Plus className="w-3 h-3 mr-1" /> Crear ficha de paciente
              </Button>
            </div>
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
                  <div className="flex items-center justify-between mt-1.5">
                    <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", a.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                      {a.status === "confirmed" ? "Confirmado" : "Pendiente"}
                    </span>
                    <div className="flex items-center gap-1">
                      <Link to={`/agenda?edit=${a.id}`} className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-foreground" title="Editar / reagendar">
                        <Pencil className="w-3 h-3" />
                      </Link>
                      <button
                        onClick={() => handleCancelAppointment(a.id)}
                        disabled={cancellingApptId === a.id}
                        className="p-1 rounded hover:bg-rose-50 text-muted-foreground hover:text-rose-600"
                        title="Cancelar turno"
                      >
                        {cancellingApptId === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" size="sm" className="w-full text-xs gap-1.5" asChild>
            <Link to="/agenda"><Plus className="w-3.5 h-3.5" /> Agendar turno manual</Link>
          </Button>
        </div>

        <div className="space-y-2.5">
          <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Control de automatización</p>
          <div className="flex items-center justify-between p-2.5 rounded-lg border border-border">
            <div>
              <p className="text-sm font-medium">Asistente IA</p>
              <p className={cn("text-xs font-medium", chatPaused ? "text-amber-600" : "text-emerald-600")}>
                {chatPaused ? "Pausada — atendés vos" : "Activa — responde sola"}
              </p>
            </div>
            <Switch checked={!chatPaused} onCheckedChange={handleTogglePause} disabled={pauseLoading} />
          </div>
          {chatPaused && (
            <>
              <p className="text-[11px] text-muted-foreground">Cambiá la duración de la pausa:</p>
              <div className="grid grid-cols-3 gap-1.5">
                {PAUSE_OPTIONS.map((opt) => {
                  const isSelected = selectedDuration === opt.minutes;
                  return (
                    <button
                      key={opt.label}
                      onClick={() => handleSetDuration(opt.minutes)}
                      disabled={pauseLoading}
                      className={cn(
                        "flex items-center justify-center gap-1 text-[10px] font-medium py-1.5 rounded-lg border transition-colors",
                        isSelected ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"
                      )}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5" />}
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </>
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
        <div className="flex items-center gap-2 shrink-0">
          <BotPauseButton settings={settings} save={save} />
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="h-7 px-2 gap-1.5 text-xs shrink-0">
            {disconnecting ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />}
            Desconectar
          </Button>
        </div>
      </div>
      <BotPauseBanner settings={settings} className="mx-4 mt-3 rounded-lg" />
      <div className="flex-1 min-h-0 flex">
        {ChatListColumn}
        {ChatColumn}
        {DetailsColumn}
      </div>

      {/* Crear la ficha de paciente sin salir del chat, ya con el nombre y el teléfono
          cargados. Antes la única forma era ir a la Agenda y retipear todo a mano. */}
      <PatientForm
        open={newPatientOpen}
        onClose={() => setNewPatientOpen(false)}
        defaults={activeConvo ? {
          first_name: contactName(activeConvo) === fmtPhone(activeConvo.phone) ? "" : contactName(activeConvo),
          phone: activeConvo.phone,
        } : undefined}
        onSaved={async () => { setNewPatientOpen(false); await load(); }}
      />
    </div>
  );
}

export default function Assistant() {
  const { settings, loading, reload, save } = usePracticeSettings();
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

  return <FullAssistant settings={settings} reloadSettings={reload} save={save} />;
}
