import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CalendarClock, Clock, ArrowRight, Check, Loader2, Calendar, MapPin, FileText, Phone, Mail, CalendarX, MessageCircle, Instagram, Facebook } from "lucide-react";
import { Image } from "@/components/ui/image";

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

function buildWaMessage(service, date, slot, form) {
  return `Hola, quiero agendar una cita de ${service?.name} para el ${date ? formatLongDate(date) : ""} a las ${slot ? formatSlot(slot) : ""}. Mi nombre es ${form.first_name} ${form.last_name}. Te escribo por acá para confirmar el turno lo antes posible, ¡gracias!`;
}

const STEPS = [
  { num: 1, label: "Servicio" },
  { num: 2, label: "Fecha y hora" },
  { num: 3, label: "Tus datos" },
  { num: 4, label: "Confirmar" },
];

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
        try {
          const now = new Date(); now.setHours(0, 0, 0, 0);
          const toDate = new Date(now.getTime() + 21 * 86400000);
          const res = await base44.functions.invoke("getBookedSlots", {
            professional_id: pid,
            date_from: now.toISOString(),
            date_to: toDate.toISOString(),
          });
          setAppointments(res?.data?.slots || []);
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
    if (!service || !slot || !form.first_name || !form.last_name || !form.phone || !form.email || !professionalId) return;
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
      setStep(5);
    } finally {
      setSaving(false);
    }
  }, [service, slot, form, professionalId, settings, date]);

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
      {/* Header full-bleed oscuro premium */}
      <div
        className="w-full relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" }}
      >
        <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 18% 50%, white 0%, transparent 55%)" }} />
        <div className="relative px-4 py-5 sm:px-6 sm:py-6 text-white">
          <div className="flex items-start gap-4 sm:gap-6">
            {settings?.photo_url && (
              <Image
                src={settings.photo_url}
                alt={settings.practice_name}
                fittingType="fill"
                className="w-[130px] h-[130px] sm:w-[170px] sm:h-[170px] rounded-2xl overflow-hidden object-cover shadow-xl ring-1 ring-white/15 shrink-0"
              />
            )}
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-heading font-extrabold tracking-tight leading-tight">{settings?.practice_name || "Reservá tu turno"}</h1>
              {settings?.specialty && <p className="text-sm text-white/70 mt-0.5">{settings.specialty}</p>}
              <div className="h-px w-full bg-white/20 my-3" />
              <div className="flex flex-wrap items-start gap-2">
                {settings?.phone && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium">
                    <Phone className="w-3.5 h-3.5 shrink-0" /> {settings.phone}
                  </span>
                )}
                {settings?.address && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium">
                    <MapPin className="w-3.5 h-3.5 shrink-0" /> {settings.address}
                  </span>
                )}
                {settings?.description && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium">
                    <FileText className="w-3.5 h-3.5 shrink-0" /> <span className="line-clamp-1">{settings.description}</span>
                  </span>
                )}
              </div>
              {(settings?.instagram_url || settings?.facebook_url) && (
                <div className="flex flex-wrap items-start gap-2 mt-2">
                  {settings?.instagram_url && (
                    <a href={settings.instagram_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium hover:bg-white/20 transition-colors">
                      <Instagram className="w-3.5 h-3.5 shrink-0" /> Instagram
                    </a>
                  )}
                  {settings?.facebook_url && (
                    <a href={settings.facebook_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 backdrop-blur-sm text-xs font-medium hover:bg-white/20 transition-colors">
                      <Facebook className="w-3.5 h-3.5 shrink-0" /> Facebook
                    </a>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        {/* Stepper con texto descriptivo */}
        {step < 4 && (
          <div className="flex items-start justify-center gap-1 mb-6">
            {STEPS.map((s, i) => (
              <React.Fragment key={s.num}>
                <div className="flex flex-col items-center gap-1.5 w-20">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                      step >= s.num ? "text-white shadow-md" : "bg-slate-200 text-slate-500"
                    }`}
                    style={step >= s.num ? { backgroundColor: brand } : {}}
                  >
                    {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                  </span>
                  <span className={`text-[10px] font-medium text-center leading-tight ${step >= s.num ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-px mt-4 mx-1 ${step > s.num ? "" : "bg-slate-300"}`} style={step > s.num ? { backgroundColor: brand } : {}} />
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-3">
            <h2 className="font-heading font-semibold text-lg">Elegí el servicio</h2>
            {services.length === 0 ? (
              <Card className="p-8 text-center space-y-3 border-dashed">
                <CalendarX className="w-12 h-12 text-muted-foreground/40 mx-auto" />
                <div>
                  <p className="font-medium">Todavía no hay servicios disponibles</p>
                  <p className="text-sm text-muted-foreground mt-1">Contactate directamente con el profesional para coordinar tu cita.</p>
                </div>
                {(settings?.phone || settings?.professional_email) && (
                  <div className="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2">
                    {settings?.phone && (
                      <a href={`tel:${settings.phone}`} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                        <Phone className="w-4 h-4" /> {settings.phone}
                      </a>
                    )}
                    {settings?.professional_email && (
                      <a href={`mailto:${settings.professional_email}`} className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-2 rounded-lg border border-input hover:bg-accent transition-colors">
                        <Mail className="w-4 h-4" /> {settings.professional_email}
                      </a>
                    )}
                  </div>
                )}
              </Card>
            ) : (
              <div className="space-y-2.5">
                {services.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { setService(s); setStep(2); }}
                    className="group w-full text-left p-4 rounded-xl border-2 border-slate-200 hover:border-slate-400 hover:shadow-md transition-all cursor-pointer flex items-center justify-between bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-1.5 h-12 rounded-full shrink-0" style={{ background: s.color || "#3b82f6" }} />
                      <div className="min-w-0">
                        <p className="font-semibold truncate">{s.name}</p>
                        {s.description && <p className="text-xs text-muted-foreground truncate">{s.description}</p>}
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" /> {s.duration_minutes} min
                          </span>
                          {s.price != null && (
                            <span className="text-xs font-semibold text-foreground">${s.price.toLocaleString("es-AR")}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                  </button>
                ))}
              </div>
            )}
          </div>
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
              <div className="space-y-2"><Label htmlFor="last_name">Apellido *</Label><Input id="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
            </div>
            <div className="space-y-2"><Label htmlFor="phone">Teléfono (WhatsApp) *</Label><Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+54 9 11 1234 5678" required /></div>
            <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
            <Button className="w-full" style={{ backgroundColor: brand }} disabled={!form.first_name || !form.last_name || !form.phone || !form.email} onClick={() => setStep(4)}>
              Continuar
            </Button>
          </Card>
        )}

        {step === 4 && (
          <Card className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold">Revisá tu reserva</h2>
              <button className="text-sm text-muted-foreground hover:underline" onClick={() => setStep(3)}>Atrás</button>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Servicio</span><span className="font-medium text-right">{service?.name}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Fecha</span><span className="font-medium capitalize">{date && formatLongDate(date)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">Hora</span><span className="font-medium">{slot && formatSlot(slot)}</span></div>
              <div className="flex justify-between gap-2"><span className="text-muted-foreground">A nombre de</span><span className="font-medium text-right">{form.first_name} {form.last_name}</span></div>
            </div>
            <div className="flex flex-col gap-2">
              <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
                ← Cambiar fecha u hora
              </Button>
              <Button className="w-full" style={{ backgroundColor: brand }} disabled={saving} onClick={handleConfirm}>
                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
              </Button>
            </div>
          </Card>
        )}

        {step === 5 && created && (() => {
          const waNumber = (settings?.zernio_phone || settings?.phone || "").replace(/\D/g, "");
          const waMsg = buildWaMessage(service, date, slot, form);
          const waUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
          return (
            <Card className="p-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto"><Check className="w-7 h-7 text-emerald-600" /></div>
              <h2 className="font-heading font-semibold text-lg">¡Solicitud registrada!</h2>
              <p className="text-sm text-muted-foreground">{service?.name}</p>
              <p className="font-medium capitalize">{date && formatLongDate(date)} · {slot && formatSlot(slot)}</p>
              <p className="text-sm text-muted-foreground">{settings?.practice_name || "Consultorio"}{settings?.address ? ` · ${settings.address}` : ""}</p>
              {waNumber ? (
                <>
                  <p className="text-sm text-muted-foreground pt-1">Escribile al profesional por WhatsApp para confirmar tu turno cuanto antes — mientras antes avises, más rápido te lo confirma. Si no se abrió solo, usá este botón:</p>
                  <a href={waUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm h-11 px-4 py-2 transition-colors shadow-sm">
                    <MessageCircle className="w-5 h-5" /> Confirmar por WhatsApp
                  </a>
                </>
              ) : (
                <p className="text-sm text-muted-foreground pt-1">El profesional confirmará tu turno. Guardá esta referencia: <span className="font-mono">{created.appointment.id.slice(-8)}</span></p>
              )}
              <Button variant="outline" className="mt-2" onClick={() => { setStep(1); setService(null); setDate(null); setSlot(null); setForm({ first_name: "", last_name: "", phone: "", email: "" }); setCreated(null); }}>Reservar otro turno</Button>
            </Card>
          );
        })()}
      </div>
    </div>
  );
}