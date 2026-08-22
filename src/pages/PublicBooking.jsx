import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Clock, ArrowRight, Check, Loader2, Calendar, MapPin, Mail, CalendarX, MessageCircle, Instagram, Facebook, Globe, ExternalLink, Navigation } from "lucide-react";
import { resolveTheme, normalizeSocialUrl, whatsappUrl, googleMapsUrl, googleMapsEmbedSrc, PHOTO_FRAME_CLASS, THEME_PRESETS, loadThemeFont } from "@/lib/theme-presets";

function parseTimeToDate(date, time) {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function isBlockedDate(availability, date) {
  const dateStr = toDateStr(date);
  return availability.some((a) => (a.type === "holiday" || a.type === "block") && a.date === dateStr);
}

function getWorkRanges(availability, dayOfWeek) {
  const work = availability.filter((a) => a.type === "work" && a.day_of_week === dayOfWeek);
  if (work.length) return work.map((w) => ({ start: w.start_time, end: w.end_time })).sort((a, b) => a.start.localeCompare(b.start));
  const hasAnyWorkConfigured = availability.some((a) => a.type === "work");
  if (!hasAnyWorkConfigured && dayOfWeek >= 1 && dayOfWeek <= 5) return [{ start: "09:00", end: "18:00" }];
  return [];
}

function getBreakRanges(availability, dayOfWeek) {
  return availability.filter((a) => a.type === "break" && a.day_of_week === dayOfWeek).map((b) => ({ start: b.start_time, end: b.end_time }));
}

function generateSlots(date, service, availability, appointments) {
  if (!service) return [];
  if (isBlockedDate(availability, date)) return [];
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

// --- Sub-componentes de presentación (reutilizados en el layout desktop y mobile) -------

// Header con foto/portada: la foto va con position:absolute + z-index alto + overflow
// visible en el contenedor, así queda SIEMPRE integrada sobre la portada sin cortes,
// sin importar bordes redondeados del contenedor de la tarjeta. Si photo_frame === "none"
// (el usuario desactivó la foto), el <img>/fallback NO se renderiza en absoluto.
function ProfileHeader({ settings, theme, brand, frameClass, cardClass, glassStyle, align, size = 96, rounded = "rounded-t-3xl", headingFontStyle }) {
  const showPhoto = settings?.photo_frame !== "none";
  const alignClass = align === "left" ? "justify-start" : align === "right" ? "justify-end" : "justify-center";
  const textAlignClass = align === "left" ? "text-left items-start" : align === "right" ? "text-right items-end" : "text-center items-center";
  const half = size / 2;

  return (
    <div className={`rounded-3xl border overflow-hidden ${cardClass}`} style={{ background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
      {/* Contenedor relativo con overflow visible: la foto puede sobresalir sin cortarse */}
      <div className="relative" style={{ overflow: "visible" }}>
        <div
          className={`h-28 overflow-hidden ${rounded}`}
          style={{ background: settings?.cover_image_url ? `url(${settings.cover_image_url}) center ${settings?.cover_align || "center"}/cover` : `linear-gradient(135deg, ${brand}, ${brand}55)` }}
        >
          {settings?.cover_image_url && <div className="absolute inset-0 bg-black/25" />}
        </div>
        {showPhoto && (
          <div className={`absolute left-0 right-0 px-6 flex z-20 ${alignClass}`} style={{ top: `${112 - half}px` }}>
            {settings?.photo_url ? (
              <img
                src={settings.photo_url}
                alt={settings.practice_name}
                className={`object-cover block ${frameClass}`}
                style={{ width: size, height: size, boxShadow: `0 0 0 4px ${theme.cardBg}${theme.neon ? `, 0 0 24px ${brand}66` : ""}` }}
              />
            ) : (
              <div
                className={`flex items-center justify-center text-2xl font-heading font-bold ${frameClass}`}
                style={{ width: size, height: size, background: brand, color: theme.accentText, boxShadow: `0 0 0 4px ${theme.cardBg}` }}
              >
                {(settings?.practice_name || "?")[0]?.toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>
      <div className={`px-6 pb-6 flex flex-col ${textAlignClass}`} style={{ paddingTop: showPhoto ? `${half + 12}px` : "24px" }}>
        <h1 className="text-2xl font-bold font-heading leading-tight" style={{ color: theme.text, ...headingFontStyle }}>{settings?.practice_name || "Reservá tu turno"}</h1>
        {settings?.specialty && <p className="text-sm mt-1" style={{ color: theme.muted }}>{settings.specialty}</p>}
      </div>
    </div>
  );
}

function InfoBlock({ theme, settings, igUrl, fbUrl, webUrl, waUrl, mapsUrl, cardClass, glassStyle }) {
  const hasAny = settings?.description || settings?.address || settings?.phone || settings?.professional_email || fbUrl || igUrl || webUrl;
  const rowStyle = { borderBottom: `1px solid ${theme.cardBorder}` };
  return (
    <div className="space-y-3">
      {settings?.description && (
        <div className={`rounded-2xl border p-4 ${cardClass}`} style={{ background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
          <p className="text-sm leading-relaxed" style={{ color: theme.text }}>{settings.description}</p>
        </div>
      )}
      {(settings?.phone || settings?.professional_email || fbUrl || igUrl || webUrl) && (
        <div className={`rounded-2xl border overflow-hidden ${cardClass}`} style={{ background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3.5 hover:opacity-80 transition-opacity" style={rowStyle}>
              <MessageCircle className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm" style={{ color: theme.text }}>{settings.phone} · WhatsApp</p>
            </a>
          )}
          {settings?.professional_email && (
            <a href={`mailto:${settings.professional_email}`} className="flex items-center gap-3 px-4 py-3.5 hover:opacity-80 transition-opacity" style={rowStyle}>
              <Mail className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm truncate" style={{ color: theme.text }}>{settings.professional_email}</p>
            </a>
          )}
          {igUrl && (
            <a href={igUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3.5 hover:opacity-80 transition-opacity" style={rowStyle}>
              <Instagram className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm" style={{ color: theme.text }}>Instagram</p>
            </a>
          )}
          {fbUrl && (
            <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3.5 hover:opacity-80 transition-opacity" style={rowStyle}>
              <Facebook className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm" style={{ color: theme.text }}>Facebook</p>
            </a>
          )}
          {webUrl && (
            <a href={webUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 px-4 py-3.5 hover:opacity-80 transition-opacity">
              <Globe className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm truncate" style={{ color: theme.text }}>Sitio web</p>
            </a>
          )}
        </div>
      )}
      {settings?.address && (
        <div className={`rounded-2xl border overflow-hidden ${cardClass}`} style={{ background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
          <div className="px-4 py-3.5 flex items-start gap-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.muted }} />
            <p className="text-sm" style={{ color: theme.text }}>{[settings.address, settings.address_city, settings.address_province].filter(Boolean).join(", ")}</p>
          </div>
          <iframe
            title="Ubicación"
            className="w-full h-44 border-0"
            loading="lazy"
            src={googleMapsEmbedSrc({ address: settings.address, city: settings.address_city, province: settings.address_province, lat: settings.address_lat, lng: settings.address_lng })}
          />
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-semibold hover:opacity-80 transition-opacity" style={{ borderTop: `1px solid ${theme.cardBorder}`, color: theme.accent }}>
            <Navigation className="w-3.5 h-3.5" /> Cómo llegar <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
      {!hasAny && <p className="text-sm text-center py-6" style={{ color: theme.muted }}>Sin datos de contacto cargados.</p>}
    </div>
  );
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
  const [tab, setTab] = useState("agendar"); // solo se usa en mobile

  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  const professionalId = settings?.created_by_id || null;

  // Cada tema puede traer su propia tipografía de encabezado (Google Font) — se carga
  // solo la que hace falta, una vez que sabemos qué tema tiene el consultorio.
  useEffect(() => {
    const preset = THEME_PRESETS[settings?.theme_preset];
    if (preset?.googleFont) loadThemeFont(preset.googleFont);
  }, [settings?.theme_preset]);

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
      if (getWorkRanges(availability, d.getDay()).length && !isBlockedDate(availability, d)) days.push(d);
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
    setBookingError(null);
    try {
      const res = await base44.functions.invoke("createPublicAppointment", {
        professional_id: professionalId,
        service_id: service.id,
        start_datetime: slot.toISOString(),
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        email: form.email,
      });
      setCreated({ appointment: res.data.appointment, patient: res.data.patient });
      setStep(5);
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || "No se pudo confirmar el turno. Probá de nuevo.";
      setBookingError(message);
      setSlot(null);
      setStep(2);
      try {
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const toDate = new Date(now.getTime() + 21 * 86400000);
        const refreshed = await base44.functions.invoke("getBookedSlots", {
          professional_id: professionalId,
          date_from: now.toISOString(),
          date_to: toDate.toISOString(),
        });
        setAppointments(refreshed?.data?.slots || []);
      } catch {
        // si falla el refresco, igual dejamos ver el mensaje de error al usuario
      }
    } finally {
      setSaving(false);
    }
  }, [service, slot, form, professionalId]);

  const theme = resolveTheme(settings?.theme_preset || "clean_dark", settings?.page_color);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B132B]">
        <div className="w-8 h-8 border-4 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0B132B] px-4 text-center">
        <div>
          <CalendarClock className="w-10 h-10 text-white/40 mx-auto mb-3" />
          <p className="font-heading font-semibold text-white">No se encontró el profesional</p>
          <p className="text-sm text-white/50 mt-1">El enlace no es válido o la página está desactivada.</p>
        </div>
      </div>
    );
  }

  const brand = theme.accent;
  const headingFontStyle = theme.headingFont ? { fontFamily: theme.headingFont } : {};
  const showFullPhotoBackdrop = theme.photoBackdrop && !!settings?.cover_image_url;
  const igUrl = normalizeSocialUrl(settings?.instagram_url, "instagram");
  const fbUrl = normalizeSocialUrl(settings?.facebook_url, "facebook");
  const webUrl = normalizeSocialUrl(settings?.website_url, "website");
  const waUrl = whatsappUrl(settings?.phone);
  const mapsUrl = googleMapsUrl(settings?.address, settings?.address_city, settings?.address_province);
  const frameClass = PHOTO_FRAME_CLASS[settings?.photo_frame] || PHOTO_FRAME_CLASS.circle;
  const glassStyle = theme.glass ? { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } : {};
  const cardClass = theme.cardClass || "";
  const cardStyle = { background: theme.cardBg, borderColor: theme.cardBorder, color: theme.text, ...glassStyle };

  const primaryBtnStyle = {
    backgroundColor: brand,
    color: theme.accentText,
    boxShadow: theme.neon ? theme.neonGlow : undefined,
  };

  // ---- Contenido de reserva (pasos), reutilizado en mobile (bajo tab) y desktop (columna fija) ----
  const BookingSteps = (
    <>
      {step < 4 && (
        <div className="flex items-start justify-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center gap-1.5 w-20">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
                  style={step >= s.num ? { backgroundColor: brand, color: theme.accentText } : { background: theme.chipBg || "#e2e8f0", color: theme.muted }}
                >
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </span>
                <span className="text-[10px] font-medium text-center leading-tight" style={{ color: step >= s.num ? theme.text : theme.muted }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mt-4 mx-1" style={{ background: step > s.num ? brand : theme.cardBorder }} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-lg" style={{ color: theme.text }}>Elegí el servicio</h2>
          {services.length === 0 ? (
            <div className={`p-8 text-center space-y-3 rounded-2xl border border-dashed ${cardClass}`} style={cardStyle}>
              <CalendarX className="w-12 h-12 mx-auto opacity-40" style={{ color: theme.muted }} />
              <div>
                <p className="font-medium" style={{ color: theme.text }}>Todavía no hay servicios disponibles</p>
                <p className="text-sm mt-1" style={{ color: theme.muted }}>Contactate directamente con el profesional para coordinar tu cita.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              {services.map((s) => (
                <button
                  key={s.id}
                  onClick={() => { setService(s); setStep(2); }}
                  className={`group w-full text-left p-4 rounded-xl border-2 hover:shadow-md transition-all cursor-pointer flex items-center justify-between ${cardClass}`}
                  style={{ ...cardStyle, borderColor: theme.cardBorder }}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1.5 h-12 rounded-full shrink-0" style={{ background: s.color || brand }} />
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: theme.text }}>{s.name}</p>
                      {s.description && <p className="text-xs truncate" style={{ color: theme.muted }}>{s.description}</p>}
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs flex items-center gap-1" style={{ color: theme.muted }}>
                          <Clock className="w-3.5 h-3.5" /> {s.duration_minutes} min
                        </span>
                        {s.price != null && (
                          <span className="text-xs font-semibold" style={{ color: theme.text }}>${s.price.toLocaleString("es-AR")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" style={{ color: theme.muted }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 2 && (
        <div className={`rounded-2xl border p-5 space-y-4 ${cardClass}`} style={cardStyle}>
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold" style={{ color: theme.text }}>Elegí fecha y hora</h2>
            <button className="text-sm hover:underline" style={{ color: theme.muted }} onClick={() => setStep(1)}>Cambiar servicio</button>
          </div>
          {bookingError && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
              {bookingError}
            </div>
          )}
          <div>
            <p className="text-xs mb-2 flex items-center gap-1" style={{ color: theme.muted }}><Calendar className="w-3.5 h-3.5" /> {service?.name}</p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {upcomingDays.map((d) => {
                const selected = date && d.toDateString() === date.toDateString();
                return (
                  <button key={d.toISOString()} onClick={() => { setDate(d); setSlot(null); setBookingError(null); }} className="p-2 rounded-lg border text-center transition-colors" style={selected ? { backgroundColor: brand, borderColor: brand, color: theme.accentText } : { borderColor: theme.cardBorder, color: theme.text }}>
                    <p className="text-xs capitalize opacity-70">{d.toLocaleDateString("es-AR", { weekday: "short" })}</p>
                    <p className="font-medium text-sm">{d.getDate()}</p>
                  </button>
                );
              })}
            </div>
          </div>
          {date && (
            <div>
              <p className="text-sm font-medium mb-2 capitalize" style={{ color: theme.text }}>{formatLongDate(date)}</p>
              {slots.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: theme.muted }}>No hay horarios disponibles este día.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                  {slots.map((s) => (
                    <button key={s.toISOString()} onClick={() => { setSlot(s); setBookingError(null); }} className="p-2 rounded-lg border text-sm transition-colors" style={slot && slot.toISOString() === s.toISOString() ? { backgroundColor: brand, borderColor: brand, color: theme.accentText } : { borderColor: theme.cardBorder, color: theme.text }}>{formatSlot(s)}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button className="w-full font-semibold" style={primaryBtnStyle} disabled={!slot} onClick={() => setStep(3)}>Continuar</Button>
        </div>
      )}

      {step === 3 && (
        <div className={`rounded-2xl border p-5 space-y-4 ${cardClass}`} style={cardStyle}>
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold" style={{ color: theme.text }}>Tus datos</h2>
            <button className="text-sm hover:underline" style={{ color: theme.muted }} onClick={() => setStep(2)}>Atrás</button>
          </div>
          <div className="rounded-lg p-3 text-sm" style={{ background: theme.chipBg || "#f8fafc", color: theme.text }}>
            <p className="font-medium">{service?.name}</p>
            <p className="capitalize" style={{ color: theme.muted }}>{date && formatLongDate(date)} · {slot && formatSlot(slot)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="first_name">Nombre *</Label><Input id="first_name" value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="last_name">Apellido *</Label><Input id="last_name" value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="phone">Teléfono (WhatsApp) *</Label><Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+54 9 11 1234 5678" required /></div>
          <div className="space-y-2"><Label htmlFor="email">Email *</Label><Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <Button className="w-full font-semibold" style={primaryBtnStyle} disabled={!form.first_name || !form.last_name || !form.phone || !form.email} onClick={() => setStep(4)}>
            Continuar
          </Button>
        </div>
      )}

      {step === 4 && (
        <div className={`rounded-2xl border p-5 space-y-4 ${cardClass}`} style={cardStyle}>
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold" style={{ color: theme.text }}>Revisá tu reserva</h2>
            <button className="text-sm hover:underline" style={{ color: theme.muted }} onClick={() => setStep(3)}>Atrás</button>
          </div>
          <div className="rounded-lg p-4 space-y-2 text-sm" style={{ background: theme.chipBg || "#f8fafc" }}>
            <div className="flex justify-between gap-2"><span style={{ color: theme.muted }}>Servicio</span><span className="font-medium text-right" style={{ color: theme.text }}>{service?.name}</span></div>
            <div className="flex justify-between gap-2"><span style={{ color: theme.muted }}>Fecha</span><span className="font-medium capitalize" style={{ color: theme.text }}>{date && formatLongDate(date)}</span></div>
            <div className="flex justify-between gap-2"><span style={{ color: theme.muted }}>Hora</span><span className="font-medium" style={{ color: theme.text }}>{slot && formatSlot(slot)}</span></div>
            <div className="flex justify-between gap-2"><span style={{ color: theme.muted }}>A nombre de</span><span className="font-medium text-right" style={{ color: theme.text }}>{form.first_name} {form.last_name}</span></div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" onClick={() => setStep(2)}>
              ← Cambiar fecha u hora
            </Button>
            <Button className="w-full font-semibold" style={primaryBtnStyle} disabled={saving} onClick={handleConfirm}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </div>
        </div>
      )}

      {step === 5 && created && (() => {
        const waNumber = (settings?.zernio_phone || settings?.phone || "").replace(/\D/g, "");
        const waMsg = buildWaMessage(service, date, slot, form);
        const confirmWaUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
        return (
          <div className={`rounded-2xl border p-6 text-center space-y-3 ${cardClass}`} style={cardStyle}>
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto"><Check className="w-7 h-7 text-emerald-600" /></div>
            <h2 className="font-heading font-semibold text-lg" style={{ color: theme.text }}>¡Solicitud registrada!</h2>
            <p className="text-sm" style={{ color: theme.muted }}>{service?.name}</p>
            <p className="font-medium capitalize" style={{ color: theme.text }}>{date && formatLongDate(date)} · {slot && formatSlot(slot)}</p>
            <p className="text-sm" style={{ color: theme.muted }}>{settings?.practice_name || "Consultorio"}{settings?.address ? ` · ${settings.address}` : ""}</p>
            {waNumber ? (
              <>
                <p className="text-sm pt-1" style={{ color: theme.muted }}>Escribile al profesional por WhatsApp para confirmar tu turno cuanto antes. Si no se abrió solo, usá este botón:</p>
                <a href={confirmWaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm h-11 px-4 py-2 transition-colors shadow-sm">
                  <MessageCircle className="w-5 h-5" /> Confirmar por WhatsApp
                </a>
              </>
            ) : (
              <p className="text-sm pt-1" style={{ color: theme.muted }}>El profesional confirmará tu turno. Guardá esta referencia: <span className="font-mono">{created.appointment.id.slice(-8)}</span></p>
            )}
            <Button variant="outline" className="mt-2" onClick={() => { setStep(1); setService(null); setDate(null); setSlot(null); setForm({ first_name: "", last_name: "", phone: "", email: "" }); setCreated(null); }}>Reservar otro turno</Button>
          </div>
        );
      })()}
    </>
  );

  // Botones Agendar/Información con jerarquía visual distinta: Agendar = relleno con el
  // color de marca (acción principal); Información = outline/fantasma (secundaria).
  const NavButtons = ({ className = "" }) => (
    <div className={`flex items-center gap-2 ${className}`}>
      <button
        onClick={() => setTab("agendar")}
        className="flex-1 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={tab === "agendar" ? { backgroundColor: brand, color: theme.accentText, boxShadow: theme.neon ? theme.neonGlow : "0 2px 8px rgba(0,0,0,0.15)" } : { background: "transparent", color: theme.muted, border: `1px solid ${theme.cardBorder}` }}
      >
        Agendar cita
      </button>
      <button
        onClick={() => setTab("info")}
        className="flex-1 px-4 py-2 rounded-xl text-sm font-medium transition-all border"
        style={tab === "info" ? { borderColor: brand, color: brand, background: `${brand}10` } : { borderColor: theme.cardBorder, color: theme.muted, background: "transparent" }}
      >
        Información
      </button>
    </div>
  );

  return (
    // min-h-screen en el contenedor raíz asegura que el color de fondo del tema cubra
    // toda la pantalla en desktop, sin franja blanca abajo aunque el contenido sea corto.
    <div className="min-h-screen w-full" style={{ background: theme.bg }}>
      {/* ============ DESKTOP (>=1024px): 2 columnas asimétricas, todo visible junto.
          La agenda de la derecha SIEMPRE se ve, incluso mirando "Información" — así nunca
          se pierde el foco de que esta página es para reservar, ni aunque estés leyendo la
          info de contacto. Columna de perfil con ancho fijo generoso para que la portada y
          la foto se vean bien, no aplastadas. ============ */}
      <div className="hidden lg:block max-w-6xl mx-auto px-8 py-10">
        <div className="grid gap-8 items-start" style={{ gridTemplateColumns: "420px 1fr" }}>
          {/* Columna Perfil */}
          <div className="space-y-4 lg:sticky lg:top-8">
            <ProfileHeader settings={settings} theme={theme} brand={brand} frameClass={frameClass} cardClass={cardClass} glassStyle={glassStyle} align={settings?.photo_align} size={104} />
            <NavButtons />
            {tab === "info" && <InfoBlock theme={theme} settings={settings} igUrl={igUrl} fbUrl={fbUrl} webUrl={webUrl} waUrl={waUrl} mapsUrl={mapsUrl} cardClass={cardClass} glassStyle={glassStyle} />}
          </div>

          {/* Columna Reserva: siempre presente */}
          <div>{BookingSteps}</div>
        </div>
      </div>

      {/* ============ MOBILE (<1024px): 1 columna ============ */}
      <div className="lg:hidden max-w-md mx-auto px-4 py-5 space-y-4">
        <ProfileHeader settings={settings} theme={theme} brand={brand} frameClass={frameClass} cardClass={cardClass} glassStyle={glassStyle} align={settings?.photo_align} size={88} />
        <NavButtons />
        {tab === "info" ? (
          <InfoBlock theme={theme} settings={settings} igUrl={igUrl} fbUrl={fbUrl} webUrl={webUrl} waUrl={waUrl} mapsUrl={mapsUrl} cardClass={cardClass} glassStyle={glassStyle} />
        ) : BookingSteps}
      </div>
    </div>
  );
}
