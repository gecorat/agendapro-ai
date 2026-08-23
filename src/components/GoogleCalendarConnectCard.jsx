import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Calendar, CheckCircle2, Loader2, XCircle, RefreshCw } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { useToast } from "@/components/ui/use-toast";

// Cada persona conecta SU PROPIO Google Calendar: el dueño de la cuenta (o un co-admin,
// que en este punto actúa como si fuera el dueño) usa el de PracticeSettings; un
// profesional invitado normal usa el suyo propio (Professional.google_*). El backend ya
// sabe distinguir quién es quién según la sesión, así que este componente funciona igual
// en ambos casos sin necesitar props especiales.
export default function GoogleCalendarConnectCard() {
  const { toast } = useToast();
  const { settings, professional, reload } = usePracticeSettings();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const connected = professional ? !!professional.google_calendar_connected : !!settings?.google_calendar_connected;
  const email = professional ? professional.google_calendar_email : settings?.google_calendar_email;

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("googleCalendarAuthUrl", { origin: window.location.origin });
      if (res?.data?.url) {
        window.location.href = res.data.url;
      } else {
        throw new Error(res?.data?.error || "No se pudo generar el enlace de conexión");
      }
    } catch (err) {
      toast({ title: "Error", description: err?.response?.data?.error || err.message, variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Desconectar Google Calendar? Dejás de sincronizar citas nuevas — las que ya se crearon en tu Google Calendar quedan como estaban.")) return;
    setDisconnecting(true);
    try {
      await base44.functions.invoke("googleCalendarDisconnect", {});
      toast({ title: "Google Calendar desconectado" });
      await reload();
    } catch (err) {
      toast({ title: "Error", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Calendar className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="min-w-0">
          <p className="font-medium">Google Calendar</p>
          <p className="text-sm text-muted-foreground truncate">
            {connected
              ? `Sincronizado con ${email || "tu cuenta de Google"} — tus citas se cargan ahí automáticamente, y un evento personal tuyo bloquea la reserva.`
              : "Cada cita se carga automáticamente en tu Google Calendar, y tus eventos personales bloquean la reserva."}
          </p>
        </div>
      </div>
      {connected ? (
        <div className="flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Conectado
          </span>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />} Desconectar
          </Button>
        </div>
      ) : (
        <Button size="sm" onClick={handleConnect} disabled={connecting} className="gap-1.5 shrink-0">
          {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Conectar
        </Button>
      )}
    </div>
  );
}
