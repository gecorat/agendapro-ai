import React, { useEffect, useState, useMemo } from "react";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Plus, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppointmentForm from "@/components/AppointmentForm";

const statusConfig = {
  pending: { label: "Pendiente", bg: "bg-amber-50 border-amber-300 text-amber-800", dot: "bg-amber-500" },
  confirmed: { label: "Confirmada", bg: "bg-emerald-50 border-emerald-300 text-emerald-800", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelada", bg: "bg-red-50 border-red-300 text-red-800 line-through", dot: "bg-red-500" },
  completed: { label: "Completada", bg: "bg-blue-50 border-blue-300 text-blue-800", dot: "bg-blue-500" },
  no_show: { label: "Ausencia", bg: "bg-gray-50 border-gray-300 text-gray-800", dot: "bg-gray-500" },
};

const hours = Array.from({ length: 14 }, (_, i) => i + 8); // 8:00 - 21:00

export default function Agenda() {
  const [view, setView] = useState("day"); // day | week
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formDefaultDate, setFormDefaultDate] = useState(null);

  useEffect(() => {
    loadAppointments();
  }, [currentDate, view]);

  async function loadAppointments() {
    setLoading(true);
    try {
      const { start, end } = getRange();
      const all = await base44.entities.Appointment.filter({});
      const filtered = (all || []).filter((a) => {
        const d = new Date(a.start_datetime);
        return d >= start && d <= end;
      });
      setAppointments(filtered);
    } finally {
      setLoading(false);
    }
  }

  function getRange() {
    const start = new Date(currentDate);
    const end = new Date(currentDate);
    if (view === "day") {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }

  function shift(days) {
    const next = new Date(currentDate);
    next.setDate(next.getDate() + days);
    setCurrentDate(next);
  }

  function today() {
    setCurrentDate(new Date());
  }

  const dateLabel = useMemo(() => {
    if (view === "day") {
      return currentDate.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
    }
    const { start, end } = getRange();
    return `${start.toLocaleDateString("es", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("es", { day: "numeric", month: "short" })}`;
  }, [currentDate, view]);

  function apptsForDay(date) {
    return appointments
      .filter((a) => {
        const d = new Date(a.start_datetime);
        return d.toDateString() === date.toDateString();
      })
      .sort((a, b) => new Date(a.start_datetime) - new Date(b.start_datetime));
  }

  function openNew(date) {
    setEditing(null);
    setFormDefaultDate(date);
    setFormOpen(true);
  }

  function openEdit(appt) {
    setEditing(appt);
    setFormOpen(true);
  }

  async function handleSaved() {
    await loadAppointments();
  }

  const weekDays = useMemo(() => {
    const { start } = getRange();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate, view]);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold">Agenda</h1>
          <p className="text-muted-foreground text-sm capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-card rounded-lg border border-border p-1">
            <button
              onClick={() => setView("day")}
              className={`px-3 py-1.5 text-sm rounded-md font-medium ${view === "day" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Día
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1.5 text-sm rounded-md font-medium ${view === "week" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            >
              Semana
            </button>
          </div>
          <Button variant="outline" size="icon" onClick={() => shift(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={today}>
            Hoy
          </Button>
          <Button variant="outline" size="icon" onClick={() => shift(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
          <Button onClick={() => openNew(currentDate)}>
            <Plus className="w-4 h-4 mr-1" />
            Cita
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : view === "day" ? (
        <DayView date={currentDate} appts={apptsForDay(currentDate)} onNew={openNew} onEdit={openEdit} />
      ) : (
        <WeekView days={weekDays} apptFn={apptsForDay} onNew={openNew} onEdit={openEdit} />
      )}

      <AppointmentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        appointment={editing}
        defaultDate={formDefaultDate || currentDate}
      />
    </div>
  );
}

function DayView({ date, appts, onNew, onEdit }) {
  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden">
      <div className="border-b border-border px-4 py-2 flex items-center justify-between">
        <span className="text-sm font-medium capitalize">
          {date.toLocaleDateString("es", { weekday: "long" })}
        </span>
        <button onClick={() => onNew(date)} className="text-sm text-primary hover:underline">
          + Agregar
        </button>
      </div>
      <div className="divide-y divide-border">
        {hours.map((h) => {
          const slotAppts = appts.filter((a) => new Date(a.start_datetime).getHours() === h);
          return (
            <div key={h} className="flex min-h-[60px]">
              <div className="w-16 shrink-0 px-3 py-2 text-xs text-muted-foreground border-r border-border text-right">
                {h}:00
              </div>
              <div className="flex-1 p-1.5 space-y-1">
                {slotAppts.map((a) => {
                  const cfg = statusConfig[a.status] || statusConfig.pending;
                  return (
                    <button
                      key={a.id}
                      onClick={() => onEdit(a)}
                      className={`w-full text-left rounded-lg border px-3 py-1.5 text-sm ${cfg.bg} hover:opacity-80 transition-opacity`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          {new Date(a.start_datetime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                        </span>
                        <span className="font-medium">{a.patient_name}</span>
                      </div>
                      <span className="text-xs opacity-75">{a.service_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WeekView({ days, apptFn, onNew, onEdit }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
      {days.map((d) => {
        const dayAppts = apptFn(d);
        const isToday = d.toDateString() === new Date().toDateString();
        return (
          <div key={d.toISOString()} className="bg-card rounded-xl border border-border overflow-hidden min-h-[300px] flex flex-col">
            <div
              className={`px-3 py-2 border-b border-border text-center ${isToday ? "bg-primary text-primary-foreground" : ""}`}
            >
              <p className="text-xs uppercase">{d.toLocaleDateString("es", { weekday: "short" })}</p>
              <p className="text-lg font-heading font-semibold">{d.getDate()}</p>
            </div>
            <div className="flex-1 p-1.5 space-y-1">
              {dayAppts.map((a) => {
                const cfg = statusConfig[a.status] || statusConfig.pending;
                return (
                  <button
                    key={a.id}
                    onClick={() => onEdit(a)}
                    className={`w-full text-left rounded-lg border px-2 py-1 text-xs ${cfg.bg} hover:opacity-80`}
                  >
                    <div className="font-medium">
                      {new Date(a.start_datetime).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div className="truncate">{a.patient_name}</div>
                  </button>
                );
              })}
              {dayAppts.length === 0 && (
                <button onClick={() => onNew(d)} className="w-full text-xs text-muted-foreground hover:text-primary py-4">
                  +
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}