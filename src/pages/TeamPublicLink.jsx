import React, { useState } from "react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { Button } from "@/components/ui/button";
import { Copy, Share2, ExternalLink, Check, Link as LinkIcon } from "lucide-react";
import GoogleCalendarConnectCard from "@/components/GoogleCalendarConnectCard";

// Vista de SOLO lectura del enlace de reservas del consultorio, para profesionales
// invitados (plan Clinic). No editan nada acá — la personalización de la página es del
// dueño de la cuenta. Solo copian, comparten o la abren para mostrársela a un paciente.
export default function TeamPublicLink() {
  const { settings, loading } = usePracticeSettings();
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" /></div>;
  }

  const cleanHandle = (settings?.handle || "").trim().replace(/^@/, "");
  const link = cleanHandle ? (typeof window !== "undefined" ? window.location.origin : "") + `/u/${cleanHandle}` : "";

  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* noop */ }
  };
  const shareLink = async () => {
    if (!link) return;
    if (navigator.share) { try { await navigator.share({ title: settings?.practice_name, url: link }); } catch { /* cancelado */ } return; }
    try { await navigator.clipboard.writeText(link); setShared(true); setTimeout(() => setShared(false), 2000); } catch { /* noop */ }
  };

  return (
    <div className="p-4 md:p-6 max-w-lg mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-heading font-semibold">Enlace del consultorio</h1>
        <p className="text-sm text-muted-foreground mt-1">Compartilo con tus pacientes para que reserven directamente.</p>
      </div>

      {!cleanHandle ? (
        <div className="rounded-2xl border border-border p-6 text-center">
          <LinkIcon className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">El consultorio todavía no configuró su enlace público.</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">{settings?.practice_name}</p>
            <p className="text-sm font-mono bg-muted rounded-lg px-3 py-2 break-all">{link}</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={copyLink} variant="outline" className="flex-1 gap-1.5">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />} {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button onClick={shareLink} variant="outline" className="flex-1 gap-1.5">
              <Share2 className="w-4 h-4" /> {shared ? "Copiado" : "Compartir"}
            </Button>
            <Button asChild className="flex-1 gap-1.5">
              <a href={link} target="_blank" rel="noopener noreferrer"><ExternalLink className="w-4 h-4" /> Ver página</a>
            </Button>
          </div>
        </div>
      )}

      <div className="pt-2">
        <h2 className="font-heading font-semibold text-sm mb-2">Tu calendario personal</h2>
        {/* Oculto temporalmente hasta terminar la verificación de Google Cloud (ver Settings.jsx) */}
        {/* <GoogleCalendarConnectCard /> */}
      </div>
    </div>
  );
}
