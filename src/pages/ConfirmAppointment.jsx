import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Loader2, AlertCircle, CalendarCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PoweredByKame from "@/components/PoweredByKame";

export default function ConfirmAppointment() {
  const { token } = useParams();
  const [state, setState] = useState("loading");

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    (async () => {
      try {
        const res = await base44.functions.invoke("confirmAppointmentByToken", { token });
        const data = res.data;
        if (data?.already_resolved) {
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
            <p className="text-slate-600 font-medium">Confirmando tu cita…</p>
          </>
        )}
        {state === "success" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 flex items-center justify-center mb-5">
              <CheckCircle2 className="w-9 h-9 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Cita confirmada</h1>
            <p className="text-slate-600">Le enviamos la confirmación al paciente.</p>
          </>
        )}
        {state === "already" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-slate-100 flex items-center justify-center mb-5">
              <CalendarCheck className="w-9 h-9 text-slate-500" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Esta cita ya fue gestionada</h1>
            <p className="text-slate-600">La cita ya no está pendiente de confirmación.</p>
          </>
        )}
        {state === "error" && (
          <>
            <div className="w-16 h-16 mx-auto rounded-full bg-red-100 flex items-center justify-center mb-5">
              <AlertCircle className="w-9 h-9 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">No pudimos confirmar</h1>
            <p className="text-slate-600">El enlace no es válido o expiró.</p>
          </>
        )}

        <PoweredByKame utm="confirm_page" className="mt-6" />
      </div>
    </div>
  );
}