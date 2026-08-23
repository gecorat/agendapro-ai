import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

// Google redirige acá después de que la persona autoriza (o cancela) el acceso a su
// Calendar. Toma el "code" y el "state" de la URL y le pide al backend que los canjee
// por los tokens reales.
export default function GoogleCalendarCallback() {
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const state = params.get("state");
      const error = params.get("error");

      if (error) {
        setStatus("error");
        setMessage(error === "access_denied" ? "Cancelaste la conexión con Google." : "Google rechazó la conexión.");
        return;
      }
      if (!code || !state) {
        setStatus("error");
        setMessage("Faltan datos en la respuesta de Google.");
        return;
      }
      try {
        const res = await base44.functions.invoke("googleCalendarCallback", {
          code,
          state,
          origin: window.location.origin,
        });
        setStatus("success");
        setMessage(res?.data?.email ? `Conectado con ${res.data.email}` : "Conectado correctamente");
        setTimeout(() => { window.location.href = "/configuracion"; }, 2000);
      } catch (err) {
        setStatus("error");
        setMessage(err?.response?.data?.error || err.message || "No se pudo completar la conexión.");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-sm w-full bg-white rounded-2xl border border-border p-6 text-center space-y-3">
        {status === "loading" && (
          <>
            <Loader2 className="w-10 h-10 text-primary mx-auto animate-spin" />
            <p className="font-heading font-semibold">Conectando con Google Calendar...</p>
          </>
        )}
        {status === "success" && (
          <>
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <p className="font-heading font-semibold">¡Listo!</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <p className="text-xs text-muted-foreground">Te llevamos de vuelta...</p>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="w-10 h-10 text-destructive mx-auto" />
            <p className="font-heading font-semibold">No se pudo conectar</p>
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button className="mt-2" onClick={() => { window.location.href = "/configuracion"; }}>Volver a Ajustes</Button>
          </>
        )}
      </div>
    </div>
  );
}
