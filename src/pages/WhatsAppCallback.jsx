import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";

export default function WhatsAppCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState("loading"); // loading | success | error
  const [message, setMessage] = useState("Verificando tu conexión de WhatsApp…");
  const attemptsRef = useRef(0);

  useEffect(() => {
    const tryConnect = async () => {
      try {
        const res = await base44.functions.invoke("connectWhatsAppCallback", {});
        const data = res.data || {};
        if (data.connected) {
          setStatus("success");
          setMessage(`¡Conectado! Tu número ${data.phone || ""} ya está activo.`);
          setTimeout(() => navigate("/asistente"), 1800);
          return;
        }
        if (data.pending && attemptsRef.current < 6) {
          attemptsRef.current += 1;
          setMessage("Estamos confirmando la conexión con WhatsApp…");
          setTimeout(tryConnect, 2000);
          return;
        }
        setStatus("error");
        setMessage(data.error || "No pudimos confirmar la conexión. Volvé a intentarlo desde Chats.");
      } catch (e) {
        setStatus("error");
        setMessage(e?.response?.data?.error || e?.message || "Ocurrió un error al verificar la conexión.");
      }
    };
    tryConnect();
  }, [navigate]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-background px-6 text-center">
      {status === "loading" && <Loader2 className="w-10 h-10 animate-spin text-emerald-600 mb-4" />}
      {status === "success" && <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-4" />}
      {status === "error" && <XCircle className="w-12 h-12 text-destructive mb-4" />}
      <p className="font-heading font-semibold text-lg">{message}</p>
      {status === "error" && (
        <button
          onClick={() => navigate("/asistente")}
          className="mt-4 text-sm font-medium text-primary underline underline-offset-4"
        >
          Volver a Chats
        </button>
      )}
    </div>
  );
}