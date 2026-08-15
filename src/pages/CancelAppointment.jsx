import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, XCircle } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function CancelAppointment() {
  const { token } = useParams();
  const [state, setState] = useState("loading");
  const [status, setStatus] = useState(null);

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    (async () => {
      try {
        const res = await base44.functions.invoke("cancelAppointmentByToken", { token });
        const data = res.data;
        if (data?.already_resolved) {
          setStatus(data.status || null);
          setState("already");
        } else if (data?.resolved) {
          setState("success");
        } else {
          setState("error");
        }
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-slate-400 animate-spin mb-4" />
            <p className="text-slate-600 font-medium">Procesando…</p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-5">
              <XCircle className="w-9 h-9 text-slate-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Cita cancelada</h1>
            <p className="text-slate-600">Tu cita fue cancelada y se le avisó al consultorio.</p>
          </>
        )}
        {state === "already" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-9 h-9 text-slate-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {status === "confirmed" ? "Esta cita ya está confirmada" : status === "cancelled" ? "Esta cita ya estaba cancelada" : status === "completed" ? "Esta cita ya se realizó" : "No pudimos cancelarla automáticamente"}
            </h1>
            <p className="text-slate-600">
              {status === "confirmed"
                ? "El consultorio ya confirmó este turno, así que no se puede cancelar solo desde este link. Contactate directamente con el consultorio para cancelarlo."
                : status === "cancelled"
                ? "Esta cita ya había sido cancelada antes."
                : "Contactate directamente con el consultorio."}
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-5">
              <AlertCircle className="w-9 h-9 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">No pudimos procesar</h1>
            <p className="text-slate-600">El enlace no es válido o expiró.</p>
          </>
        )}
      </div>
    </div>
  );
}