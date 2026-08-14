import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, CalendarClock } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function RescheduleAppointment() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState("loading");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    (async () => {
      try {
        const res = await base44.functions.invoke("cancelAppointmentByToken", { token });
        const data = res.data;
        const handle = data?.handle;
        if (handle) {
          navigate(`/u/${handle}`, { replace: true });
          return;
        }
        // Si no hay handle, mostrar estado según resultado
        if (data?.already_resolved || data?.resolved) {
          setState("nohandle");
        } else {
          setState("error");
        }
      } catch {
        setState("error");
      }
    })();
  }, [token, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-slate-400 animate-spin mb-4" />
            <p className="text-slate-600 font-medium">Te estamos llevando a la agenda…</p>
          </>
        )}
        {state === "nohandle" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
              <CalendarClock className="w-9 h-9 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Cita cancelada</h1>
            <p className="text-slate-600">Tu cita anterior fue cancelada. Contactá al consultorio para reservar un nuevo horario.</p>
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