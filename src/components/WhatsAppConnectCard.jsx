import React, { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, XCircle, Loader2, LogOut, QrCode, ShieldCheck, Plug, Smartphone, RefreshCcw } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import PlanGate from "@/components/PlanGate";

// Cada cuánto se pide un QR nuevo mientras el actual sigue sin escanearse (Evolution API
// no nos manda un TTL explícito, así que renovamos nosotros del lado del cliente para que
// nunca se quede mostrando un código vencido sin que el profesional se dé cuenta).
const QR_REFRESH_MS = 55000;

export default function WhatsAppConnectCard() {
  const { settings, reload } = usePracticeSettings();
  const [connectingQR, setConnectingQR] = useState(false);
  const [connectingOfficial, setConnectingOfficial] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");
  const [qrCode, setQrCode] = useState(null);
  const [qrStatus, setQrStatus] = useState("");
  const pollRef = useRef(null);
  const refreshRef = useRef(null);

  const planStatus = getPlanStatus(settings);
  const connected = !!settings?.whatsapp_connected;
  const connectionType = settings?.whatsapp_connection_type;
  const connectedPhone = settings?.whatsapp_phone_number || settings?.zernio_phone;

  useEffect(() => () => { clearInterval(pollRef.current); clearInterval(refreshRef.current); }, []);

  // Mientras haya un QR mostrado y todavía no se escaneó, lo renovamos solos cada
  // QR_REFRESH_MS — así el texto "se renueva automáticamente" es verdad y nunca queda un
  // código vencido esperando a que alguien lo note.
  useEffect(() => {
    clearInterval(refreshRef.current);
    if (qrCode && qrStatus !== "connected") {
      refreshRef.current = setInterval(() => {
        handleConnectQR({ silent: true });
      }, QR_REFRESH_MS);
    }
    return () => clearInterval(refreshRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrCode, qrStatus]);

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
          clearInterval(refreshRef.current);
          await reload();
        }
      } catch {
        // seguimos intentando en el próximo tick
      }
    }, 2500);
  };

  const handleConnectQR = async ({ silent = false } = {}) => {
    setError("");
    if (!silent) setConnectingQR(true);
    try {
      const res = await base44.functions.invoke("connectWhatsAppQR", {});
      if (res?.data?.error) {
        if (!silent) setError(res.data.message || res.data.error);
        return;
      }
      if (res?.data?.connected) {
        // Ya estaba conectada de un intento anterior que el polling no había detectado.
        await reload();
        return;
      }
      setQrCode(res?.data?.qrCode || null);
      setQrStatus("need_scan");
      startPolling();
    } catch (e) {
      if (!silent) setError(e?.response?.data?.message || e?.response?.data?.error || "No se pudo iniciar la conexión por QR");
    } finally {
      if (!silent) setConnectingQR(false);
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
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${connected ? "bg-emerald-500/15" : "bg-primary/10"}`}>
          {connected ? <MessageCircle className="w-5 h-5 text-emerald-600" /> : <Plug className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1">
          <p className="font-medium">Conexión</p>
          <p className="text-sm text-muted-foreground">
            {connected ? "Asistente de reservas y recordatorios por WhatsApp" : "Escaneá el QR desde el teléfono que quedará conectado."}
          </p>
        </div>
        {connected ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium shrink-0">
            <CheckCircle2 className="w-4 h-4" /> Conectado
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground shrink-0">
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
        <div className="space-y-3">
          <div className="rounded-2xl border border-border p-4">
            <div className="grid sm:grid-cols-[auto_1fr] gap-4 items-center">
              {/* Recuadro del QR: mismo tamaño en los 3 estados (bot\u00f3n / cargando / QR real),
                  as\u00ed nada salta de tama\u00f1o al pasar de uno a otro. */}
              <div className="w-full sm:w-[220px] h-[220px] shrink-0 mx-auto">
                {qrCode ? (
                  <div className="w-full h-full flex items-center justify-center p-3 bg-white rounded-xl border border-border">
                    {qrCode.startsWith("data:image") ? (
                      <img src={qrCode} alt="Código QR de WhatsApp" className="w-full h-full object-contain" />
                    ) : (
                      <QRCodeSVG value={qrCode} size={190} />
                    )}
                  </div>
                ) : connectingQR ? (
                  <div className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-accent/30">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs text-muted-foreground">Generando código…</p>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleConnectQR()}
                    className="w-full h-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 hover:border-primary/60 transition-colors text-center px-3"
                  >
                    <QrCode className="w-7 h-7 text-primary" />
                    <span className="text-sm font-semibold text-primary leading-tight">Conectar con<br />código QR</span>
                  </button>
                )}
              </div>

              <div className="space-y-2 text-center sm:text-left">
                <p className="text-sm font-semibold flex items-center justify-center sm:justify-start gap-1.5">
                  <Smartphone className="w-4 h-4 text-primary" /> Escaneá desde el teléfono
                </p>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Abrí WhatsApp.</li>
                  <li>Andá a <span className="font-medium text-foreground">Dispositivos vinculados</span>.</li>
                  <li>Elegí <span className="font-medium text-foreground">Vincular un dispositivo</span> y escaneá este código.</li>
                </ol>
                {qrCode && (
                  <p className="text-xs text-muted-foreground pt-1">
                    El código se renueva solo cada un rato mientras no lo escanees. No lo compartas.
                  </p>
                )}
              </div>
            </div>

            {!qrCode && !connectingQR && (
              <p className="text-xs text-muted-foreground text-center sm:text-left mt-3">
                Tocá el recuadro para generar el código.
              </p>
            )}
            {qrCode && (
              <button
                type="button"
                onClick={() => handleConnectQR()}
                disabled={connectingQR}
                className="mt-3 w-full sm:w-auto text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
              >
                {connectingQR ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                ¿No lo pudiste escanear? Generar uno nuevo
              </button>
            )}
          </div>

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
    </Card>
  );
}
