import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { MessageCircle, CheckCircle2, XCircle, Loader2, LogOut, QrCode, ShieldCheck } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import PlanGate from "@/components/PlanGate";

export default function WhatsAppConnectCard() {
  const { settings, reload } = usePracticeSettings();
  const [connectingQR, setConnectingQR] = useState(false);
  const [connectingOfficial, setConnectingOfficial] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [qrCode, setQrCode] = useState(null);
  const [qrStatus, setQrStatus] = useState("");
  const pollRef = useRef(null);

  const planStatus = getPlanStatus(settings);
  const connected = !!settings?.whatsapp_connected;
  const connectionType = settings?.whatsapp_connection_type;
  const connectedPhone = settings?.whatsapp_phone_number || settings?.zernio_phone;

  useEffect(() => () => clearInterval(pollRef.current), []);

  if (!settings) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-muted-foreground animate-spin" />
          </div>
          <div>
            <p className="font-medium">WhatsApp</p>
            <p className="text-sm text-muted-foreground">Cargando…</p>
          </div>
        </div>
      </Card>
    );
  }

  if (!planStatus.hasPaidPlan) {
    return (
      <Card className="p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <div>
            <p className="font-medium">WhatsApp</p>
            <p className="text-sm text-muted-foreground">Asistente de reservas y recordatorios</p>
          </div>
        </div>
        <PlanGate
          feature="Bot de WhatsApp"
          requiredPlan="pro"
          description="El bot responde, agenda y recuerda citas a tus pacientes por WhatsApp. Disponible desde el plan Pro."
        />
      </Card>
    );
  }

  const startPolling = () => {
    clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const res = await base44.functions.invoke("getWhatsAppQRStatus", {});
        const status = res?.data?.status;
        setQrStatus(status || "");
        if (res?.data?.connected) {
          clearInterval(pollRef.current);
          setQrOpen(false);
          await reload();
        }
      } catch {
        // seguimos intentando en el próximo tick
      }
    }, 2500);
  };

  const handleConnectQR = async () => {
    setError("");
    setConnectingQR(true);
    try {
      const res = await base44.functions.invoke("connectWhatsAppQR", {});
      if (res?.data?.error) {
        setError(res.data.message || res.data.error);
        return;
      }
      if (res?.data?.connected) {
        // Ya estaba conectada de un intento anterior que el polling no había detectado.
        await reload();
        return;
      }
      setQrCode(res?.data?.qrCode || null);
      setQrStatus("need_scan");
      setQrOpen(true);
      startPolling();
    } catch (e) {
      setError(e?.response?.data?.message || e?.response?.data?.error || "No se pudo iniciar la conexión por QR");
    } finally {
      setConnectingQR(false);
    }
  };

  const handleConnectOfficial = async () => {
    setError("");
    setConnectingOfficial(true);
    try {
      const res = await base44.functions.invoke("connectWhatsAppStart", {});
      const authUrl = res.data?.authUrl;
      if (!authUrl) {
        setError(res.data?.error || "No se pudo iniciar la conexión");
        setConnectingOfficial(false);
        return;
      }
      window.location.href = authUrl;
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "No se pudo iniciar la conexión");
      setConnectingOfficial(false);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("¿Desconectar WhatsApp? La asistente dejará de responder a tus pacientes hasta que reconectes.")) return;
    setDisconnecting(true);
    setError("");
    try {
      await base44.functions.invoke("disconnectWhatsApp", {});
      await reload();
    } catch (e) {
      setError("No se pudo desconectar. Intentá de nuevo.");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? "bg-emerald-500/15" : "bg-accent"}`}>
          <MessageCircle className={`w-5 h-5 ${connected ? "text-emerald-600" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1">
          <p className="font-medium">WhatsApp</p>
          <p className="text-sm text-muted-foreground">Asistente de reservas y recordatorios por WhatsApp</p>
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4" /> Conectado
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <XCircle className="w-4 h-4" /> Sin conectar
          </span>
        )}
      </div>

      {connected ? (
        <div className="flex items-center justify-between rounded-lg bg-emerald-500/10 px-3 py-2.5">
          <div>
            <p className="text-sm font-medium text-emerald-700">{connectedPhone || "Número conectado"}</p>
            <p className="text-xs text-emerald-600/80">{connectionType === "qr" ? "QR instantáneo" : "API oficial de Meta"}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="gap-1.5">
            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-2.5">
          <p className="text-xs text-muted-foreground">
            Escaneá un código QR con tu WhatsApp y la asistente empieza a atender a tus pacientes al instante.
          </p>
          <Button onClick={handleConnectQR} disabled={connectingQR} className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            {connectingQR ? <Loader2 className="w-4 h-4 animate-spin" /> : <QrCode className="w-4 h-4" />}
            Conectar con QR (recomendado)
          </Button>
          <button
            type="button"
            onClick={handleConnectOfficial}
            disabled={connectingOfficial}
            className="w-full text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 flex items-center justify-center gap-1"
          >
            {connectingOfficial ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
            Preferís usar la API oficial de Meta en vez del QR
          </button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <Dialog open={qrOpen} onOpenChange={(open) => { setQrOpen(open); if (!open) clearInterval(pollRef.current); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Escaneá para conectar tu WhatsApp</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {qrCode ? (
              <div className="p-3 bg-white rounded-xl border border-border">
                <QRCodeSVG value={qrCode} size={220} />
              </div>
            ) : (
              <div className="w-[220px] h-[220px] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
              </div>
            )}
            <div className="text-center space-y-1">
              <p className="text-sm font-medium">
                {qrStatus === "connected" ? "¡Conectado!" : "Esperando que escanees…"}
              </p>
              <p className="text-xs text-muted-foreground">
                WhatsApp → Configuración → Dispositivos vinculados → Vincular un dispositivo
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
