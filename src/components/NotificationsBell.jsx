import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Check, X as XIcon, Calendar, MessageCircle, Link2, Inbox } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";

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

function PendingList({ pending, onConfirm, onConfirmWhatsApp, onCancel, onAgenda, busyId }) {
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
        return (
          <div key={a.id} className="rounded-lg border border-border p-3 bg-background">
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent">
                <Icon className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{a.patient_name || "Paciente"}</p>
                <p className="text-xs text-muted-foreground truncate">{a.service_name || "Consulta"}</p>
                {start && (
                  <p className="text-xs text-muted-foreground/80 mt-0.5 capitalize">
                    {start.toLocaleString("es-AR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </p>
                )}
                <span className="inline-block mt-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground/70">
                  {originLabel(a.origin)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 mt-2">
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
              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs ml-auto" onClick={onAgenda}>
                Ver en agenda
              </Button>
            </div>
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
  const [pending, setPending] = useState([]);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState(null);

  const loadPending = useCallback(async () => {
    try {
      const list = await base44.entities.Appointment.filter({ status: "pending" }, "start_datetime");
      setPending(list || []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadPending();
    const unsubscribe = base44.entities.Appointment.subscribe((event) => {
      if (
        event.type === "create" &&
        event.data?.status === "pending" &&
        EXTERNAL_ORIGINS.includes(event.data?.origin)
      ) {
        showBrowserNotification(event.data);
      }
      loadPending();
    });
    return unsubscribe;
  }, [loadPending]);

  const showBrowserNotification = (appt) => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    try {
      const n = new Notification("Nueva cita pendiente de confirmar", {
        body: `${appt.patient_name || "Paciente"} — ${appt.service_name || "Consulta"}`,
        tag: appt.id,
      });
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
        toast({ title: "Notificaciones activadas", description: "Te avisaremos cuando llegue una cita nueva." });
      }
    });
  };

  const handleConfirm = async (id) => {
    setBusyId(id);
    try {
      await base44.entities.Appointment.update(id, { status: "confirmed" });
      toast({ title: "Cita confirmada" });
      setPending((p) => p.filter((a) => a.id !== id));
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
      toast({ title: "Cita cancelada" });
      setPending((p) => p.filter((a) => a.id !== id));
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
        ? start.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
        : "";
      const msg = `Hola ${a.patient_name || ""}, te confirmo tu cita de ${a.service_name || "consulta"} para el ${fecha}. ¡Te esperamos!`;
      window.open(`https://wa.me/${digits}?text=${encodeURIComponent(msg)}`, "_blank");
      setPending((p) => p.filter((x) => x.id !== a.id));
      toast({ title: "Cita confirmada" });
    } catch {
      toast({ title: "Error al confirmar", variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const handleAgenda = () => {
    setOpen(false);
    navigate("/agenda");
  };

  const count = pending.length;

  const BellButton = (
    <button
      onClick={requestPermission}
      className="relative p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg hover:bg-accent transition-colors"
      aria-label="Citas pendientes"
    >
      <Bell className="w-5 h-5" />
      {count > 0 && (
        <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </button>
  );

  const listProps = { pending, onConfirm: handleConfirm, onConfirmWhatsApp: handleConfirmWhatsApp, onCancel: handleCancel, onAgenda: handleAgenda, busyId };

  if (isMobile) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{BellButton}</SheetTrigger>
        <SheetContent side="bottom" className="max-h-[80vh] flex flex-col">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              <Bell className="w-4 h-4" />
              Citas pendientes {count > 0 && <span className="text-sm font-normal text-muted-foreground">({count})</span>}
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
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{BellButton}</PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-3">
        <div className="flex items-center gap-2 px-1 pb-2 mb-1 border-b border-border">
          <Bell className="w-4 h-4" />
          <span className="text-sm font-semibold">Citas pendientes</span>
          {count > 0 && <span className="ml-auto text-xs text-muted-foreground">{count}</span>}
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          <PendingList {...listProps} />
        </div>
      </PopoverContent>
    </Popover>
  );
}