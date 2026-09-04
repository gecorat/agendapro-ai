import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Loader2, AlertCircle, CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import PoweredByKame from "@/components/PoweredByKame";

function formatWhen(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("es-AR", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
  } catch {
    return "";
  }
}

export default function RescheduleAppointment() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState("loading");
  const [status, setStatus] = useState(null);
  const [appt, setAppt] = useState(null);
  const [working, setWorking] = useState(false);

  // Paso 1: SOLO consultamos los datos de la cita (confirm: false). Antes esta pantalla
  // cancelaba el turno al instante, sin preguntar nada, y recién después llevaba al
  // paciente a elegir uno nuevo — si cerraba la pestaña o no encontraba horario que le
  // sirviera, se quedaba sin turno sin haber confirmado nada (y al profesional le llegaba
  // un aviso de "cancelada por el paciente" que no era lo que había querido hacer).
  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    (async () => {
      try {
        const res = await base44.functions.invoke("cancelAppointmentByToken", { token, confirm: false });
        const data = res.data;
        if (!data?.preview) {
          setState("error");
          return;
        }
        if (!data.can_cancel) {
          setStatus(data.status || null);
          setState("blocked");
          return;
        }
        setAppt(data);
        setState("confirm");
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  // Paso 2: recién acá, con el clic explícito del paciente, liberamos el turno viejo y lo
  // mandamos a la agenda pública a elegir el nuevo.
  const handleConfirm = async () => {
    setWorking(true);
    try {
      // reason: "reschedule" — el turno se libera igual, pero el aviso que le llega al
      // profesional dice que el paciente esta REAGENDANDO, no que cancelo y se fue.
      const res = await base44.functions.invoke("cancelAppointmentByToken", { token, confirm: true, reason: "reschedule" });
      const data = res.data;
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
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-slate-400 animate-spin mb-4" />
            <p className="text-slate-600 font-medium">Buscando tu cita…</p>
          </>
        )}

        {state === "confirm" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-5">
              <CalendarClock className="w-9 h-9 text-amber-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">¿Querés reagendar esta cita?</h1>
            <div className="rounded-xl border border-slate-200 bg-white p-4 my-5 text-left">
              <p className="font-medium text-slate-900">{appt?.service_name || "Consulta"}</p>
              <p className="text-sm text-slate-600 capitalize mt-0.5">{formatWhen(appt?.start_datetime)}</p>
            </div>
            <p className="text-slate-600 text-sm mb-5">
              Vamos a liberar este horario y te llevamos a la agenda para que elijas uno nuevo.
              Si cerrás la página sin elegir otro, vas a quedar sin turno.
            </p>
            <Button className="w-full" onClick={handleConfirm} disabled={working}>
              {working ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Sí, elegir otro horario
            </Button>
            <p className="text-xs text-slate-500 mt-3">Si no querés cambiar nada, podés cerrar esta página: tu cita queda como está.</p>
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

        <PoweredByKame utm="reschedule_page" className="mt-6" />
      </div>
    </div>
  );
}
