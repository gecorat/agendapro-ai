import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { fetchScopedProfessionals } from "@/lib/professionals";
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
import { Loader2, Plus, Repeat, AlertTriangle } from "lucide-react";
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

  // Aviso de superposición. NO bloquea: el profesional es el dueño de su agenda y a veces
  // encaja a alguien a propósito. Lo que no puede pasar es que lo haga SIN ENTERARSE, que es
  // lo que pasaba hasta ahora (este formulario no validaba absolutamente nada).
  const [conflict, setConflict] = useState(null);
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
      setConflict(null);
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

  // Busca otra cita que se pise con la que se está por guardar. Se consultan las citas
  // frescas en el momento de guardar (y no al abrir el formulario) para que no se escape una
  // reserva que entró por el link público o por el bot mientras el formulario estaba abierto.
  //
  // Solo cuentan las del MISMO profesional del equipo: en el plan Clinic dos personas
  // distintas pueden atender a la misma hora sin problema. Se ignoran las canceladas y la
  // propia cita cuando se está editando.
  async function findOverlap(startISO, endISO) {
    try {
      const res = await base44.functions.invoke("getScopedAppointments", {});
      const all = res?.data?.appointments || [];
      const start = new Date(startISO).getTime();
      const end = new Date(endISO).getTime();
      const ref = form.professional_ref_id || null;
      return all.find((a) => {
        if (a.id === appointment?.id) return false;
        if (a.status === "cancelled" || a.is_demo) return false;
        if ((a.professional_ref_id || null) !== ref) return false;
        const aStart = new Date(a.start_datetime).getTime();
        const aEnd = new Date(a.end_datetime).getTime();
        return start < aEnd && aStart < end;
      }) || null;
    } catch (err) {
      // Si no se puede consultar, se deja guardar: el aviso es una ayuda, no un requisito.
      console.error("No se pudo chequear superposición", err);
      return null;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.patient_id || !form.service_id || !form.start_datetime) return;
    setSaving(true);
    try {
      const patient = patients.find((p) => p.id === form.patient_id);
      const service = services.find((s) => s.id === form.service_id);
      // `services` viene filtrado por activos (loadData), así que al editar una cita vieja
      // cuyo servicio fue dado de baja esto quedaba en `undefined` y reventaba con un
      // TypeError sin catch: el diálogo se quedaba abierto, sin mensaje, y la cita no se
      // guardaba nunca.
      if (!service) {
        setConflict("El servicio de esta cita ya no está activo. Elegí otro para poder guardar.");
        setSaving(false);
        return;
      }
      const end = calcEnd(form.start_datetime, service.duration_minutes);

      // Primer intento: si se pisa con otra cita, se avisa y se corta acá. El segundo click
      // (con el aviso ya en pantalla) guarda igual.
      if (!conflict) {
        const clash = await findOverlap(new Date(form.start_datetime).toISOString(), end);
        if (clash) {
          const hora = new Date(clash.start_datetime).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
          setConflict(`Se superpone con ${clash.patient_name || "otro turno"} (${clash.service_name || "turno"}) a las ${hora}.`);
          setSaving(false);
          return;
        }
      }

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
        // El origen se fija UNA sola vez, al crear. Al editar se conserva el que ya tenía:
        // antes este mismo payload se usaba también para el update, así que abrir una cita
        // que había entrado por el link público o por WhatsApp y tocarle cualquier cosa la
        // reescribía como "manual" y se perdía de dónde había salido. Eso no es cosmético:
        // autoCompleteAppointments trata distinto a las manuales que a las automáticas.
        origin: appointment?.origin || "manual",
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
            // professional_id explicito: sin esto, publicReview cae a created_by_id, y si
            // la cita la cierra un profesional INVITADO la pagina publica de la resena sale
            // sin nombre de consultorio ni color de marca.
            professional_id: appointment?.professional_id || payload.professional_id || undefined,
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
        } catch (e) {
          // Antes esto era un catch vacio: si fallaba, el profesional veia "guardado" y la
          // solicitud de resena simplemente no existia, sin ninguna senal. La cita ya quedo
          // completada igual, asi que esto avisa sin deshacer nada.
          console.error("ReviewRequest.create error:", e);
          toast({
            title: "La cita se guardó, pero no se creó la solicitud de reseña",
            description: "Podés crearla a mano desde Reseñas.",
            variant: "destructive",
          });
        }
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
              <Select value={form.service_id} onValueChange={(v) => { setConflict(null); setForm({ ...form, service_id: v }); }}>
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
                <Select value={form.professional_ref_id || OWNER_VALUE} onValueChange={(v) => { setConflict(null); setForm({ ...form, professional_ref_id: v === OWNER_VALUE ? "" : v }); }}>
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
                // Cambiar la hora invalida el aviso ya aceptado: si no, aceptar una
                // superposición y después mover el turno a otro horario que también choca lo
                // guardaría sin avisar nada.
                onChange={(e) => { setConflict(null); setForm({ ...form, start_datetime: e.target.value }); }}
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

            {conflict && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">{conflict}</p>
                  <p className="text-amber-800/90 mt-0.5">Si querés igual, volvé a tocar Guardar.</p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {conflict ? "Guardar igual" : appointment ? "Guardar" : "Crear cita"}
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
