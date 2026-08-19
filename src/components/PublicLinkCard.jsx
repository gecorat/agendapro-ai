import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Link2, Check, ExternalLink, Copy, Share2 } from "lucide-react";

// Tarjeta del enlace público de reservas, usada en Home (panel principal), Configuración
// (Integraciones) y Perfil — un solo componente para que el estilo no se desincronice
// entre pantallas (ya pasó una vez).
export default function PublicLinkCard({ url, practiceName, brand = "#0000ff", variant = "card" }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  if (!url) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: practiceName || "Reservá tu turno", text: "Reservá tu turno online:", url });
      } catch { /* usuario canceló */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* noop */ }
  };

  if (variant === "bar") {
    // Versión compacta de una fila (Home, o dentro de otro formulario).
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5 rounded-2xl border" style={{ borderColor: `${brand}33`, background: `${brand}0d` }}>
        <div className="flex items-center gap-2.5 flex-1 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${brand}22` }}>
            <Link2 className="w-4 h-4" style={{ color: brand }} />
          </div>
          <span className="text-xs font-mono truncate" style={{ color: brand }}>{url}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={copy} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-card hover:bg-muted transition-colors" style={{ borderColor: `${brand}44`, color: brand }}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copiado" : "Copiar"}
          </button>
          <button type="button" onClick={share} className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border bg-card hover:bg-muted transition-colors" style={{ borderColor: `${brand}44`, color: brand }}>
            <Share2 className="w-3.5 h-3.5" /> {shared ? "Copiado" : "Compartir"}
          </button>
          <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white transition-colors" style={{ backgroundColor: brand }}>
            <ExternalLink className="w-3.5 h-3.5" /> Ver página
          </a>
        </div>
      </div>
    );
  }

  // Versión tarjeta completa (con header de color), para Configuración → Integraciones.
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card">
      <div className="h-16 relative" style={{ background: `linear-gradient(135deg, ${brand}, ${brand}99)` }}>
        <div className="absolute -top-6 -right-6 w-28 h-28 rounded-full bg-white/10 blur-xl" />
        <div className="absolute -bottom-8 left-10 w-20 h-20 rounded-full bg-white/10 blur-lg" />
      </div>
      <div className="px-4 pb-4 -mt-7">
        <div className="w-12 h-12 rounded-xl bg-card shadow-md border border-border flex items-center justify-center mb-2.5">
          <Link2 className="w-5 h-5" style={{ color: brand }} />
        </div>
        <p className="font-heading font-semibold">Tu página de reservas</p>
        <p className="text-sm text-muted-foreground mb-3">Compartila con tus pacientes. Reservan solos, sin escribirte.</p>
        <div className="bg-muted/60 rounded-xl px-3 py-2.5 mb-3 overflow-x-auto">
          <p className="font-mono text-xs whitespace-nowrap text-foreground/80">{url}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Button type="button" variant="outline" size="sm" onClick={copy} className="rounded-xl gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copiado" : "Copiar"}
          </Button>
          <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" asChild>
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" /> Ver
            </a>
          </Button>
          <Button type="button" size="sm" onClick={share} className="rounded-xl gap-1.5 text-white" style={{ backgroundColor: brand }}>
            <Share2 className="w-3.5 h-3.5" /> {shared ? "Copiado" : "Compartir"}
          </Button>
        </div>
      </div>
    </div>
  );
}
