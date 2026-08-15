import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Calendar, Users, Clock, CheckCircle2, XCircle, AlertCircle, CalendarClock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

const statusConfig = {
  pending: { label: "Pendiente", color: "bg-amber-100 text-amber-700", dot: "bg-amber-500" },
  confirmed: { label: "Confirmada", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelada", color: "bg-red-100 text-red-700", dot: "bg-red-500" },
  completed: { label: "Completada", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500" },
  no_show: { label: "Ausencia", color: "bg-gray-100 text-gray-700", dot: "bg-gray-500" },
};

function formatTime(iso) {
  try {
    return new Date(iso).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return iso;
  }
}

function StatCard({ icon: Icon, label, value, accent, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-card rounded-xl border border-border p-5 text-left hover:shadow-md hover:-translate-y-0.5 transition-all focus:outline-none focus-visible:ring-1 focus-visible:ring-ring w-full"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-heading font-semibold mt-1">{value}</p>
        </div>
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
      </div>
    </button>
  );
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [appointments, setAppointments] = useState([]);
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

        const [appts, pats] = await Promise.all([
          base44.entities.Appointment.filter({}),
          base44.entities.Patient.filter({}),
        ]);

        const todayAppts = (appts || []).filter((a) => {
          const d = new Date(a.start_datetime);
          return d >= start && d <= end;
        });
        todayAppts.sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
        setAppointments(todayAppts);
        setPatients(pats || []);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const confirmed = appointments.filter((a) => a.status === "confirmed").length;
  const pending = appointments.filter((a) => a.status === "pending").length;
  const completed = appointments.filter((a) => a.status === "completed").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {new Date().toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Calendar} label="Citas de hoy" value={appointments.length} accent="bg-blue-100 text-blue-600" onClick={() => navigate("/agenda?date=today")} />
        <StatCard icon={CheckCircle2} label="Confirmadas" value={confirmed} accent="bg-emerald-100 text-emerald-600" onClick={() => navigate("/agenda?date=today&status=confirmed")} />
        <StatCard icon={AlertCircle} label="Pendientes" value={pending} accent="bg-amber-100 text-amber-600" onClick={() => navigate("/agenda?date=today&status=pending")} />
        <StatCard icon={Users} label="Pacientes" value={patients.length} accent="bg-purple-100 text-purple-600" onClick={() => navigate("/pacientes")} />
      </div>

      <div className="bg-card rounded-xl border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-heading font-semibold flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" />
            Citas de hoy
          </h2>
          <Link to="/agenda" className="text-sm text-primary hover:underline">
            Ver agenda
          </Link>
        </div>

        {appointments.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No hay citas para hoy</p>
            <Link to="/agenda" className="text-sm text-primary hover:underline mt-2 inline-block">
              Crear una cita
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {appointments.map((a) => {
              const cfg = statusConfig[a.status] || statusConfig.pending;
              return (
                <div key={a.id} className="flex items-center gap-4 px-6 py-3 hover:bg-accent/50 transition-colors">
                  <div className="text-center w-16 shrink-0">
                    <p className="font-heading font-semibold">{formatTime(a.start_datetime)}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{a.patient_name || "Paciente"}</p>
                    <p className="text-sm text-muted-foreground truncate">{a.service_name || "Servicio"}</p>
                  </div>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${cfg.color}`}>{cfg.label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}