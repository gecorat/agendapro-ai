import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CalendarClock, Clock, ArrowRight, Check, Loader2, Calendar, MapPin } from "lucide-react";

function parseTimeToDate(date, time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function getWorkRanges(availability, dayOfWeek) {
  const work = availability.filter((a) => a.type === "work" && a.day_of_week === dayOfWeek);
  if (work.length) return work.map((w) => ({ start: w.start_time, end: w.end_time })).sort((a, b) => a.start.localeCompare(b.start));
  if (dayOfWeek >= 1 && dayOfWeek <= 5) return [{ start: "09:00", end: "18:00" }];
  return [];
}

function getBreakRanges(availability, dayOfWeek) {
  return availability.filter((a) => a.type === "break" && a.day_of_week === dayOfWeek).map((b) => ({ start: b.start_time, end: b.end_time }));
}

function generateSlots(date, service, availability, appointments) {
  if (!service) return [];
  const dayOfWeek = date.getDay();
  const workRanges = getWorkRanges(availability, dayOfWeek);
  const breakRanges = getBreakRanges(availability, dayOfWeek);
  if (!workRanges.length) return [];

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
  const booked = appointments.filter((a) => {
    if (a.status === "cancelled") return false;
    const s = new Date(a.start_datetime);
    return s >= dayStart && s <= dayEnd;
  });

  const duration = service.duration_minutes || 30;
  const margin = service.margin_minutes || 0;
  const step = duration + margin;
  const slots = [];

  for (const range of workRanges) {
    let cursor = parseTimeToDate(date, range.start);
    const rangeEnd = parseTimeToDate(date, range.end);
    while (cursor.getTime() + duration * 60000 <= rangeEnd.getTime()) {
      const slotStart = new Date(cursor);
      const slotEnd = new Date(cursor.getTime() + duration * 60000);
      const overlapsBreak = breakRanges.some((br) => rangesOverlap(slotStart, slotEnd, parseTimeToDate(date, br.start), parseTimeToDate(date, br.end)));
      const overlapsBooked = booked.some((a) => rangesOverlap(slotStart, slotEnd, new Date(a.start_datetime), new Date(a.end_datetime)));
      const inPast = slotStart.getTime() < Date.now();
      if (!overlapsBreak && !overlapsBooked && !inPast) slots.push(slotStart);
      cursor = new Date(cursor.getTime() + step * 60000);
    }
  }
  return slots;
}

function formatSlot(d) {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatLongDate(d) {
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
}

export default function PublicBooking() {
  const { handle } = useParams();
  const cleanHandle = (handle || "").replace(/^@/, "");
  const [settings, setSettings] = useState(null);
  const [services, setServices] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);

  const professionalId = settings?.created_by_id || null;

  useEffect(() => {
    (async () => {
      try {
        const settingsList = await base44.entities.PracticeSettings.filter({ handle: cleanHandle });
        const s = settingsList?.[0];
        if (!s || s.published === false) { setNotFound(true); return; }
        setSettings(s);
        const pid = s.created_by_id;
        const [servs, avail] = await Promise.all([
          base44.entities.Service.filter({ created_by_id: pid, active: true }),
          base44.entities.Availability.filter({ created_by_id: pid }),
        ]);
        setServices(servs || []);
        setAvailability(avail || []);
        // Appointments may be restricted by RLS for public users; fetch separately so it never blocks the page
        try {
          const appts = await base44.entities.Appointment.filter({ created_by_id: pid });
          setAppointments(appts || []);
        } catch {
          setAppointments([]);
        }
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [cleanHandle]);

  const upcomingDays = useMemo(() => {
    const days = [];
    const base = new Date(); base.setHours(0, 0, 0, 0);
    for (let i = 0; i < 21; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      if (getWorkRanges(availability, d.getDay()).length) days.push(d);
    }
    return days;
  }, [availability]);

  const slots = useMemo(() => {
    if (!date || !service) return [];
    return generateSlots(date, service, availability, appointments);
  }, [date, service, availability, appointments]);

  const handleConfirm = useCallback(async () => {
    if (!service || !slot || !form.first_name || !form.phone || !professionalId) return;
    setSaving(true);
    try {
      const end = new Date(slot.getTime() + (service.duration_minutes || 30) * 60000);
      const existing = await base44.entities.Patient.filter({ phone: form.phone, professional_id: professionalId });
      let patient = existing?.[0];
      if (!patient) {
        patient = await base44.entities.Patient.create({
          first_name: form.first_name, last_name: form.last_name, phone: form.phone, email: form.email,
          contact_preference: "whatsapp", consent_reminders: true, professional_id: professionalId,
        });
      }
      const appt = await base44.entities.Appointment.create({
        patient_id: patient.id, patient_name: `${patient.first_name} ${patient.last_name || ""}`.trim(),
        service_id: service.id, service_name: service.name,
        start_datetime: slot.toISOString(), end_datetime: end.toISOString(),
        status: "pending", origin: "public_link", professional_id: professionalId,
      });
      setCreated({ appointment: appt, patient });
      setStep(4);
    } finally {
      setSaving(false);
    }
  }, [service, slot, form, professionalId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-center">
        <div>
          <CalendarClock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-heading font-semibold">No se encontró el profesional</p>
          <p className="text-sm text-muted-foreground mt-1">El enlace no es válido o la página está desactivada.</p>
        </div>
      </div>
    );
  }

  const brand = settings?.page_color || "#0f172a";

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header con color de marca */}
      <div className="w-full" style={{ backgroundColor: brand }}>
        <div className="max-w-lg mx-auto px-4 py-8 text-center text-white">
          {settings?.photo_url && (
            <img src={settings.photo_url} alt={settings.practice_name} className="w-20 h-20 rounded-full object-cover mx-auto mb-3 border-2 border-white/40" />
          )}
          <h1 className="text-xl font-heading font-semibold">{settings?.practice_name || "Reservá tu turno"}</h1>
          {settings?.specialty && <p className="text-sm text-white/80">{settings.specialty}</p>}
          {settings?.address && (
            <p className="text-xs text-white/70 flex items-center justify-center gap-1 mt-1"><MapPin className="w-3 h-3" /> {settings.address}</p>
          )}
          {settings?.description && (
            <p className="text-sm text-white/90 mt-3 max-w-md mx-auto">{settings.description}</p>
          )}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {step < 4 && (
          <div className="flex items-center justify-center gap-2 mb-5 text-xs">
            {[1, 2, 3].map((s) => (
              <React.Fragment key={s}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center ${step >= s ? "text-white" : "bg-slate-200 text-slate-500"}`} style={step >= s ? { backgroundColor: brand } : {}}>
                  {step > s ? <Check className="w-3 h-3" /> : s}
                </span>
                {s < 3 && <div className="w-8 h-px bg-slate-300" />}
              </React.Fragment>
            ))}
          </div>
        )}

        {step === 1 && (
          <Card className="p-5 space-y-3">
            <h2 className="font-heading font-semibold">Elegí el servicio</h2>
            {services.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay servicios disponibles.</p>
            ) : (
              <div className="space-y-2">
                {services.map((s) => (
                  <button key={s.id} onClick={() => { setService(s); setStep(2); }} className="w-full text-left p-4 rounded-lg border-2 border-slate-200 hover:border-slate-400 transition-colors flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-3 h-10 rounded-full" style={{ background: s.color || "#3b82f6" }} />
                      <div>
                        <p className="font-medium">{s.name}</p>
                        {s.description && <p className="text-xs text-muted-foreground">{s.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock className="w-3 h-3" /> {s.duration_minutes} min</p>
                      </div>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground" />
                  </button>
                ))}
              </div>
            )}
          </Card>
        )}

        {step === 2 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">Elegí fecha y hora</h2>
              <button className="text-sm text-muted-foreground hover:underline" onClick={() => setStep(1)}>Cambiar servicio</button>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1"><Calendar className="w-3.5 h-3.5" /> {service?.name}</p>
              <div className="grid grid-cols-4 gap-2">
                {upcomingDays.map((d) => {
                  const selected = date && d.toDateString() === date.toDateString();
                  return (
                    <button key={d.toISOString()} onClick={() => { setDate(d); setSlot(null); }} className={`p-2 rounded-lg border text-center transition-colors ${selected ? "border-transparent text-white" : "border-slate-200 hover:border-slate-400"}`} style={selected ? { backgroundColor: brand } : {}}>
                      <p className="text-xs text-muted-foreground capitalize">{d.toLocaleDateString("es-AR", { weekday: "short" })}</p>
                      <p className="font-medium text-sm">{d.getDate()}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            {date && (
              <div>
                <p className="text-sm font-medium mb-2 capitalize">{formatLongDate(date)}</p>
                {slots.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">No hay horarios disponibles este día.</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slots.map((s) => (
                      <button key={s.toISOString()} onClick={() => setSlot(s)} className={`p-2 rounded-lg border text-sm transition-colors ${slot && slot.toISOString() === s.toISOString() ? "border-transparent text-white" : "border-slate-200 hover:border-slate-400"}`} style={slot && slot.toISOString() === s.toISOString() ? { backgroundColor: brand } : {}}>{formatSlot(s)}</button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <Button className="w-full" style={{ backgroundColor: brand }} disabled={!slot} onClick={() => setStep(3)}>Continuar</Button>
          </Card>
        )}

        {step === 3 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">Tus datos</h2>
              <button className="text-sm text-muted-foreground hover:underline" onClick={() => setStep(2)}>Atrás</button>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 text-sm">
              <p className="font-medium">{service?.name}</p>
              <p className="text-muted-foreground capitalize">{date && formatLongDate(date)} · {slot && formatSlot(slot)}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2"><Label htmlFor="first_name">Nombre *</Label><Input id="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
              <div className="space-y-2"><Label htmlFor="last_name">Apellido</Label><Input id="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="phone">Teléfono (WhatsApp) *</Label><Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+54 9 11 1234 5678" required /></div>
            <div className="space-y-2"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <Button className="w-full" style={{ backgroundColor: brand }} disabled={saving || !form.first_name || !form.phone} onClick={handleConfirm}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Solicitar turno
            </Button>
            <p className="text-xs text-muted-foreground text-center">Tu solicitud será confirmada por el profesional.</p>
          </Card>
        )}

        {step === 4 && created && (
          <Card className="p-6 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto"><Check className="w-7 h-7 text-emerald-600" /></div>
            <h2 className="font-heading font-semibold text-lg">¡Solicitud enviada!</h2>
            <p className="text-sm text-muted-foreground">{service?.name}</p>
            <p className="font-medium capitalize">{date && formatLongDate(date)} · {slot && formatSlot(slot)}</p>
            <p className="text-sm text-muted-foreground">{settings?.practice_name || "Consultorio"}{settings?.address ? ` · ${settings.address}` : ""}</p>
            <p className="text-sm text-muted-foreground pt-2">El profesional confirmará tu turno. Guardá esta referencia: <span className="font-mono">{created.appointment.id.slice(-8)}</span></p>
            <Button variant="outline" className="mt-2" onClick={() => { setStep(1); setService(null); setDate(null); setSlot(null); setForm({ first_name: "", last_name: "", phone: "", email: "" }); setCreated(null); }}>Reservar otro turno</Button>
          </Card>
        )}
      </div>
    </div>
  );
}