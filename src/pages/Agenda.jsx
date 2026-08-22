import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { ChevronLeft, ChevronRight, Plus, Filter, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import AppointmentForm from "@/components/AppointmentForm";
import DayView from "@/components/agenda/DayView";
import WeekView from "@/components/agenda/WeekView";
import MonthView from "@/components/agenda/MonthView";
import DayDetailSheet from "@/components/agenda/DayDetailSheet";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";

const OWNER_VALUE = "__owner__";

const VIEWS = [
  { value: "day", label: "Día" },
  { value: "week", label: "Semana" },
  { value: "month", label: "Mes" },
];

export default function Agenda() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialDate = (() => {
    const d = searchParams.get("date");
    if (!d) return new Date();
    if (d === "today") return new Date();
    const parsed = new Date(d + "T00:00:00");
    return isNaN(parsed.getTime()) ? new Date() : parsed;
  })();
  const initialStatus = ["confirmed", "pending", "cancelled", "completed", "no_show"].includes(searchParams.get("status")) ? searchParams.get("status") : null;

  const [view, setView] = useState("month");
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formDefaultDate, setFormDefaultDate] = useState(null);
  const [daySheetDate, setDaySheetDate] = useState(null);
  const [professionals, setProfessionals] = useState([]);
  const [proFilter, setProFilter] = useState("all");
  const { settings } = usePracticeSettings();
  const status = getPlanStatus(settings);
  const isClinic = status.canUseMultiProfessional;

  useEffect(() => {
    if (!isClinic) return;
    base44.entities.Professional.filter({ active: true }).then((list) => setProfessionals(list || []));
  }, [isClinic]);

  useEffect(() => {
    loadAppointments();
  }, [currentDate, view]);

  function clearFilter() {
    setStatusFilter(null);
    const next = new URLSearchParams(searchParams);
    next.delete("status");
    setSearchParams(next, { replace: true });
  }

  async function loadAppointments() {
    setLoading(true);
    try {
      const { start, end } = getRange();
      // Antes llamaba Appointment.filter({}) directo, que un profesional invitado no
      // puede leer (las reglas de acceso comparan contra el DUEÑO de la cuenta, nunca
      // contra su propio usuario). Esta función resuelve el alcance correcto.
      const res = await base44.functions.invoke("getScopedAppointments", {});
      const all = res?.data?.appointments || [];
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
    } else if (view === "week") {
      const day = start.getDay();
      start.setDate(start.getDate() - day);
      start.setHours(0, 0, 0, 0);
      // Clonamos desde `start` (ya ajustado) en vez de reusar `end`, que todavía tiene el
      // mes original de currentDate: si la semana cruza de mes, sumar días sobre ese mes
      // viejo daba una fecha de fin incorrecta.
      end.setTime(start.getTime());
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1);
      end.setDate(0);
      end.setHours(23, 59, 59, 999);
    }
    return { start, end };
  }

  function shift(n) {
    const next = new Date(currentDate);
    if (view === "day") next.setDate(next.getDate() + n);
    else if (view === "week") next.setDate(next.getDate() + n * 7);
    else next.setMonth(next.getMonth() + n);
    setCurrentDate(next);
  }

  function today() {
    setCurrentDate(new Date());
  }

  const visibleAppointments = useMemo(() => {
    let list = appointments;
    if (statusFilter) list = list.filter((a) => a.status === statusFilter);
    if (isClinic && proFilter !== "all") {
      const target = proFilter === OWNER_VALUE ? "" : proFilter;
      list = list.filter((a) => (a.professional_ref_id || "") === target);
    }
    return list;
  }, [appointments, statusFilter, proFilter, isClinic]);

  const dateLabel = useMemo(() => {
    if (view === "day") {
      return currentDate.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
    }
    if (view === "week") {
      const { start, end } = getRange();
      return `${start.toLocaleDateString("es", { day: "numeric", month: "short" })} - ${end.toLocaleDateString("es", { day: "numeric", month: "short" })}`;
    }
    return currentDate.toLocaleDateString("es", { month: "long", year: "numeric" });
  }, [currentDate, view]);

  const weekDays = useMemo(() => {
    const { start } = getRange();
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate, view]);

  function openNew(date) {
    setEditing(null);
    setFormDefaultDate(date);
    setFormOpen(true);
  }

  function openEdit(appt) {
    setEditing(appt);
    setFormOpen(true);
  }

  // Si llega ?edit=<id> en la URL (ej. desde "Editar" en la ficha de un contacto en
  // Chats), buscamos ESE turno puntual y lo abrimos directo, sin depender de que esté
  // dentro del rango de fechas visible actualmente.
  useEffect(() => {
    const editId = searchParams.get("edit");
    if (!editId) return;
    base44.entities.Appointment.filter({ id: editId }).then((rows) => {
      const appt = rows?.[0];
      if (appt) {
        setCurrentDate(new Date(appt.start_datetime));
        openEdit(appt);
      }
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next, { replace: true });
    }).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSaved() {
    await loadAppointments();
  }

  return (
    <div className="px-3 py-3 md:p-6 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Agenda</h1>
          <p className="text-muted-foreground text-sm capitalize">{dateLabel}</p>
        </div>
        <div className="flex items-center justify-between gap-2 sm:justify-start sm:flex-wrap">
          <div className="flex bg-muted/60 rounded-lg p-1 border border-border/60">
            {VIEWS.map((v) => (
              <button
                key={v.value}
                onClick={() => setView(v.value)}
                className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm rounded-md font-medium transition-all ${view === v.value ? "shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                style={view === v.value ? { background: "#1C2541", color: "#fff" } : undefined}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-0.5 bg-card rounded-lg border border-border p-1">
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => shift(-1)}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" className="h-8 px-2 sm:px-2.5 text-xs font-medium" onClick={today}>
                Hoy
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => shift(1)}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button size="icon" className="sm:hidden shadow-sm h-9 w-9 shrink-0" onClick={() => openNew(currentDate)}>
              <Plus className="w-4 h-4" />
            </Button>
            <Button onClick={() => openNew(currentDate)} className="hidden sm:inline-flex shadow-sm">
              <Plus className="w-4 h-4 mr-1" />
              Cita
            </Button>
          </div>
        </div>
      </div>

      {isClinic && professionals.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <button onClick={() => setProFilter("all")} className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${proFilter === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>Todos</button>
          <button onClick={() => setProFilter(OWNER_VALUE)} className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${proFilter === OWNER_VALUE ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
            <User className="w-3 h-3" /> Dueño de la cuenta
          </button>
          {professionals.map((p) => (
            <button key={p.id} onClick={() => setProFilter(p.id)} className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${proFilter === p.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"}`}>
              {p.first_name} {p.last_name}
            </button>
          ))}
        </div>
      )}

      {statusFilter && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50 text-amber-800 text-sm">
          <Filter className="w-4 h-4" />
          <span className="font-medium capitalize">Filtrando: {statusFilter === "no_show" ? "Ausencias" : statusFilter === "pending" ? "Pendientes" : statusFilter === "confirmed" ? "Confirmadas" : statusFilter === "cancelled" ? "Canceladas" : "Completadas"}</span>
          <button onClick={clearFilter} className="ml-auto text-xs font-medium underline hover:no-underline">Quitar filtro</button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : view === "day" ? (
        <DayView date={currentDate} appts={visibleAppointments} onNew={openNew} onEdit={openEdit} />
      ) : view === "week" ? (
        <WeekView days={weekDays} appts={visibleAppointments} onDayClick={setDaySheetDate} onEdit={openEdit} />
      ) : (
        <MonthView currentDate={currentDate} appts={visibleAppointments} onDayClick={setDaySheetDate} />
      )}

      <AppointmentForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={handleSaved}
        appointment={editing}
        defaultDate={formDefaultDate || currentDate}
      />

      <DayDetailSheet
        date={daySheetDate}
        appts={visibleAppointments}
        onClose={() => setDaySheetDate(null)}
        onNew={(d) => { openNew(d); }}
        onEdit={(a) => { openEdit(a); }}
        onChanged={loadAppointments}
      />
    </div>
  );
}
