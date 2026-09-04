import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X as XIcon, Calendar, MessageCircle, Link2, Inbox } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { registerServiceWorker, subscribeToPush } from "@/lib/push-notifications";
import { loadReadState, saveBellLastSeen, getLocalBellLastSeen } from "@/lib/read-state";
import { argentinaYMD, formatArDateTime } from "@/lib/timezone";

const EXTERNAL_ORIGINS = ["whatsapp", "public_link"];

function originIcon(origin) {
  if (origin === "whatsapp") return MessageCircle;
  if (origin === "public_link") return Link2;
  return Calendar;
}

function originLabel(origin) {
  if (origin === "whatsapp") return "WhatsApp";
  if (origin === "public_link") return "Link público";
  return "Manual";
}

function StatusBadge({ status }) {
  if (status === "confirmed") {
    return (
      <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
        Confirmada
      </span>
    );
  }
  if (status === "cancelled") {
    return (
      <span className="inline-block mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
        Cancelada
      </span>
    );
  }
  return null;
}

function PendingList({ pending, onConfirm, onConfirmWhatsApp, onCancel, onOpenAppt, busyId }) {
  if (pending.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
        <Inbox className="w-8 h-8 text-muted-foreground/40" />
        <p className="text-sm text-muted-foreground">No tenés citas pendientes</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {pending.map((a) => {
        const Icon = originIcon(a.origin);
        const start = a.start_datetime ? new Date(a.start_datetime) : null;
        const isPending = a.status === "pending";
        // El ?date= con el que se abre la Agenda es un dia ARGENTINO: armandolo con
        // getFullYear/getMonth/getDate del navegador, tocar una cita de la noche desde otro
        // huso abria la agenda en el dia equivocado y la cita no aparecia.
        const dateStr = start ? argentinaYMD(start) : null;
        return (
          <div
            key={a.id}
            role="button"
            tabIndex={0}
            onClick={() => onOpenAppt(dateStr)}
            onKeyDown={(e) => { if ((e.key === "Enter" || e.key === " ") && dateStr) onOpenAppt(dateStr); }}
            className="rounded-lg border border-border p-3 bg-background hover:bg-accent/50 transition-colors cursor-pointer focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.patient_name || "Paciente"}</p>
                <p className="text-xs text-muted-foreground truncate">{a.service_name || "Consulta"}</p>
                {start && (
                  <p className="text-xs text-muted-foreground/80 mt-0.5 capitalize">
                    {formatArDateTime(start, { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                )}
                {isPending ? (
                  <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                    {originLabel(a.origin)}
                  </span>
                ) : (
                  <StatusBadge status={a.status} />
                )}
              </div>
            </div>
            {isPending && (
              <div className="flex items-center gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
                {a.origin === "whatsapp" ? (
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                    disabled={busyId === a.id}
                    onClick={() => onConfirmWhatsApp(a)}
                  >
                    <MessageCircle className="w-3 h-3" /> Confirmar por WhatsApp
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="h-7 px-2 text-xs bg-emerald-600 hover:bg-emerald-700"
                    disabled={busyId === a.id}
                    onClick={() => onConfirm(a.id)}
                  >
                    <Check className="w-3 h-3" /> Confirmar
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs"
                  disabled={busyId === a.id}
                  onClick={() => onCancel(a.id)}
                >
                  <XIcon className="w-3 h-3" /> Cancelar
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function NotificationsBell({ user }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);
  // El contador se calculaba SOLO a partir del estado de las citas, sin registrar en
  // ningún lado que el profesional ya había abierto la campanita — así que una reserva
  // externa ya confirmada (que no requiere ninguna acción suya) quedaba contada por 24hs
  // aunque la hubiera visto. Se guarda en el servidor (UserReadState) para que valga en
  // todos sus dispositivos, con el localStorage como caché para pintar bien al instante.
  const [lastSeenAt, setLastSeenAt] = useState(() => getLocalBellLastSeen());
  const [readStateRowId, setReadStateRowId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    loadReadState().then(({ bellLastSeen, rowId }) => {
      if (cancelled) return;
      setReadStateRowId(rowId);
      if (bellLastSeen) setLastSeenAt(bellLastSeen);
    });
    return () => { cancelled = true; };
  }, []);

  const markBellSeen = async () => {
    const now = new Date().toISOString();
    setLastSeenAt(now);
    const id = await saveBellLastSeen(readStateRowId, now);
    if (id && id !== readStateRowId) setReadStateRowId(id);
  };

  const loadPending = useCallback(async () => {
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Se pide por getScopedAppointments y no consultando la entidad directo. La RLS de
      // Appointment solo deja ver las filas donde el usuario es `created_by_id` o
      // `professional_id`, y para un profesional INVITADO ninguna de las dos cosa se cumple
      // (el `professional_id` de la cita es el del dueño del consultorio). Resultado: a los
      // invitados les llegaba el push pero abrían la campanita y estaba vacía. Esta función
      // resuelve el alcance del equipo y ya filtra al invitado a SUS propias citas.
      const res = await base44.functions.invoke("getScopedAppointments", {});
      const all = res?.data?.appointments || [];

      const pending = all
        .filter((a) => a.status === "pending")
        .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

      // El tope de 50 se mantiene a propósito: las consultas anteriores lo tenían, y sin él
      // un consultorio con mucho movimiento podría llenar la campanita de ruido.
      const recentResolved = all
        .filter(
          (a) =>
            (a.status === "confirmed" || a.status === "cancelled") &&
            a.updated_date &&
            new Date(a.updated_date) >= new Date(since)
        )
        .sort((a, b) => new Date(b.updated_date) - new Date(a.updated_date))
        .slice(0, 50);

      const merged = [...pending, ...recentResolved];
      // dedupe by id
      const seen = new Set();
      const deduped = merged.filter((a) => {
        if (seen.has(a.id)) return false;
        seen.add(a.id);
        return true;
      });
      // sort: pending first, then by start_datetime
      deduped.sort((a, b) => {
        if (a.status === "pending" && b.status !== "pending") return -1;
        if (a.status !== "pending" && b.status === "pending") return 1;
        return new Date(a.start_datetime) - new Date(b.start_datetime);
      });

      setItems(deduped);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadPending();
    const unsubscribe = base44.entities.Appointment.subscribe((event) => {
      // Aviso en vivo (pestaña abierta) tanto para reservas que quedan pendientes de
      // confirmar como para las que ya nacen confirmadas (planes Pro/Clinic) — antes solo
      // avisaba de las 'pending', así que con el auto-confirmado no saltaba ningún aviso.
      if (
        event.type === "create" &&
        EXTERNAL_ORIGINS.includes(event.data?.origin) &&
        (event.data?.status === "pending" || event.data?.status === "confirmed")
      ) {
        showBrowserNotification(event.data);
      }
      loadPending();
    });
    return unsubscribe;
  }, [loadPending]);

  // Registra el service worker siempre (no hace falta permiso para eso), y si el permiso de
  // notificaciones ya estaba concedido de antes (usuario recurrente), re-suscribe a push en
  // silencio — cubre el caso de que la suscripción del navegador haya expirado o de que se
  // haya sumado este dispositivo/navegador nuevo, sin que la persona tenga que volver a
  // tocar la campanita a propósito.
  useEffect(() => {
    registerServiceWorker().then(() => {
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        subscribeToPush();
      }
    });
  }, []);

  // Si tocaron una notificación con la app cerrada/en background, el service worker nos
  // manda a dónde navegar apenas la ventana recupera el foco.
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.serviceWorker) return;
    const handler = (event) => {
      if (event.data?.type === "NOTIFICATION_NAVIGATE" && event.data.url) {
        navigate(event.data.url);
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [navigate]);

  const showBrowserNotification = (appt) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const n = new Notification(
        appt.status === "confirmed" ? "Nueva reserva confirmada" : "Nueva cita pendiente de confirmar",
        {
          body: `${appt.patient_name || "Paciente"} — ${appt.service_name || "Consulta"}`,
          tag: appt.id,
        }
      );
      n.onclick = () => {
        window.focus();
        navigate("/agenda");
        setOpen(false);
        n.close();
      };
    } catch {
      /* ignore */
    }
  };

  const requestPermission = () => {
    if (typeof Notification === "undefined" || Notification.permission !== "default") return;
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        toast({ title: "Notificaciones activadas", description: "Te avisamos incluso con el teléfono bloqueado o la app cerrada." });
        subscribeToPush();
      }
    });
  };

  const handleConfirm = async (id) => {
    setBusyId(id);
    try {
      await base44.entities.Appointment.update(id, { status: "confirmed" });
      toast({ title: "Cita confirmada" });
      loadPending();
    } catch {
      toast({ title: "Error al confirmar", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleCancel = async (id) => {
    setBusyId(id);
    try {
      await base44.entities.Appointment.update(id, { status: "cancelled" });
      try {
        await base44.functions.invoke("syncAppointmentGoogle", { appointmentId: id });
      } catch { /* no romper el flujo si Google falla */ }
      try {
        await base44.functions.invoke("notifyPatientOfAppointmentChange", { appointmentId: id, changeType: "cancelled" });
      } catch { /* no romper el flujo si el aviso falla */ }
      toast({ title: "Cita cancelada" });
      loadPending();
    } catch {
      toast({ title: "Error al cancelar", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleConfirmWhatsApp = async (a) => {
    setBusyId(a.id);
    try {
      let phone = "";
      if (a.patient_id) {
        try {
          const p = await base44.entities.Patient.get(a.patient_id);
          phone = p?.phone || "";
        } catch { /* ignore */ }
      }
      const digits = (phone || "").replace(/\D/g, "");
      if (!digits) {
        toast({ title: "Sin teléfono", description: "El paciente no tiene teléfono cargado.", variant: "destructive" });
        return;
      }
      await base44.entities.Appointment.update(a.id, { status: "confirmed" });
      const start = a.start_datetime ? new Date(a.start_datetime) : null;
      const fecha = start
        ? formatArDateTime(start, { weekday: "long", day: "numeric", month: "long" })
        : "";
      const msg = `Hola ${a.patient_name || ""}, te confirmo tu cita de ${a.service_name || "consulta"} para el ${fecha}. ¡Te esperamos!`;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
      loadPending();
      toast({ title: "Cita confirmada" });
    } catch {
      toast({ title: "Error al confirmar", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleOpenAppt = (dateStr) => {
    setOpen(false);
    navigate(dateStr ? `/agenda?date=${dateStr}` : "/agenda");
  };

  // El contador rojo cuenta las citas que son NOVEDAD para el profesional: las pendientes
  // de confirmar (como siempre) y ADEMÁS las reservas externas (link público / WhatsApp)
  // que ya nacieron confirmadas en las últimas 24hs. Antes solo contaba las 'pending', así
  // que al auto-confirmar las reservas de planes Pro/Clinic la campanita se quedó siempre
  // en cero — confirmado en vivo: la cita aparecía al abrir el panel, pero sin globito que
  // avisara que había algo nuevo.
  //
  // Diferencia importante entre las dos: las 'pending' REQUIEREN una acción del profesional
  // (confirmarlas o cancelarlas), así que se siguen contando aunque ya haya abierto la
  // campanita — el globito solo baja cuando las resuelve de verdad. Las ya confirmadas son
  // solo un aviso (no hay nada que hacer con ellas), así que dejan de contarse apenas abre
  // el panel.
  const RECENT_MS = 24 * 60 * 60 * 1000;
  const parseCreated = (s) => new Date(`${s}${/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s) ? "" : "Z"}`);
  const isNewExternalConfirmed = (a) => {
    if (a.status !== "confirmed" || !EXTERNAL_ORIGINS.includes(a.origin) || !a.created_date) return false;
    const created = parseCreated(a.created_date);
    if (Date.now() - created.getTime() > RECENT_MS) return false;
    // Ya vista: se creó antes de la última vez que abrió la campanita.
    if (lastSeenAt && created <= new Date(lastSeenAt)) return false;
    return true;
  };
  const pendingCount = items.filter((a) => a.status === "pending" || isNewExternalConfirmed(a)).length;

  const BellButton = (
    <button
      onClick={requestPermission}
      className="relative p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
      aria-label="Citas pendientes"
    >
      <Bell className="w-5 h-5" />
      {pendingCount > 0 && (
        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {pendingCount > 9 ? "9+" : pendingCount}
        </span>
      )}
    </button>
  );

  const listProps = { pending: items, onConfirm: handleConfirm, onConfirmWhatsApp: handleConfirmWhatsApp, onCancel: handleCancel, onOpenAppt: handleOpenAppt, busyId };

  // Al abrir el panel (en cualquiera de las dos variantes, móvil o escritorio) marcamos
  // las novedades como vistas — es lo que hace que el globito baje.
  const handleOpenChange = (next) => {
    setOpen(next);
    if (next) markBellSeen();
  };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetTrigger asChild>{BellButton}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Citas {pendingCount > 0 && <span className="text-sm font-normal text-muted-foreground">({pendingCount} sin ver)</span>}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto mt-2">
            <PendingList {...listProps} />
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{BellButton}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center gap-2 px-1 pb-2 mb-1 border-b border-border">
          <Bell className="w-4 h-4" />
          <span className="text-sm font-semibold">Citas</span>
          {pendingCount > 0 && <span className="ml-auto text-xs text-muted-foreground">{pendingCount} sin ver</span>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <PendingList {...listProps} />
        </div>
      </PopoverContent>
    </Popover>
  );
}