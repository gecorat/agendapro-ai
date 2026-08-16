import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, CalendarClock } from "lucide-react";
import { base44 } from "@/api/base44Client";

export default function RescheduleAppointment() {
  const { token } = useParams();
  const navigate = useNavigate();
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
        // Solo mandamos a reservar de nuevo si la cita vieja realmente se canceló.
        // Antes se navegaba apenas venía "handle" en la respuesta, sin chequear `resolved`,
        // así que si la cita ya estaba confirmada (bloqueada por diseño) el paciente igual
        // terminaba creando un turno nuevo mientras el viejo quedaba activo (duplicado).
        if (data?.resolved && data?.handle) {
          navigate(`/u/${data.handle}`, { replace: true });
          return;
        }
        if (data?.already_resolved) {
          setStatus(data.status || null);
          setState("blocked");
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
        {state === "blocked" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-5">
              <CalendarClock className="w-9 h-9 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">
              {status === "cancelled" ? "Esta cita ya está cancelada" : status === "completed" ? "Esta cita ya se realizó" : "No pudimos reagendar automáticamente"}
            </h1>
            <p className="text-slate-600">
              {status === "cancelled"
                ? "Esta cita ya había sido cancelada antes, no hay nada para reagendar."
                : "Contactate directamente con el consultorio para coordinar un nuevo horario."}
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