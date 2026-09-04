import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Search, CalendarX2 } from "lucide-react";

const STATUS_STYLES = {
  confirmed: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-gray-200 text-gray-700",
};
const STATUS_LABELS = { confirmed: "Confirmada", pending: "Pendiente", completed: "Completada", cancelled: "Cancelada", no_show: "Ausente" };

export default function AppointmentHistory() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    (async () => {
      try {
        const all = await base44.entities.Appointment.list("-start_datetime");
        const now = new Date();
        setAppointments((all || []).filter((a) => new Date(a.end_datetime || a.start_datetime) < now));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return appointments.filter((a) => {
      const matchStatus = statusFilter === "all" || a.status === statusFilter;
      const matchSearch = !q || a.patient_name?.toLowerCase().includes(q) || a.service_name?.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [appointments, search, statusFilter]);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-heading font-semibold">Historial de citas</h1>
        <p className="text-sm text-muted-foreground">Citas pasadas con detalles, notas y estados de cumplimiento</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar paciente o servicio..." className="pl-9" />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-9 rounded-md border border-input bg-transparent px-3 text-sm">
          <option value="all">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <CalendarX2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
          No hay citas pasadas que coincidan.
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <Card key={a.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{a.patient_name || "Paciente"}</p>
                  <p className="text-sm text-muted-foreground">{a.service_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatArDateTime(a.start_datetime, { dateStyle: "medium", timeStyle: "short", day: undefined, month: undefined, hour: undefined, minute: undefined, hour12: undefined })}
                  </p>
                  {a.notes && <p className="text-xs text-muted-foreground mt-2 italic bg-accent/50 rounded px-2 py-1">📝 {a.notes}</p>}
                </div>
                <Badge className={STATUS_STYLES[a.status] || ""}>{STATUS_LABELS[a.status]}</Badge>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}