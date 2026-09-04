import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { CalendarCheck, UserPlus, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }

// Mismos colores de estado que usa la Agenda (agenda-utils.js), pero en hex porque
// recharts necesita un valor de color real, no una clase de Tailwind.
const STATUS_COLORS = {
  confirmed: "#10b981", // emerald-500
  pending: "#f59e0b",   // amber-500
  completed: "#0ea5e9", // sky-500
  cancelled: "#fb7185", // rose-400
  no_show: "#94a3b8",   // slate-400
};

export default function Analytics() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const startISO = startOfMonth(now).toISOString();
        // La disponibilidad va por la función con alcance: las filas que crea el
        // onboarding llevan el id del servidor en created_by_id (ver
        // base44/shared/ownership.ts), y leídas directo desde el cliente venían vacías — con
        // lo cual las métricas de ocupación daban siempre sobre cero horas disponibles.
        const [appts, pats, avail] = await Promise.all([
          base44.entities.Appointment.filter({ start_datetime: { $gte: startISO } }),
          base44.entities.Patient.filter({}),
          base44.functions.invoke("getScopedAvailability", {}).catch(() => null),
        ]);
        setAppointments(appts || []);
        setPatients(pats || []);
        setAvailability(avail?.data?.availability || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const som = startOfMonth(now);
    const eom = endOfMonth(now);

    const monthAppts = appointments.filter((a) => {
      const d = new Date(a.start_datetime);
      return d >= som && d <= eom;
    });

    const newPatients = patients.filter((p) => {
      const d = new Date(p.created_date);
      return d >= som && d <= eom;
    });

    let availableMin = 0;
    const daysInMonth = eom.getDate();
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(now.getFullYear(), now.getMonth(), day);
      if (d > now) break;
      const dow = d.getDay();
      availability.filter((a) => a.type === "work" && a.day_of_week === dow).forEach((a) => {
        const [sh, sm] = a.start_time.split(":").map(Number);
        const [eh, em] = a.end_time.split(":").map(Number);
        availableMin += (eh * 60 + em) - (sh * 60 + sm);
      });
    }
    let bookedMin = 0;
    monthAppts.filter((a) => a.status !== "cancelled").forEach((a) => {
      if (a.start_datetime && a.end_datetime) {
        bookedMin += (new Date(a.end_datetime) - new Date(a.start_datetime)) / 60000;
      }
    });
    const occupancy = availableMin > 0 ? Math.min(100, Math.round((bookedMin / availableMin) * 100)) : 0;

    const weeks = [0, 0, 0, 0, 0];
    monthAppts.forEach((a) => {
      const d = new Date(a.start_datetime);
      const w = Math.min(4, Math.floor((d.getDate() - 1) / 7));
      weeks[w]++;
    });

    const byStatus = { confirmed: 0, pending: 0, completed: 0, cancelled: 0, no_show: 0 };
    monthAppts.forEach((a) => { if (byStatus[a.status] !== undefined) byStatus[a.status]++; });

    return { total: monthAppts.length, newPatients: newPatients.length, occupancy, weeks, byStatus };
  }, [appointments, patients, availability]);

  const weekData = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5"].map((label, i) => ({ label, citas: metrics.weeks[i] }));
  const statusLabels = { confirmed: "Confirmadas", pending: "Pendientes", completed: "Completadas", cancelled: "Canceladas", no_show: "Ausencias" };
  const statusData = Object.entries(statusLabels).map(([k, label]) => ({ key: k, label, cantidad: metrics.byStatus[k] || 0 }));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-3 py-3 md:p-6 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight">Reportes y métricas</h1>
        <p className="text-muted-foreground text-sm capitalize">{new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={CalendarCheck} label="Citas agendadas" value={metrics.total} accent="bg-blue-100 text-blue-600" />
        <StatCard icon={UserPlus} label="Pacientes nuevos" value={metrics.newPatients} accent="bg-emerald-100 text-emerald-600" />
        <StatCard icon={TrendingUp} label="Ocupación de agenda" value={`${metrics.occupancy}%`} accent="bg-amber-100 text-amber-600" />
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-sm">
        <h2 className="font-heading font-semibold text-sm mb-4">Citas por semana</h2>
        {metrics.total === 0 ? (
          <EmptyChart text="Todavía no hay citas este mes." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={weekData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="citas" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border p-4 sm:p-5 shadow-sm">
        <h2 className="font-heading font-semibold text-sm mb-4">Citas por estado</h2>
        {metrics.total === 0 ? (
          <EmptyChart text="Todavía no hay citas este mes." />
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={statusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
              <Bar dataKey="cantidad" radius={[0, 6, 6, 0]} maxBarSize={26}>
                {statusData.map((entry) => (
                  <Cell key={entry.key} fill={STATUS_COLORS[entry.key]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function EmptyChart({ text }) {
  return (
    <div className="flex items-center justify-center h-[180px]">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-card rounded-2xl border border-border p-4 sm:p-5">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <p className="text-2xl font-heading font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </div>
  );
}
