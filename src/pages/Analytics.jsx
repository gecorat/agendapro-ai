import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Loader2, CalendarCheck, UserPlus, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";

function startOfMonth(d) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d) { return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59); }

export default function Analytics() {
  const { settings } = usePracticeSettings();
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const startISO = startOfMonth(now).toISOString();
        const [appts, pats, avail] = await Promise.all([
          base44.entities.Appointment.filter({ start_datetime: { $gte: startISO } }),
          base44.entities.Patient.filter({}),
          base44.entities.Availability.filter({}),
        ]);
        setAppointments(appts || []);
        setPatients(pats || []);
        setAvailability(avail || []);
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

    // Occupancy: booked minutes / available work minutes
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

    // Weekly breakdown
    const weeks = [0, 0, 0, 0, 0];
    monthAppts.forEach((a) => {
      const d = new Date(a.start_datetime);
      const w = Math.min(4, Math.floor((d.getDate() - 1) / 7));
      weeks[w]++;
    });

    // Status breakdown
    const byStatus = { confirmed: 0, pending: 0, completed: 0, cancelled: 0, no_show: 0 };
    monthAppts.forEach((a) => { if (byStatus[a.status] !== undefined) byStatus[a.status]++; });

    return { total: monthAppts.length, newPatients: newPatients.length, occupancy, weeks, byStatus };
  }, [appointments, patients, availability]);

  const weekData = ["Sem 1", "Sem 2", "Sem 3", "Sem 4", "Sem 5"].map((label, i) => ({ label, citas: metrics.weeks[i] }));
  const statusLabels = { confirmed: "Confirmadas", pending: "Pendientes", completed: "Completadas", cancelled: "Canceladas", no_show: "Ausencias" };
  const statusData = Object.entries(statusLabels).map(([k, label]) => ({ label, cantidad: metrics.byStatus[k] || 0 }));

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-heading font-semibold">Reportes y métricas</h1>
        <p className="text-sm text-muted-foreground">Resumen de {new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard icon={CalendarCheck} label="Citas agendadas" value={metrics.total} color="text-blue-600" />
        <StatCard icon={UserPlus} label="Pacientes nuevos" value={metrics.newPatients} color="text-emerald-600" />
        <StatCard icon={TrendingUp} label="Ocupación de agenda" value={`${metrics.occupancy}%`} color="text-amber-600" />
      </div>

      <Card className="p-4">
        <h2 className="font-heading font-semibold text-sm mb-4">Citas por semana</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={weekData}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="citas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card className="p-4">
        <h2 className="font-heading font-semibold text-sm mb-4">Citas por estado</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={statusData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
            <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis type="category" dataKey="label" width={90} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
            <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12 }} />
            <Bar dataKey="cantidad" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div>
          <p className="text-2xl font-heading font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </div>
    </Card>
  );
}