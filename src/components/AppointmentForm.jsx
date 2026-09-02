import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Repeat } from "lucide-react";
import PatientForm from "@/components/PatientForm";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";

const OWNER_VALUE = "__owner__";

const FREQUENCIES = [
  { value: "weekly", label: "Semanal" },
  { value: "biweekly", label: "Quincenal" },
  { value: "monthly", label: "Mensual" },
];

const statusOptions = [
  { value: "pending", label: "Pendiente" },
  { value: "confirmed", label: "Confirmada" },
  { value: "cancelled", label: "Cancelada" },
  { value: "completed", label: "Completada" },
  { value: "no_show", label: "Ausencia" },
];

function toLocalInput(date) {
  const d = new Date(date);
  const tzOffset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffset).toISOString().slice(0, 16);
}

export default function AppointmentForm({ open, onClose, onSaved, appointment, defaultDate }) {
  const [patients, setPatients] = useState([]);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [patientFormOpen, setPatientFormOpen] = useState(false);
  const { settings, isOwner, professional: myProfessional } = usePracticeSettings();
  const isClinic = getPlanStatus(settings).canUseMultiProfessional;

  const [recurring, setRecurring] = useState(false);
  const [frequency, setFrequency] = useState("weekly");
  const [editScope, setEditScope] = useState("this"); // "this" | "future"
  const [form, setForm] = useState({
    patient_id: "",
    service_id: "",
    start_datetime: "",
    // Un turno que carga el profesional desde su propia Agenda nace CONFIRMADO: lo está
    // agendando él mismo, no es una solicitud que tenga que aprobar después. "pending" es
    // para lo que entra por el link público o por el bot. Sigue siendo editable desde el
    // selector de estado del formulario.
    status: "confirmed",
    notes: "",
    professional_ref_id: "",
  });

  useEffect(() => {
    if (open) {
      loadData();
      setRecurring(false);
      setFrequency("weekly");
      setEditScope("this");
      if (appointment) {
        setForm({
          patient_id: appointment.patient_id || "",
          service_id: appointment.service_id || "",
          start_datetime: toLocalInput(appointment.start_datetime),
          status: appointment.status || "pending",
          notes: appointment.notes || "",
          professional_ref_id: appointment.professional_ref_id || "",
        });
      } else {
        const base = defaultDate ? new Date(defaultDate) : new Date();
        base.setMinutes(0, 0, 0);
        setForm({
          patient_id: "",
          service_id: "",
          start_datetime: toLocalInput(base),
          status: "confirmed",
          notes: "",
          professional_ref_id: "",
        });
      }
    }
  }, [open, appointment, defaultDate]);

  async function loadData() {
    setLoading(true);
    try {
      const [patsRes, servsRes, pros] = await Promise.all([
        base44.functions.invoke("getScopedPatients", {}),
        base44.functions.invoke("getScopedServices", {}),
        isClinic ? fetchScopedProfessionals() : Promise.resolve([]),
      ]);
      setPatients(patsRes?.data?.patients || []);
      setServices((servsRes?.data?.services || []).filter((s) => s.active !== false));
      setProfessionals(pros || []);
    } finally {
      setLoading(false);
    }
  }

  const selectedService = services.find((s) => s.id === form.service_id);

  function calcEnd(startISO, duration) {
    const start = new Date(startISO);
    start.setMinutes(start.getMinutes() + (duration || 30));
    return start.toISOString();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.patient_id || !form.service_id || !form.start_datetime) return;
    setSaving(true);
    try {
      const patient = patients.find((p) => p.id === form.patient_id);
      const service = services.find((s) => s.id === form.service_id);
      const end = calcEnd(form.start_datetime, service.duration_minutes);

      // professional_id identifica a QUÉ CONSULTORIO pertenece la cita (no quién la
      // atiende dentro del equipo, eso es professional_ref_id). Antes este campo nunca
      // se mandaba al crear una cita manual -- confirmado en vivo: la cita se guardaba
      // igual, pero quedaba invisible para siempre en cualquier pantalla que filtre por
      // consultorio (Agenda, Panel, etc.), porque ese campo simplemente no estaba.
      const me = await base44.auth.me();
      const practiceOwnerId = isOwner ? me.id : (myProfessional?.practice_owner_id || me.id);

      const payload = {
        patient_id: form.patient_id,
        patient_name: `${patient.first_name} ${patient.last_name || ""}`.trim(),
        service_id: form.service_id,
        service_name: service.name,
        start_datetime: new Date(form.start_datetime).toISOString(),
        end_datetime: end,
        status: form.status,
        notes: form.notes,
        origin: "manual",
        professional_id: practiceOwnerId,
        professional_ref_id: form.professional_ref_id || "",
      };

      let apptId = appointment?.id;
      let savedAppt;
      const wasRescheduled = appointment && new Date(payload.start_datetime).getTime() !== new Date(appointment.start_datetime).getTime();
      const wasJustCancelled = appointment && appointment.status !== "cancelled" && form.status === "cancelled";
      if (appointment) {
        savedAppt = await base44.entities.Appointment.update(appointment.id, payload);
      } else {
        savedAppt = await base44.entities.Appointment.create(payload);
        apptId = savedAppt.id;

        if (recurring) {
          const startDate = new Date(form.start_datetime);
          const rule = await base44.entities.RecurringRule.create({
            patient_id: form.patient_id,
            service_id: form.service_id,
            frequency,
            day_of_week: startDate.getDay(),
            start_date: startDate.toISOString().slice(0, 10),
            time: `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`,
            active: true,
          });
          await base44.entities.Appointment.update(apptId, { recurring_rule_id: rule.id });
        }
      }

      // Sincroniza con Google Calendar (si la persona que atiende esta cita lo tiene
      // conectado) -- crea/actualiza el evento, o lo borra si quedó cancelada. Si falla
      // por lo que sea, no bloquea el guardado de la cita en sí.
      try {
        await base44.functions.invoke("syncAppointmentGoogle", { appointmentId: apptId });
      } catch { /* no romper el flujo si Google falla */ }

      // Aviso al paciente cuando el profesional carga una cita NUEVA ya confirmada desde la
      // Agenda. Hacía falta invocarlo explícitamente: el workflow "Email de confirmación al
      // paciente" dispara solo con el evento `update` de Appointment, así que una cita
      // creada a mano (origin: "manual") nunca lo activaba y al paciente no le llegaba NADA
      // — ni email, ni WhatsApp, ni el recordatorio inmediato para las citas de hoy.
      // Confirmado en vivo: cita creada el 31/08 a las 14:20 para las 15:30 (hora
      // Argentina), con confirmation_email_sent en false y sin un solo envío.
      // Los otros caminos de creación (link público y bot de WhatsApp) ya invocan esta
      // función por su cuenta con skip_whatsapp, así que no se duplica nada.
      if (!appointment && payload.status === "confirmed") {
        try {
          await base44.functions.invoke("sendAppointmentConfirmation", { appointment_id: apptId });
        } catch { /* no romper el flujo si el aviso falla */ }
      }

      // Avisa al paciente por WhatsApp/email cuando el PROFESIONAL reagenda o cancela a
      // mano — antes esto solo pasaba cuando la acción venía del bot. Best-effort: nunca
      // debe bloquear el guardado, que ya terminó arriba.
      if (wasJustCancelled) {
        try {
          await base44.functions.invoke("notifyPatientOfAppointmentChange", { appointmentId: apptId, changeType: "cancelled" });
        } catch { /* no romper el flujo si el aviso falla */ }
      } else if (wasRescheduled) {
        try {
          await base44.functions.invoke("notifyPatientOfAppointmentChange", {
            appointmentId: apptId,
            changeType: "rescheduled",
            previousStartDatetime: appointment.start_datetime,
          });
        } catch { /* no romper el flujo si el aviso falla */ }
      }

      // If editing a recurring appointment with "future" scope, update all future instances
      if (appointment && appointment.recurring_rule_id && editScope === "future") {
        const futureAppts = await base44.entities.Appointment.filter({ recurring_rule_id: appointment.recurring_rule_id });
        await Promise.all(
          (futureAppts || [])
            .filter((a) => new Date(a.start_datetime) >= new Date(appointment.start_datetime))
            .map((a) => base44.entities.Appointment.update(a.id, { status: form.status, notes: form.notes }))
        );
      }

      if (form.status === "completed" && (!appointment || appointment.status !== "completed")) {
        try {
          const firstName = patient.first_name || "";
          await base44.entities.ReviewRequest.create({
            patient_id: patient.id,
            patient_name: `${patient.first_name} ${patient.last_name || ""}`.trim(),
            patient_phone: patient.phone || "",
            patient_email: patient.email || "",
            appointment_id: apptId,
            service_name: service.name,
            appointment_date: payload.start_datetime,
            status: "pending",
            request_message: `¡Hola ${firstName}! Gracias por tu visita. ¿Nos dejarías una reseña? Tu opinión nos ayuda mucho.`,
            token: crypto.randomUUID(),
            disabled: false,
          });
        } catch {}
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment ? "Editar cita" : "Nueva cita"}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Paciente</Label>
                <button
                  type="button"
                  onClick={() => setPatientFormOpen(true)}
                  className="text-xs text-primary flex items-center gap-1 hover:underline"
                >
                  <Plus className="w-3 h-3" /> Nuevo paciente
                </button>
              </div>
              <Select value={form.patient_id} onValueChange={(v) => setForm({ ...form, patient_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar paciente" />
                </SelectTrigger>
                <SelectContent>
                  {(patients || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.first_name} {p.last_name || ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Servicio</Label>
              <Select value={form.service_id} onValueChange={(v) => setForm({ ...form, service_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar servicio" />
                </SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name} ({s.duration_minutes} min)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isClinic && professionals.length > 0 && (
              <div className="space-y-2">
                <Label>Profesional</Label>
                <Select value={form.professional_ref_id || OWNER_VALUE} onValueChange={(v) => setForm({ ...form, professional_ref_id: v === OWNER_VALUE ? "" : v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={OWNER_VALUE}>Dueño de la cuenta</SelectItem>
                    {professionals.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.first_name} {p.last_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="start">Fecha y hora</Label>
              <Input
                id="start"
                type="datetime-local"
                value={form.start_datetime}
                onChange={(e) => setForm({ ...form, start_datetime: e.target.value })}
                required
              />
              {selectedService && (
                <p className="text-xs text-muted-foreground">
                  Duración: {selectedService.duration_minutes} min
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!appointment && (
              <div className="space-y-2 rounded-lg border border-border p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={recurring}
                    onChange={(e) => setRecurring(e.target.checked)}
                    className="rounded"
                  />
                  <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-sm font-medium">Cita recurrente</span>
                </label>
                {recurring && (
                  <Select value={frequency} onValueChange={setFrequency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FREQUENCIES.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          {f.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            )}

            {appointment && appointment.recurring_rule_id && (
              <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-medium text-amber-800">Esta cita es parte de una serie recurrente</p>
                <Select value={editScope} onValueChange={setEditScope}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="this">Solo esta cita</SelectItem>
                    <SelectItem value="future">Esta y todas las futuras</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="notes">Notas</Label>
              <Textarea
                id="notes"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {appointment ? "Guardar" : "Crear cita"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>

    <PatientForm
      open={patientFormOpen}
      onClose={() => setPatientFormOpen(false)}
      onSaved={async (savedPatient) => {
          if (savedPatient && savedPatient.id) {
            setPatients((prev) => {
              const idx = prev.findIndex((p) => p.id === savedPatient.id);
              if (idx >= 0) {
                const copy = [...prev];
                copy[idx] = savedPatient;
                return copy;
              }
              return [...prev, savedPatient];
            });
            setForm((prev) => ({ ...prev, patient_id: savedPatient.id }));
          }
        }}
    />
    </>
  );
}
