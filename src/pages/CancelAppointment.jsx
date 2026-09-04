import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, XCircle, CalendarClock, ShieldQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import PoweredByKame from "@/components/PoweredByKame";
import { formatArDateTime } from "@/lib/timezone";

// Antes este link cancelaba el turno apenas se abría — si alguien lo tocaba por error
// (o dudaba), la cita ya estaba cancelada sin vuelta atrás. Ahora primero mostramos los
// datos de la cita y pedimos confirmación explícita, con la opción de reagendar en su lugar.
export default function CancelAppointment() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [state, setState] = useState("loading");
  const [status, setStatus] = useState(null);
  const [appt, setAppt] = useState(null);
  const [canceling, setCanceling] = useState(false);

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    (async () => {
      try {
        const res = await base44.functions.invoke("cancelAppointmentByToken", { token, confirm: false });
        const data = res.data;
        if (!data?.can_cancel) {
          setStatus(data?.status || null);
          setState("already");
        } else {
          setAppt(data);
          setState("confirm");
        }
      } catch {
        setState("error");
      }
    })();
  }, [token]);

  async function handleCancel() {
    setCanceling(true);
    try {
      const res = await base44.functions.invoke("cancelAppointmentByToken", { token, confirm: true });
      const data = res.data;
      if (data?.resolved) {
        setState("success");
      } else if (data?.already_resolved) {
        setStatus(data.status || null);
        setState("already");
      } else {
        setState("error");
      }
    } catch {
      setState("error");
    } finally {
      setCanceling(false);
    }
  }

  const dateStr = appt?.start_datetime
    ? formatArDateTime(appt.start_datetime, { weekday: "long", day: "numeric", month: "long" })
    : "";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-6">
      <div className="max-w-md w-full text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 mx-auto text-slate-400 animate-spin mb-4" />
            <p className="text-slate-600 font-medium">Cargando tu turno…</p>
          </>
        )}

        {state === "confirm" && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-left">
            <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center mb-4">
              <ShieldQuestion className="w-7 h-7 text-amber-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-1 text-center">¿Cancelar este turno?</h1>
            <p className="text-slate-500 text-sm text-center mb-5">Confirmá para cancelarlo. Si tocaste el botón por error, podés cerrar esta página y tu turno sigue en pie.</p>

            <div className="bg-slate-50 rounded-xl p-4 mb-5 space-y-1">
              <p className="font-semibold text-slate-900">{appt?.service_name || "Consulta"}</p>
              <p className="text-slate-600 text-sm capitalize">{dateStr}</p>
              {appt?.patient_name && <p className="text-slate-500 text-xs">{appt.patient_name}</p>}
            </div>

            <div className="space-y-2">
              <Button variant="destructive" className="w-full" onClick={handleCancel} disabled={canceling}>
                {canceling && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Sí, cancelar mi turno
              </Button>
              {appt?.handle && (
                <Button variant="outline" className="w-full" onClick={() => navigate(`/reschedule/${token}`)} disabled={canceling}>
                  <CalendarClock className="w-4 h-4 mr-2" /> Prefiero reagendar
                </Button>
              )}
            </div>
          </div>
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
              {status === "cancelled" ? "Esta cita ya estaba cancelada" : status === "completed" ? "Esta cita ya se realizó" : "No pudimos cancelarla automáticamente"}
            </h1>
            <p className="text-slate-600">
              {status === "cancelled"
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

        <PoweredByKame utm="cancel_page" className="mt-6" />
      </div>
    </div>
  );
}
