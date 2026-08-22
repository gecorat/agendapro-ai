import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Users, CalendarRange, CalendarClock, ArrowRight, Calendar } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { statusConfig, formatTime } from "@/lib/agenda-utils";

function StatCard({ icon: Icon, label, value, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card rounded-2xl border border-border p-4 sm:p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs sm:text-sm text-muted-foreground">{label}</p>
          <p className="text-xl sm:text-2xl font-heading font-semibold mt-1">{value}</p>
        </div>
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
          <Icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
        </div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { settings } = usePracticeSettings();
  const [appointments, setAppointments] = useState([]);
  const [weekCount, setWeekCount] = useState(0);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const today = new Date();
        const start = new Date(today);
        start.setHours(0, 0, 0, 0);
        const end = new Date(today);
        end.setHours(23, 59, 59, 999);

        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - weekStart.getDay());
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        weekEnd.setHours(23, 59, 59, 999);

        // Antes llamaba Appointment.filter({})/Patient.filter({}) directo, que un
        // profesional invitado no puede leer (las reglas de acceso comparan contra el
        // DUEÑO de la cuenta). Estas funciones resuelven el alcance correcto para
        // cualquiera de los dos casos.
        const [apptsRes, patsRes] = await Promise.all([
          base44.functions.invoke("getScopedAppointments", {}),
          base44.functions.invoke("getScopedPatients", {}),
        ]);
        const appts = apptsRes?.data?.appointments || [];
        const pats = patsRes?.data?.patients || [];

        const todayAppts = (appts || []).filter((a) => {
          const d = new Date(a.start_datetime);
          return d >= start && d <= end;
        });
        todayAppts.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));

        const weekAppts = (appts || []).filter((a) => {
          const d = new Date(a.start_datetime);
          return d >= weekStart && d <= weekEnd && a.status !== "cancelled";
        });

        setAppointments(todayAppts);
        setWeekCount(weekAppts.length);
        setPatients(pats || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const confirmed = appointments.filter((a) => a.status === "confirmed").length;
  const pending = appointments.filter((a) => a.status === "pending").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = (settings?.practice_name || "").split(" ")[0];

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 sm:space-y-6">
      {/* Hero oscuro con el resumen del día */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0B1130] via-[#141E4D] to-[#22307A] px-5 py-6 sm:px-8 sm:py-8 text-white shadow-lg shadow-[#141E4D]/20">
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-white/[0.06] blur-2xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-10 w-56 h-56 rounded-full bg-blue-400/10 blur-3xl pointer-events-none" />

        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
          <div>
            <p className="text-xs sm:text-sm font-medium text-blue-200/70 capitalize">
              {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
            </p>
            <h1 className="text-2xl sm:text-3xl font-heading font-semibold mt-1.5 tracking-tight">
              Hola{firstName ? `, ${firstName}` : ""} 👋
            </h1>
            <p className="text-blue-100/60 text-sm mt-1">Así viene tu día hoy</p>

            <div className="flex items-end gap-2 mt-5">
              <span className="text-5xl font-heading font-bold leading-none tabular-nums">{appointments.length}</span>
              <span className="text-blue-200/70 text-sm pb-1.5">{appointments.length === 1 ? "cita hoy" : "citas hoy"}</span>
            </div>

            {appointments.length > 0 && (
              <div className="flex items-center gap-2 mt-4 flex-wrap">
                {confirmed > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> {confirmed} confirmada{confirmed > 1 ? "s" : ""}
                  </span>
                )}
                {pending > 0 && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-white/10 backdrop-blur-sm px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> {pending} pendiente{pending > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            )}
          </div>

          <Link
            to="/agenda?date=today"
            className="inline-flex items-center gap-1.5 self-start sm:self-auto text-sm font-medium bg-white text-[#141E4D] px-4 py-2.5 rounded-xl hover:bg-blue-50 transition-colors shadow-sm shrink-0"
          >
            Ver agenda <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        <StatCard icon={CalendarRange} label="Esta semana" value={weekCount} accent="bg-blue-100 text-blue-600" onClick={() => navigate("/agenda")} />
        <StatCard icon={Users} label="Pacientes" value={patients.length} accent="bg-violet-100 text-violet-600" onClick={() => navigate("/pacientes")} />
      </div>

      <div className="bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border">
          <h2 className="font-heading font-semibold flex items-center gap-2 text-[15px]">
            <CalendarClock className="w-4.5 h-4.5 text-primary" />
            Citas de hoy
          </h2>
          <Link to="/agenda" className="text-sm text-primary hover:underline font-medium">
            Ver agenda
          </Link>
        </div>

        {appointments.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <Calendar className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-muted-foreground text-sm">No hay citas para hoy</p>
            <Link to="/agenda" className="text-sm text-primary hover:underline mt-2 inline-block font-medium">
              Crear una cita
            </Link>
          </div>
        ) : (
          <div className="p-3 space-y-1.5">
            {appointments.map((a) => {
              const cfg = statusConfig[a.status] || statusConfig.pending;
              return (
                <div
                  key={a.id}
                  className={`flex items-center gap-3 rounded-xl border-l-[3px] ${cfg.border} bg-card hover:shadow-sm transition-all px-3 py-2.5`}
                >
                  <span className="text-sm font-semibold tabular-nums text-muted-foreground w-14 shrink-0">{formatTime(new Date(a.start_datetime))}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${cfg.strike ? "line-through text-muted-foreground" : "text-foreground"}`}>{a.patient_name || "Paciente"}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.service_name || "Servicio"}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2 py-1 rounded-full shrink-0 ${cfg.bgSoft} ${cfg.text}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
