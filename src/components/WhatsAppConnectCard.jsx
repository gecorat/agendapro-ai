import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MessageCircle, CheckCircle2, XCircle, Loader2, LogOut } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import PlanGate from "@/components/PlanGate";

export default function WhatsAppConnectCard() {
  const { settings, reload } = usePracticeSettings();
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [error, setError] = useState("");

  const planStatus = getPlanStatus(settings);
  const connected = settings?.whatsapp_connected && !!settings?.zernio_account_id;

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

  const handleConnect = async () => {
    setError("");
    setConnecting(true);
    try {
      const res = await base44.functions.invoke("connectWhatsAppStart", {});
      const authUrl = res.data?.authUrl;
      if (!authUrl) {
        setError(res.data?.error || "No se pudo iniciar la conexión");
        setConnecting(false);
        return;
      }
      window.location.href = authUrl;
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || "No se pudo iniciar la conexión");
      setConnecting(false);
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
          <p className="text-sm font-medium text-emerald-700">{settings?.zernio_phone || "Número conectado"}</p>
          <Button variant="outline" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="gap-1.5">
            {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
            Desconectar
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">
            Conectá tu número de WhatsApp Business en un par de clics: se abre Meta, verificás tu número y la asistente empieza a atender a tus pacientes.
          </p>
          <Button onClick={handleConnect} disabled={connecting} className="w-full gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white">
            {connecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
            Conectar WhatsApp
          </Button>
        </div>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </Card>
  );
}