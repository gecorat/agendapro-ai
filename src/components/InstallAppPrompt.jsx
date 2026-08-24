import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Download, Share, PlusSquare, X } from "lucide-react";

// Recordamos el "ahora no" para no volver a insistir en este dispositivo — se guarda por
// navegador/dispositivo, no por cuenta (localStorage), que es justamente lo que importa acá
// (cada profesional instala desde SU propio teléfono).
const DISMISS_KEY = "agendapro_install_prompt_dismissed";

function isStandalone() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function isIOS() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
}

// Invita a instalar Kame Agenda como app en el teléfono (Add to Home Screen / PWA).
// - Android/Chrome/Edge: dispara el prompt nativo del navegador (evento beforeinstallprompt).
// - iOS/Safari: ese evento no existe, así que mostramos el paso a paso manual (Compartir →
//   Agregar a pantalla de inicio), que es la única forma de instalarla ahí.
// No se muestra si ya está instalada, si el navegador no ofrece instalación, o si el
// profesional ya la descartó antes en este dispositivo.
export default function InstallAppPrompt({ className = "" }) {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [dismissed, setDismissed] = useState(true);
  const [installed, setInstalled] = useState(true);
  const [showIOSHelp, setShowIOSHelp] = useState(false);

  useEffect(() => {
    setDismissed(typeof window !== "undefined" && localStorage.getItem(DISMISS_KEY) === "true");
    setInstalled(isStandalone());
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const ios = isIOS();
  if (installed || dismissed) return null;
  if (!deferredPrompt && !ios) return null; // nada instalable para ofrecer en este navegador

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  const handleInstall = async () => {
    if (ios) {
      setShowIOSHelp((v) => !v);
      return;
    }
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    try {
      await deferredPrompt.userChoice;
    } finally {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className={`relative rounded-xl border border-primary/20 bg-primary/5 p-3 pr-8 flex items-start gap-3 ${className}`}>
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-primary/10 transition-colors"
        aria-label="Cerrar"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
        <Download className="w-4 h-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Instalá la app en tu teléfono</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          Se agrega un ícono a tu pantalla de inicio, como una app — tenés todo a mano y las notificaciones llegan más rápido.
        </p>
        {showIOSHelp && (
          <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
            Tocá <Share className="w-3.5 h-3.5 inline -mt-0.5" /> <span className="font-medium text-foreground">Compartir</span>, después{" "}
            <PlusSquare className="w-3.5 h-3.5 inline -mt-0.5" /> <span className="font-medium text-foreground">Agregar a pantalla de inicio</span>.
          </p>
        )}
        <div className="mt-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5" onClick={handleInstall}>
            <Download className="w-3.5 h-3.5" /> {ios ? "Cómo instalarla" : "Instalar app"}
          </Button>
        </div>
      </div>
    </div>
  );
}
