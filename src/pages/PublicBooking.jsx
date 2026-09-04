import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarClock, Clock, ArrowRight, Check, Loader2, Calendar, MapPin, Mail, CalendarX, MessageCircle, Instagram, Facebook, Globe, ExternalLink, Navigation, Star } from "lucide-react";
import { resolveTheme, normalizeSocialUrl, whatsappUrl, googleMapsUrl, googleMapsEmbedSrc, avatarShapeClass, loadThemeFont } from "@/lib/theme-presets";
import PoweredByKame from "@/components/PoweredByKame";
import { mergeOwnedRows } from "@/lib/ownership";

// TODO EL CÁLCULO DE HORARIOS VA ANCLADO A HORA ARGENTINA, no a la del navegador.
//
// Antes acá se usaba `d.setHours()`, `d.getDay()` y `d.getFullYear()` pelados, que trabajan
// en el huso del DISPOSITIVO. Para un paciente en Argentina daba igual, pero para uno que
// reserva desde afuera (o un argentino de viaje) los horarios se corrían varias horas: la
// página le ofrecía "09:00" y en la agenda del profesional el turno caía a las 4 de la
// mañana. El servidor no revalidaba nada, así que eso se aceptaba tal cual.
//
// Desde que `createPublicAppointment` valida con el motor de `shared/scheduling.ts` (que sí
// está anclado a -03:00), esa diferencia dejaba al paciente en un callejón sin salida: veía
// horarios en pantalla y el servidor le rechazaba todos. Estas funciones son la copia
// exacta de las de `scheduling.ts`, para que la página y el servidor cuenten siempre lo
// mismo. Si se cambia una, hay que cambiar la otra.
const AR_TZ = "America/Argentina/Buenos_Aires";

function toDateStr(d) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: AR_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

// Día de la semana (0=domingo..6=sábado) leído en hora argentina. Se arma un instante al
// mediodía argentino (nunca cruza medianoche en UTC) y se lee con getUTCDay(), que no
// depende del huso del proceso.
function argentinaDayOfWeek(date) {
  return new Date(`${toDateStr(date)}T12:00:00-03:00`).getUTCDay();
}

function parseTimeToDate(date, time) {
  const [h, m] = time.split(":").map(Number);
  const hh = String(h).padStart(2, "0");
  const mm = String(m).padStart(2, "0");
  return new Date(`${toDateStr(date)}T${hh}:${mm}:00-03:00`);
}

function argentinaDayBounds(date) {
  const ymd = toDateStr(date);
  return {
    start: new Date(`${ymd}T00:00:00.000-03:00`),
    end: new Date(`${ymd}T23:59:59.999-03:00`),
  };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isBlockedDate(availability, date) {
  const dateStr = toDateStr(date);
  return availability.some((a) => (a.type === "holiday" || a.type === "block") && a.date === dateStr);
}

// professionalRefId: null = horario del dueño de la cuenta (o de un consultorio sin
// equipo). Con un profesional puntual elegido, se usa SOLO el horario que él mismo
// cargó al aceptar su invitación — cada uno con su propia agenda real.
function getWorkRanges(availability, dayOfWeek, professionalRefId) {
  const scoped = availability.filter((a) => (a.professional_ref_id || null) === (professionalRefId || null));
  const work = scoped.filter((a) => a.type === "work" && a.day_of_week === dayOfWeek);
  if (work.length) return work.map((w) => ({ start: w.start_time, end: w.end_time })).sort((a, b) => a.start.localeCompare(b.start));
  const hasAnyWorkConfigured = scoped.some((a) => a.type === "work");
  if (!hasAnyWorkConfigured && !professionalRefId && dayOfWeek >= 1 && dayOfWeek <= 5) return [{ start: "09:00", end: "18:00" }];
  return [];
}

function getBreakRanges(availability, dayOfWeek, professionalRefId) {
  return availability
    .filter((a) => (a.professional_ref_id || null) === (professionalRefId || null))
    .filter((a) => a.type === "break" && a.day_of_week === dayOfWeek)
    .map((b) => ({ start: b.start_time, end: b.end_time }));
}

function generateSlots(date, service, availability, appointments, professionalRefId, googleBusy) {
  if (!service) return [];
  if (isBlockedDate(availability, date)) return [];
  const dayOfWeek = argentinaDayOfWeek(date);
  const workRanges = getWorkRanges(availability, dayOfWeek, professionalRefId);
  const breakRanges = getBreakRanges(availability, dayOfWeek, professionalRefId);
  if (!workRanges.length) return [];

  const { start: dayStart, end: dayEnd } = argentinaDayBounds(date);
  // Los choques de horario se chequean SOLO contra las citas de ESE profesional puntual
  // (o, sin preferencia, contra las del dueño) — dos personas del equipo pueden tener
  // turnos a la misma hora sin pisarse.
  const booked = appointments.filter((a) => {
    if (a.status === "cancelled") return false;
    if ((a.professional_ref_id || null) !== (professionalRefId || null)) return false;
    const s = new Date(a.start_datetime);
    return s >= dayStart && s <= dayEnd;
  });
  const busyRanges = (googleBusy || []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));

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
      const overlapsGoogle = busyRanges.some((b) => rangesOverlap(slotStart, slotEnd, b.start, b.end));
      const inPast = slotStart.getTime() < Date.now();
      if (!overlapsBreak && !overlapsBooked && !overlapsGoogle && !inPast) slots.push(slotStart);
      cursor = new Date(cursor.getTime() + step * 60000);
    }
  }
  return slots;
}

// Los horarios se MUESTRAN también en hora argentina, que es la del consultorio. Sin el
// timeZone explícito, alguien reservando desde afuera veía la hora traducida a su huso y
// creía estar sacando turno a las 09:00 cuando en el consultorio eran otras.
function formatSlot(d) {
  return d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: AR_TZ });
}

function formatLongDate(d) {
  return d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: AR_TZ });
}

function buildWaMessage(service, date, slot, form) {
  return `Hola, quiero agendar una cita de ${service?.name} para el ${date ? formatLongDate(date) : ""} a las ${slot ? formatSlot(slot) : ""}. Mi nombre es ${form.first_name} ${form.last_name}. Te escribo por acá para confirmar el turno lo antes posible, ¡gracias!`;
}

// --- Sub-componentes de presentación (reutilizados en el layout desktop y mobile) -------

// Header con foto/portada: la foto va con position:absolute + z-index alto + overflow
// visible en el contenedor, así queda SIEMPRE integrada sobre la portada sin cortes,
// sin importar bordes redondeados del contenedor de la tarjeta. La forma del avatar
// (círculo / cuadrado redondeado / recto) se deriva del radio del tema, ya no hay un
// selector manual de "marco". bleed=true quita el chrome de tarjeta (usado en mobile).
// IMPORTANTE: sin portada subida, NO se pinta ninguna franja de color por defecto (esa
// franja "fantasma" con gradiente del acento fue un bug: el brief pide que sin portada
// el fondo plano del tema ocupe todo el espacio). La única excepción es align="banner",
// donde el usuario elige explícitamente un banner destacado con el acento del tema.
function ProfileHeader({ settings, theme, brand, cardClass, glassStyle, align, size = 96, rounded = "rounded-t-3xl", headingFontStyle, bleed = false }) {
  const frameClass = avatarShapeClass(theme.avatarRadiusClass);
  const isBanner = align === "banner";
  const hasCover = !!settings?.cover_image_url || isBanner;
  const alignClass = align === "left" ? "justify-start" : "justify-center";
  const textAlignClass = align === "left" ? "text-left items-start" : "text-center items-center";
  const half = size / 2;
  const coverHeight = isBanner ? "h-40" : "h-28";
  const photoTopOffset = isBanner ? 160 : 112;
  const curvedBottom = theme.curved && bleed && hasCover ? { borderBottomLeftRadius: "50% 24px", borderBottomRightRadius: "50% 24px" } : {};

  const avatarNode = settings?.photo_url ? (
    <img
      src={settings.photo_url}
      alt={settings.practice_name}
      className={`object-cover block ${frameClass}`}
      style={{ width: size, height: size, boxShadow: hasCover ? `0 0 0 4px ${theme.bg && theme.bg.startsWith("linear") ? theme.cardBg : theme.bg}${theme.neon ? `, 0 0 24px ${brand}66` : ""}` : (theme.neon ? `0 0 24px ${brand}66` : undefined) }}
    />
  ) : (
    <div
      className={`flex items-center justify-center text-2xl font-heading font-bold ${frameClass}`}
      style={{ width: size, height: size, background: theme.accentCss, color: theme.accentText, boxShadow: hasCover ? `0 0 0 4px ${theme.bg && theme.bg.startsWith("linear") ? theme.cardBg : theme.bg}` : undefined }}
    >
      {(settings?.practice_name || "?")[0]?.toUpperCase()}
    </div>
  );

  if (!hasCover) {
    return (
      <div className={bleed ? "" : `border overflow-hidden ${cardClass}`} style={bleed ? {} : { background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
        <div className={`${bleed ? "px-5" : "px-6"} pt-6 pb-5 flex flex-col ${textAlignClass}`}>
          <div className={`flex w-full ${alignClass}`}>{avatarNode}</div>
          <h1 className="text-2xl font-bold font-heading leading-tight mt-3" style={{ color: theme.text, ...headingFontStyle }}>{settings?.practice_name || "Reservá tu turno"}</h1>
          {settings?.specialty && <p className="text-sm mt-1" style={{ color: theme.muted, opacity: 0.85 }}>{settings.specialty}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={bleed ? "" : `border overflow-hidden ${cardClass}`} style={bleed ? {} : { background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
      <div className="relative" style={{ overflow: "visible" }}>
        <div
          className={`${coverHeight} overflow-hidden ${bleed ? "" : rounded}`}
          style={{
            background: settings?.cover_image_url ? `url(${settings.cover_image_url}) center ${settings?.cover_align || "center"}/cover` : `linear-gradient(135deg, ${theme.accentCss}, ${theme.accent}55)`,
            ...curvedBottom,
          }}
        >
          {settings?.cover_image_url && <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)" }} />}
        </div>
        <div className={`absolute left-0 right-0 px-6 flex z-20 ${alignClass}`} style={{ top: `${photoTopOffset - half}px` }}>
          {avatarNode}
        </div>
      </div>
      <div className={`${bleed ? "px-5" : "px-6"} pb-5 flex flex-col ${textAlignClass}`} style={{ paddingTop: `${half + 12}px` }}>
        <h1 className="text-2xl font-bold font-heading leading-tight" style={{ color: theme.text, ...headingFontStyle }}>{settings?.practice_name || "Reservá tu turno"}</h1>
        {settings?.specialty && <p className="text-sm mt-1" style={{ color: theme.muted, opacity: 0.85 }}>{settings.specialty}</p>}
      </div>
    </div>
  );
}

// Descripción "Sobre mí": va sin caja/tarjeta propia, como texto suelto debajo del
// encabezado — antes vivía adentro de InfoBlock con su propio fondo de tarjeta, lo que
// sumaba una caja más a una página que ya tenía demasiadas superficies distintas.
function DescriptionBlock({ theme, settings, headingFontStyle }) {
  if (!settings?.description) return null;
  return (
    <div>
      <h2 className="text-base font-heading font-semibold mb-2" style={{ color: theme.text, ...headingFontStyle }}>Sobre mí</h2>
      <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>{settings.description}</p>
    </div>
  );
}

function ContactBlock({ theme, settings, igUrl, fbUrl, webUrl, waUrl, mapsUrl, cardClass, glassStyle, headingFontStyle }) {
  const hasAny = settings?.address || settings?.phone || settings?.professional_email || fbUrl || igUrl || webUrl;
  const rowStyle = { borderBottom: `1px solid ${theme.cardBorder}` };
  return (
    <div className="space-y-1">
      <h2 className="text-base font-heading font-semibold mb-2" style={{ color: theme.text, ...headingFontStyle }}>Contacto y ubicación</h2>
      {(settings?.phone || settings?.professional_email || fbUrl || igUrl || webUrl) && (
        <div>
          {waUrl && (
            <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3.5 hover:opacity-70 transition-opacity" style={rowStyle}>
              <MessageCircle className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm" style={{ color: theme.text }}>{settings.phone} · WhatsApp</p>
            </a>
          )}
          {settings?.professional_email && (
            <a href={`mailto:${settings.professional_email}`} className="flex items-center gap-3 py-3.5 hover:opacity-70 transition-opacity" style={rowStyle}>
              <Mail className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm truncate" style={{ color: theme.text }}>{settings.professional_email}</p>
            </a>
          )}
          {igUrl && (
            <a href={igUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3.5 hover:opacity-70 transition-opacity" style={rowStyle}>
              <Instagram className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm" style={{ color: theme.text }}>Instagram</p>
            </a>
          )}
          {fbUrl && (
            <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3.5 hover:opacity-70 transition-opacity" style={rowStyle}>
              <Facebook className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm" style={{ color: theme.text }}>Facebook</p>
            </a>
          )}
          {webUrl && (
            <a href={webUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-3.5 hover:opacity-70 transition-opacity" style={settings?.address ? rowStyle : undefined}>
              <Globe className="w-4 h-4 shrink-0" style={{ color: theme.muted }} />
              <p className="text-sm truncate" style={{ color: theme.text }}>Sitio web</p>
            </a>
          )}
        </div>
      )}
      {settings?.address && (
        <div className="pt-1">
          <div className="py-3.5 flex items-start gap-3">
            <MapPin className="w-4 h-4 shrink-0 mt-0.5" style={{ color: theme.muted }} />
            <p className="text-sm" style={{ color: theme.text }}>{[settings.address, settings.address_city, settings.address_province].filter(Boolean).join(", ")}</p>
          </div>
          <iframe
            title="Ubicación"
            className={`w-full h-44 border-0 ${theme.radiusClass}`}
            loading="lazy"
            src={googleMapsEmbedSrc({ address: settings.address, city: settings.address_city, province: settings.address_province, lat: settings.address_lat, lng: settings.address_lng })}
          />
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-1.5 py-3 mt-1 text-sm font-semibold hover:opacity-70 transition-opacity" style={{ color: theme.accent }}>
            <Navigation className="w-3.5 h-3.5" /> Cómo llegar <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
      {!hasAny && <p className="text-sm text-center py-6" style={{ color: theme.muted }}>Sin datos de contacto cargados.</p>}
    </div>
  );
}

function ReviewStars({ rating, color }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} className="w-3.5 h-3.5" style={{ color }} fill={n <= rating ? color : "none"} strokeWidth={1.5} />
      ))}
    </div>
  );
}

// Reseñas reales de pacientes (ReviewRequest.status="received"), traídas por la función
// pública getPublicReviews (ReviewRequest tiene lectura restringida por RLS, así que no se
// puede leer directo desde el cliente anónimo). Sección opcional: el profesional la
// prende/apaga desde el editor (settings.show_reviews_public).
function ReviewsBlock({ theme, reviews, cardClass, glassStyle, headingFontStyle }) {
  if (!reviews?.length) return null;
  return (
    <div>
      <h2 className="text-base font-heading font-semibold mb-2" style={{ color: theme.text, ...headingFontStyle }}>Reseñas de pacientes</h2>
      <div>
        {reviews.map((r, i) => (
          <div key={r.id} className="flex gap-3 py-4" style={i < reviews.length - 1 ? { borderBottom: `1px solid ${theme.cardBorder}` } : undefined}>
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-heading font-bold text-sm shrink-0" style={{ background: theme.accentCss, color: theme.accentText }}>
              {(r.name || "?")[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold" style={{ color: theme.text, ...headingFontStyle }}>{r.name}</p>
                <ReviewStars rating={r.rating} color={theme.accent} />
              </div>
              {r.service_name && <p className="text-xs mt-0.5" style={{ color: theme.muted }}>{r.service_name}</p>}
              {r.comment && <p className="text-sm mt-1.5 leading-relaxed" style={{ color: theme.muted }}>{r.comment}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Id sintético de la opción "el dueño del consultorio" en el selector de profesional. No
// existe como ficha en Professional: al agendar se traduce a professional_ref_id vacío.
const OWNER_OPTION_ID = "__owner__";

export default function PublicBooking() {
  const { handle } = useParams();
  const cleanHandle = (handle || "").replace(/^@/, "");
  const [settings, setSettings] = useState(null);
  const [services, setServices] = useState([]);
  const [professionals, setProfessionals] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [googleBusy, setGoogleBusy] = useState([]);
  const [availability, setAvailability] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [reviews, setReviews] = useState([]);

  // Ancla para el botón flotante "Agendar cita": hace scroll directo al flujo de
  // reserva (que ahora vive en el mismo flujo de la página, ya no detrás de una pestaña).
  const bookingRef = useRef(null);
  const scrollToBooking = () => bookingRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  const [step, setStep] = useState(1);
  const [service, setService] = useState(null);
  const [selectedPro, setSelectedPro] = useState(null); // null = sin preferencia / dueño de la cuenta
  const [date, setDate] = useState(null);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ first_name: "", last_name: "", phone: "", email: "" });
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState(null);
  const [bookingError, setBookingError] = useState(null);

  const professionalId = settings?.created_by_id || null;
  const hasProfessionals = professionals.length > 0;

  // El dueño del consultorio NO tiene ficha en Professional (vive en PracticeSettings), así
  // que el selector mostraba solo al equipo invitado y él quedaba afuera de su propia
  // página de reservas. Acá se lo antepone como PRIMERA opción, con su nombre.
  //
  // No es una ficha real: es una opción de la lista que se mapea a professional_ref_id
  // vacío, que es exactamente como el sistema representa al dueño en todos lados (agenda,
  // horarios, servicios, disponibilidad). Crear una ficha de verdad habría sumado al
  // conteo de profesionales que decide el adicional de $10.000/mes y habría creado dos
  // formas distintas de decir "el dueño" en los selectores internos.
  const bookableProfessionals = useMemo(() => {
    if (professionals.length === 0) return [];
    return [
      {
        id: OWNER_OPTION_ID,
        first_name: (settings?.practice_name || "").trim() || "Titular",
        last_name: "",
        specialty: settings?.specialty || "",
      },
      ...professionals,
    ];
  }, [professionals, settings]);

  // null = el dueño de la cuenta. Es el valor que entienden generateSlots,
  // createPublicAppointment y toda la lógica de disponibilidad.
  const selectedProRefId = selectedPro && selectedPro.id !== OWNER_OPTION_ID ? selectedPro.id : null;

  // Numeración de pasos dinámica: si hay equipo, "Elegí profesional" se inserta después
  // del servicio y todo lo demás se corre un lugar.
  const STEPS = hasProfessionals
    ? [{ num: 1, label: "Servicio" }, { num: 2, label: "Profesional" }, { num: 3, label: "Fecha y hora" }, { num: 4, label: "Tus datos" }, { num: 5, label: "Confirmar" }]
    : [{ num: 1, label: "Servicio" }, { num: 2, label: "Fecha y hora" }, { num: 3, label: "Tus datos" }, { num: 4, label: "Confirmar" }];
  const PRO_STEP = hasProfessionals ? 2 : null;
  const DATE_STEP = hasProfessionals ? 3 : 2;
  const DATA_STEP = hasProfessionals ? 4 : 3;
  const CONFIRM_STEP = hasProfessionals ? 5 : 4;
  const SUCCESS_STEP = hasProfessionals ? 6 : 5;

  const themeForFont = resolveTheme(settings?.theme_preset, settings?.page_color, {
    fontOverride: settings?.heading_font_override,
  });
  useEffect(() => {
    if (themeForFont.googleFont) loadThemeFont(themeForFont.googleFont);
  }, [themeForFont.googleFont]);

  useEffect(() => {
    (async () => {
      try {
        // Antes esto leía la entidad PracticeSettings directo. Como esa entidad tiene
        // lectura pública, ese mismo permiso dejaba que cualquiera pidiera la tabla entera:
        // los 68 campos de TODOS los consultorios, con emails, teléfonos, plan contratado y
        // el id de suscripción de Mercado Pago. getPublicProfile devuelve solo los campos
        // que esta página pinta, y solo de un consultorio publicado.
        const profRes = await base44.functions.invoke("getPublicProfile", { handle: cleanHandle });
        const s = profRes?.data?.profile;
        if (!s) { setNotFound(true); return; }
        setSettings(s);
        const pid = s.created_by_id;
        // Los servicios se piden por los DOS campos de propiedad y se unen por id: los
        // creados por el onboarding llevan practice_owner_id (created_by_id es el id del
        // servidor, ver base44/shared/ownership.ts) y los anteriores solo created_by_id.
        // Los horarios se leen igual que los servicios, por los DOS campos: leerlos solo
        // por practice_owner_id dejaba a las cuentas anteriores con la lista vacía, y la
        // página caía al horario por defecto L-V 09-18 ofreciendo turnos inexistentes.
        const [servsOwned, servsLegacy, availOwned, availLegacy, profs] = await Promise.all([
          base44.entities.Service.filter({ practice_owner_id: pid, active: true }),
          base44.entities.Service.filter({ created_by_id: pid, active: true }),
          base44.entities.Availability.filter({ practice_owner_id: pid }),
          base44.entities.Availability.filter({ created_by_id: pid }),
          s.plan === "clinic" ? base44.entities.Professional.filter({ practice_owner_id: pid, active: true }) : Promise.resolve([]),
        ]);
        setServices(mergeOwnedRows(servsOwned, servsLegacy, pid));
        setAvailability(mergeOwnedRows(availOwned, availLegacy, pid));
        setProfessionals((profs || []).filter((p) => p.invite_status !== "pending" && p.first_name));
        if (s.show_reviews_public !== false) {
          try {
            const revRes = await base44.functions.invoke("getPublicReviews", { professional_id: pid });
            setReviews(revRes?.data?.reviews || []);
          } catch {
            setReviews([]);
          }
        }
        try {
          const now = argentinaStartOfDay(new Date());
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
    const base = argentinaStartOfDay(new Date());
    const proId = selectedProRefId;
    for (let i = 0; i < 21; i++) {
      const d = new Date(base.getTime() + i * 86400000);
      if (getWorkRanges(availability, argentinaDayOfWeek(d), proId).length && !isBlockedDate(availability, d)) days.push(d);
    }
    return days;
  }, [availability, selectedPro]);

  const slots = useMemo(() => {
    if (!date || !service) return [];
    return generateSlots(date, service, availability, appointments, selectedProRefId, googleBusy);
  }, [date, service, availability, appointments, selectedPro, googleBusy]);

  useEffect(() => {
    if (!professionalId) return;
    (async () => {
      try {
        const now = argentinaStartOfDay(new Date());
        const toDate = new Date(now.getTime() + 21 * 86400000);
        const res = await base44.functions.invoke('getGoogleBusySlots', {
          professional_id: professionalId,
          professional_ref_id: selectedProRefId || undefined,
          date_from: now.toISOString(),
          date_to: toDate.toISOString(),
        });
        setGoogleBusy(res?.data?.busy || []);
      } catch {
        setGoogleBusy([]);
      }
    })();
  }, [professionalId, selectedPro]);

  const handleConfirm = useCallback(async () => {
    if (!service || !slot || !form.first_name || !form.last_name || !form.phone || !form.email || !professionalId) return;
    setSaving(true);
    setBookingError(null);
    try {
      const res = await base44.functions.invoke("createPublicAppointment", {
        professional_id: professionalId,
        professional_ref_id: selectedProRefId || undefined,
        service_id: service.id,
        start_datetime: slot.toISOString(),
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
        email: form.email,
      });
      setCreated({ appointment: res.data.appointment, patient: res.data.patient });
      setStep(SUCCESS_STEP);
    } catch (err) {
      const message = err?.response?.data?.message || err?.response?.data?.error || "No se pudo confirmar el turno. Probá de nuevo.";
      setBookingError(message);
      setSlot(null);
      setStep(DATE_STEP);
      try {
        const now = argentinaStartOfDay(new Date());
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
  }, [service, slot, form, professionalId, selectedPro, DATE_STEP, SUCCESS_STEP]);

  const theme = resolveTheme(settings?.theme_preset, settings?.page_color, {
    fontOverride: settings?.heading_font_override,
    custom: { borderRadius: settings?.custom_border_radius, avatarBorderRadius: settings?.avatar_border_radius },
  });

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
  const igUrl = normalizeSocialUrl(settings?.instagram_url, "instagram");
  const fbUrl = normalizeSocialUrl(settings?.facebook_url, "facebook");
  const webUrl = normalizeSocialUrl(settings?.website_url, "website");
  const waUrl = whatsappUrl(settings?.phone);
  const mapsUrl = googleMapsUrl(settings?.address, settings?.address_city, settings?.address_province);
  const glassStyle = theme.glass ? { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } : {};
  const cardClass = `${theme.cardClass || ""} ${theme.radiusClass || "rounded-2xl"}`;
  const cardStyle = { background: theme.cardBg, borderColor: theme.cardBorder, color: theme.text, ...glassStyle };

  const primaryBtnStyle = {
    background: theme.accentCss,
    color: theme.accentText,
    boxShadow: theme.neon ? theme.neonGlow : undefined,
  };

  // Campos y botones secundarios SIEMPRE claros, con texto oscuro propio.
  //
  // Los componentes <Input> y <Button variant="outline"> de la app usan bg-transparent y
  // heredan el color de texto del tema de la APLICACIÓN (oscuro). En una página pública con
  // tema oscuro (Executive Gold, OLED Obsidian, etc.) eso daba texto oscuro sobre fondo
  // oscuro: los recuadros de datos y el botón "Cambiar fecha u hora" quedaban ilegibles.
  // Fijándolos acá se ven igual de bien en los ocho temas, sin tocar los componentes
  // compartidos (que en el resto de la app funcionan bien).
  const fieldStyle = {
    background: "#FFFFFF",
    color: "#0F172A",
    borderColor: "#CBD5E1",
  };
  // Las etiquetas sí acompañan al tema: sobre fondo oscuro tienen que ser claras.
  const labelStyle = { color: theme.text };

  const BookingSteps = (
    <>
      {step < CONFIRM_STEP && (
        <div className="flex items-start justify-center gap-1 mb-6">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.num}>
              <div className="flex flex-col items-center gap-1.5 w-20">
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors"
                  style={step >= s.num ? { background: theme.accentCss, color: theme.accentText } : { background: theme.chipBg || "#e2e8f0", color: theme.muted }}
                >
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </span>
                <span className="text-[10px] font-medium text-center leading-tight" style={{ color: step >= s.num ? theme.text : theme.muted }}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex-1 h-px mt-4 mx-1" style={{ background: step > s.num ? theme.accent : theme.cardBorder }} />
              )}
            </React.Fragment>
          ))}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <h2 className="font-heading font-semibold text-lg" style={{ color: theme.text }}>Elegí el servicio</h2>
          {services.length === 0 ? (
            <div className={`p-8 text-center space-y-3 border border-dashed ${theme.radiusClass}`} style={{ borderColor: theme.cardBorder }}>
              <CalendarX className="w-12 h-12 mx-auto opacity-40" style={{ color: theme.muted }} />
              <div>
                <p className="font-medium" style={{ color: theme.text }}>Todavía no hay servicios disponibles</p>
                <p className="text-sm mt-1" style={{ color: theme.muted }}>Contactate directamente con el profesional para coordinar tu cita.</p>
              </div>
            </div>
          ) : (
            <div>
              {services.map((s, i) => (
                <button
                  key={s.id}
                  onClick={() => { setService(s); setStep(hasProfessionals ? PRO_STEP : DATE_STEP); }}
                  className="group w-full text-left py-3.5 hover:opacity-70 transition-opacity cursor-pointer flex items-center justify-between"
                  style={i < services.length - 1 ? { borderBottom: `1px solid ${theme.cardBorder}` } : undefined}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-1 h-10 rounded-full shrink-0" style={{ background: s.color || brand }} />
                    <div className="min-w-0">
                      <p className="font-semibold truncate" style={{ color: theme.text, fontFamily: theme.headingFont || undefined }}>{s.name}</p>
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
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" style={{ color: theme.muted }} />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {hasProfessionals && step === PRO_STEP && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold" style={{ color: theme.text }}>Elegí con quién agendar</h2>
            <button className="text-sm hover:underline" style={{ color: theme.muted }} onClick={() => setStep(1)}>Cambiar servicio</button>
          </div>
          <div className="space-y-2">
            {bookableProfessionals.map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedPro(p); setDate(null); setSlot(null); setStep(DATE_STEP); }}
                className={`w-full text-left p-3.5 border flex items-center gap-3 transition-colors hover:opacity-70 ${theme.radiusClass}`}
                style={{ borderColor: theme.cardBorder, color: theme.text }}
              >
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-semibold text-sm shrink-0" style={{ background: `${brand}20`, color: brand }}>
                  {p.first_name?.[0]?.toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate" style={{ color: theme.text }}>{p.first_name} {p.last_name}</p>
                  {p.specialty && <p className="text-xs truncate" style={{ color: theme.muted }}>{p.specialty}</p>}
                </div>
              </button>
            ))}
            {/* Antes acá había un botón "No tengo preferencia" que agendaba con
                professional_ref_id vacío — o sea, exactamente con el dueño. Ahora que el
                dueño figura arriba con su nombre, ese botón hacía literalmente lo mismo que
                la primera opción de la lista y solo confundía. */}
          </div>
        </div>
      )}

      {step === DATE_STEP && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold" style={{ color: theme.text }}>Elegí fecha y hora</h2>
            <button className="text-sm hover:underline" style={{ color: theme.muted }} onClick={() => setStep(hasProfessionals ? PRO_STEP : 1)}>Atrás</button>
          </div>
          {bookingError && (
            <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">
              {bookingError}
            </div>
          )}
          <div>
            <p className="text-xs mb-2 flex items-center gap-1" style={{ color: theme.muted }}>
              <Calendar className="w-3.5 h-3.5" /> {service?.name}{selectedPro ? ` · ${selectedPro.first_name}` : ""}
            </p>
            <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
              {upcomingDays.map((d) => {
                const selected = date && isSameArgentinaDay(d, date);
                return (
                  <button key={d.toISOString()} onClick={() => { setDate(d); setSlot(null); setBookingError(null); }} className={`p-2 border text-center transition-colors ${theme.radiusClass}`} style={selected ? { background: theme.accentCss, borderColor: brand, color: theme.accentText } : { borderColor: theme.cardBorder, color: theme.text }}>
                    <p className="text-xs capitalize opacity-70">{d.toLocaleDateString("es-AR", { weekday: "short", timeZone: AR_TZ })}</p>
                    <p className="font-medium text-sm">{Number(toDateStr(d).slice(-2))}</p>
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
                    <button key={s.toISOString()} onClick={() => { setSlot(s); setBookingError(null); }} className={`p-2 border text-sm transition-colors ${theme.radiusClass}`} style={slot && slot.toISOString() === s.toISOString() ? { background: theme.accentCss, borderColor: brand, color: theme.accentText } : { borderColor: theme.cardBorder, color: theme.text }}>{formatSlot(s)}</button>
                  ))}
                </div>
              )}
            </div>
          )}
          <Button className="w-full font-semibold" style={primaryBtnStyle} disabled={!slot} onClick={() => setStep(DATA_STEP)}>Continuar</Button>
        </div>
      )}

      {step === DATA_STEP && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold" style={{ color: theme.text }}>Tus datos</h2>
            <button className="text-sm hover:underline" style={{ color: theme.muted }} onClick={() => setStep(DATE_STEP)}>Atrás</button>
          </div>
          <div className="text-sm pb-3" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}>
            <p className="font-medium" style={{ color: theme.text }}>{service?.name}{selectedPro ? ` con ${selectedPro.first_name}` : ""}</p>
            <p className="capitalize" style={{ color: theme.muted }}>{date && formatLongDate(date)} · {slot && formatSlot(slot)}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2"><Label htmlFor="first_name" style={labelStyle}>Nombre *</Label><Input id="first_name" style={fieldStyle} value={form.first_name} onChange={(e) => setForm({ ...form, first_name: e.target.value })} required /></div>
            <div className="space-y-2"><Label htmlFor="last_name" style={labelStyle}>Apellido *</Label><Input id="last_name" style={fieldStyle} value={form.last_name} onChange={(e) => setForm({ ...form, last_name: e.target.value })} required /></div>
          </div>
          <div className="space-y-2"><Label htmlFor="phone" style={labelStyle}>Teléfono (WhatsApp) *</Label><Input id="phone" style={fieldStyle} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+54 9 11 1234 5678" required /></div>
          <div className="space-y-2"><Label htmlFor="email" style={labelStyle}>Email *</Label><Input id="email" type="email" style={fieldStyle} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></div>
          <Button className="w-full font-semibold" style={primaryBtnStyle} disabled={!form.first_name || !form.last_name || !form.phone || !form.email} onClick={() => setStep(CONFIRM_STEP)}>
            Continuar
          </Button>
        </div>
      )}

      {step === CONFIRM_STEP && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-heading font-semibold" style={{ color: theme.text }}>Revisá tu reserva</h2>
            <button className="text-sm hover:underline" style={{ color: theme.muted }} onClick={() => setStep(DATA_STEP)}>Atrás</button>
          </div>
          <div className="space-y-2 text-sm pb-2">
            <div className="flex justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}><span style={{ color: theme.muted }}>Servicio</span><span className="font-medium text-right" style={{ color: theme.text }}>{service?.name}</span></div>
            {selectedPro && <div className="flex justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}><span style={{ color: theme.muted }}>Con</span><span className="font-medium text-right" style={{ color: theme.text }}>{selectedPro.first_name} {selectedPro.last_name}</span></div>}
            <div className="flex justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}><span style={{ color: theme.muted }}>Fecha</span><span className="font-medium capitalize" style={{ color: theme.text }}>{date && formatLongDate(date)}</span></div>
            <div className="flex justify-between gap-2 py-1.5" style={{ borderBottom: `1px solid ${theme.cardBorder}` }}><span style={{ color: theme.muted }}>Hora</span><span className="font-medium" style={{ color: theme.text }}>{slot && formatSlot(slot)}</span></div>
            <div className="flex justify-between gap-2 py-1.5"><span style={{ color: theme.muted }}>A nombre de</span><span className="font-medium text-right" style={{ color: theme.text }}>{form.first_name} {form.last_name}</span></div>
          </div>
          <div className="flex flex-col gap-2">
            <Button variant="outline" className="w-full" style={fieldStyle} onClick={() => setStep(DATE_STEP)}>
              ← Cambiar fecha u hora
            </Button>
            <Button className="w-full font-semibold" style={primaryBtnStyle} disabled={saving} onClick={handleConfirm}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Confirmar
            </Button>
          </div>
        </div>
      )}

      {step === SUCCESS_STEP && created && (() => {
        const waNumber = (settings?.zernio_phone || settings?.phone || "").replace(/\D/g, "");
        const waMsg = buildWaMessage(service, date, slot, form);
        const confirmWaUrl = `https://wa.me/${waNumber}?text=${encodeURIComponent(waMsg)}`;
        // Si la cita ya vino CONFIRMADA (planes Pro/Clinic con WhatsApp conectado: el
        // backend ya le mandó la confirmación por WhatsApp al paciente), no tiene sentido
        // pedirle ADEMÁS que aprete un botón para escribirle al profesional — ya le queda
        // abierta la conversación para responder ese mismo mensaje si necesita algo. El
        // botón manual solo se muestra cuando la cita queda pendiente de confirmación.
        const isAutoConfirmed = created.appointment?.status === "confirmed";
        return (
          <div className="text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto"><Check className="w-7 h-7 text-emerald-600" /></div>
            <h2 className="font-heading font-semibold text-lg" style={{ color: theme.text }}>{isAutoConfirmed ? "¡Turno confirmado!" : "¡Solicitud registrada!"}</h2>
            <p className="text-sm" style={{ color: theme.muted }}>{service?.name}{selectedPro ? ` con ${selectedPro.first_name}` : ""}</p>
            <p className="font-medium capitalize" style={{ color: theme.text }}>{date && formatLongDate(date)} · {slot && formatSlot(slot)}</p>
            <p className="text-sm" style={{ color: theme.muted }}>{settings?.practice_name || "Consultorio"}{settings?.address ? ` · ${settings.address}` : ""}</p>
            {isAutoConfirmed ? (
              <p className="text-sm pt-1" style={{ color: theme.muted }}>Te mandamos los detalles de tu cita por WhatsApp. Si necesitás reagendar o cancelar, respondé ese mismo mensaje.</p>
            ) : waNumber ? (
              <>
                <p className="text-sm pt-1" style={{ color: theme.muted }}>Escribile al profesional por WhatsApp para confirmar tu turno cuanto antes. Si no se abrió solo, usá este botón:</p>
                <a href={confirmWaUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 w-full rounded-md bg-[#25D366] hover:bg-[#1ebe5d] text-white font-semibold text-sm h-11 px-4 py-2 transition-colors shadow-sm">
                  <MessageCircle className="w-5 h-5" /> Confirmar por WhatsApp
                </a>
              </>
            ) : (
              <p className="text-sm pt-1" style={{ color: theme.muted }}>El profesional confirmará tu turno. Guardá esta referencia: <span className="font-mono">{created.appointment.id.slice(-8)}</span></p>
            )}
            <Button variant="outline" className="mt-2" style={fieldStyle} onClick={() => { setStep(1); setService(null); setSelectedPro(null); setDate(null); setSlot(null); setForm({ first_name: "", last_name: "", phone: "", email: "" }); setCreated(null); }}>Reservar otro turno</Button>
            <PoweredByKame variant="card" utm="booking_success" className="mt-5 text-left sm:text-center" />
          </div>
        );
      })()}
    </>
  );

  const NEUTRAL_MARGIN = theme.isDark ? "#0B0B0D" : "#EDEDEF";

  return (
    <div className="min-h-screen w-full flex flex-col" style={{ background: NEUTRAL_MARGIN }}>
      {/* Columna central única: en escritorio ocupa 70% del ancho con 15% de margen
          neutro de cada lado (antes era un grid de 55%/45% info | agendar en dos
          columnas separadas). En mobile ocupa el 100%, sin margen visible. */}
      <div className="relative flex-1 w-full lg:w-[70%] lg:mx-[15%]" style={{ background: theme.bg }}>
        <ProfileHeader settings={settings} theme={theme} brand={brand} cardClass={cardClass} glassStyle={glassStyle} align={settings?.photo_align} size={148} headingFontStyle={headingFontStyle} bleed />
        <div className="px-5 pb-28 pt-5 max-w-xl mx-auto space-y-7">
          <DescriptionBlock theme={theme} settings={settings} headingFontStyle={headingFontStyle} />
          <div ref={bookingRef} style={{ scrollMarginTop: 24 }}>
            {BookingSteps}
          </div>
          <ContactBlock theme={theme} settings={settings} igUrl={igUrl} fbUrl={fbUrl} webUrl={webUrl} waUrl={waUrl} mapsUrl={mapsUrl} cardClass={cardClass} glassStyle={glassStyle} headingFontStyle={headingFontStyle} />
          <ReviewsBlock theme={theme} reviews={reviews} cardClass={cardClass} glassStyle={glassStyle} headingFontStyle={headingFontStyle} />
        </div>
      </div>

      {/* Botón flotante "Agendar cita": fijo a la ventana (no al contenedor con margen),
          centrado dentro del mismo ancho de columna que el contenido. Lleva directo al
          flujo de reserva en vez de depender de una pestaña. Se oculta ya reservado el
          turno (SUCCESS_STEP), donde no aporta nada más. */}
      {step !== SUCCESS_STEP && (
        <div className="fixed bottom-0 left-0 right-0 z-40 flex justify-center px-4 pb-4" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}>
          <div className="w-full max-w-xl">
            <button
              onClick={scrollToBooking}
              className={`w-full flex items-center justify-center gap-2 py-3.5 text-sm font-bold transition-transform hover:scale-[1.01] ${theme.radiusClass}`}
              style={{ background: theme.accentCss, color: theme.accentText, boxShadow: theme.neon ? theme.neonGlow : "0 10px 28px rgba(0,0,0,0.22)" }}
            >
              <Calendar className="w-4 h-4" /> Agendar cita
            </button>
          </div>
        </div>
      )}

      {/* El botón flotante "Agendar cita" es fixed y ocupa los últimos ~64px de la
          pantalla, así que sin este espacio extra el pie queda TAPADO por el botón y no se
          ve nunca (salvo en SUCCESS_STEP, donde el botón desaparece). */}
      <div className="shrink-0" style={{ paddingBottom: step !== SUCCESS_STEP ? "calc(4.5rem + env(safe-area-inset-bottom, 0px))" : 0 }}>
        <PoweredByKame utm="booking_footer" color={theme.muted} />
      </div>
    </div>
  );
}
