// Contenido de la campaña de email marketing durante el trial de 14 días.
// Cada paso (0 a 7) corresponde a un día del trial: 0, 2, 4, 6, 8, 10, 12, 14.
// Fórmula fija por email: beneficio de negocio + instrucción técnica concreta + un solo CTA.
// El objetivo final de TODOS los emails es que el usuario termine adhiriéndose a un plan pago.

// "Pacientes/clientes/consultantes" según el rubro, para que el copy se sienta específico
// sin tener que escribir 15 variantes de cada email. Solo cubre los valores del enum real
// de PracticeSettings.professional_type (ver Base44:list_entity_schemas).
const PATIENT_LABEL: Record<string, string> = {
  dentist: "pacientes",
  psychologist: "consultantes",
  doctor: "pacientes",
  physiotherapist: "pacientes",
  nutritionist: "pacientes",
  dermatologist: "pacientes",
  pediatrician: "pacientes",
  gynecologist: "pacientes",
  cardiologist: "pacientes",
  ophthalmologist: "pacientes",
  speech_therapist: "pacientes",
  occupational_therapist: "pacientes",
  podiatrist: "pacientes",
  veterinarian: "pacientes",
  other: "clientes",
};

export function getPatientLabel(professionalType?: string): string {
  return PATIENT_LABEL[professionalType || "other"] || "clientes";
}

export interface TrialEmailContent {
  subject: string;
  title: string;
  lines: string[];
  primaryButton: { label: string; path: string };
}

export interface TrialEmailCtx {
  name: string;
  patientLabel: string;
}

// 8 pasos = 8 emails, cada 2 días, del día 0 (bienvenida) al día 14 (último día de trial).
// El día real lo determina el "wait" del workflow, no este archivo.
export function getTrialCampaignStep(step: number, ctx: TrialEmailCtx): TrialEmailContent | null {
  const { name, patientLabel } = ctx;

  const steps: TrialEmailContent[] = [
    // Día 0 — Bienvenida + activación rápida
    {
      subject: "Bienvenido a Kame Agenda 👋 arrancá en 5 minutos",
      title: "Tu recepcionista virtual ya está lista",
      lines: [
        `Hola ${name}, ¡bienvenido a Kame Agenda! Arrancó tu prueba gratis de 14 días, sin tarjeta y sin compromiso.`,
        "La idea es simple: que tu agenda se llene sola, incluso cuando no podés atender el teléfono.",
        `Para eso, lo primero es armar tu perfil y tu página pública de reservas — es lo que van a ver tus ${patientLabel} para sacar un turno con vos.`,
      ],
      primaryButton: { label: "Configurar mi perfil", path: "/profile-editor" },
    },
    // Día 2 — Página de reservas + servicios
    {
      subject: `Así reservan turno tus ${patientLabel}, sin llamarte`,
      title: "Tu página de reservas, lista para compartir",
      lines: [
        "Cada turno que se agenda solo es una llamada menos que atender y un hueco menos en tu agenda.",
        "Para que tu página funcione de verdad, necesita tus servicios cargados: qué ofrecés, cuánto dura cada consulta y el precio.",
        "Andá a Configuración → Servicios y cargalos en un par de minutos. Cuanto más completos estén, menos preguntas te van a hacer antes de reservar.",
      ],
      primaryButton: { label: "Cargar mis servicios", path: "/configuracion" },
    },
    // Día 4 — Bot de WhatsApp (momento "aha")
    {
      subject: "La función que más tiempo te va a ahorrar",
      title: "Un asistente que responde por WhatsApp, las 24 horas",
      lines: [
        "Esta es la parte que más sorprende: un bot con inteligencia artificial que responde consultas, ofrece horarios disponibles y agenda solo, sin que estés pendiente del celular.",
        `Funciona de noche, los fines de semana o mientras atendés a otro ${patientLabel.slice(0, -1)} — justo los momentos en los que hoy se te escapan turnos.`,
        "Probalo ahora mismo simulando una conversación real, con tus propios servicios y horarios, para ver exactamente cómo respondería.",
      ],
      primaryButton: { label: "Probar el bot", path: "/bot" },
    },
    // Día 6 — Recordatorios automáticos (reduce ausentismo)
    {
      subject: "Cuántos turnos perdés por olvido (y cómo evitarlo)",
      title: "Recordatorios automáticos = menos ausencias",
      lines: [
        "El ausentismo es uno de los costos más silenciosos de cualquier consultorio: un turno vacío es tiempo que no se recupera.",
        `Con tu prueba ya tenés recordatorios automáticos por email antes de cada cita, para que tus ${patientLabel} no se olviden.`,
        "Un dato: los que además mandan el recordatorio por WhatsApp (plan Pro) ven bastante menos inasistencia — se abre mucho más rápido que un email.",
      ],
      primaryButton: { label: "Ver mi agenda", path: "/agenda" },
    },
    // Día 8 — Reportes / gestión (genera confianza en el valor de largo plazo)
    {
      subject: "Lo que todavía no viste de tu consultorio",
      title: "Números que te ayudan a decidir mejor",
      lines: [
        "Además de agendar, Kame Agenda te muestra qué está pasando en tu consultorio: cuántas citas tuviste, qué servicios se piden más y cómo evoluciona tu ocupación.",
        "Es información que normalmente llevás en la cabeza o en una libreta, y acá la tenés de un vistazo para decidir mejor sobre precios, horarios o promociones.",
        "Los reportes avanzados y la solicitud automática de reseñas están en los planes superiores — vale la pena explorarlos mientras dure tu prueba.",
      ],
      primaryButton: { label: "Ver mi panel", path: "/" },
    },
    // Día 10 — Comparación explícita de planes (venta directa)
    {
      subject: "Ya viste el potencial. Ahora, elegí cómo seguir",
      title: "Encontrá el plan que se ajusta a tu consultorio",
      lines: [
        "Llevás más de una semana probando Kame Agenda. Antes de que termine tu prueba, te dejamos un resumen rápido:",
        "Básico: página de reservas, agenda y recordatorios por email — ideal si recién empezás.",
        "Pro: suma el bot de WhatsApp con IA respondiendo 24/7, reservas online y recordatorios automáticos por WhatsApp — el más elegido, porque es donde más tiempo se ahorra.",
        "Clinic: para equipos, con más volumen de citas, reportes avanzados y reseñas automáticas.",
      ],
      primaryButton: { label: "Ver planes y precios", path: "/upgrade-plan" },
    },
    // Día 12 — Urgencia suave
    {
      subject: "Quedan 2 días de tu prueba gratis",
      title: "No pierdas lo que ya armaste",
      lines: [
        "Tu prueba gratis termina en 2 días. Después, tu página de reservas, tu bot y tus recordatorios quedan en pausa hasta que elijas un plan.",
        "Ya invertiste tiempo en configurar tu perfil, tus servicios y tus horarios — no tiene sentido perderlo.",
        "Activar un plan te lleva menos de 2 minutos, y podés cambiarlo o cancelarlo cuando quieras, sin penalidades.",
      ],
      primaryButton: { label: "Activar mi plan", path: "/upgrade-plan" },
    },
    // Día 14 — Último día (conversión final)
    {
      subject: "Hoy termina tu prueba gratis",
      title: "Elegí tu plan y seguí sin cortes",
      lines: [
        "Hoy es el último día de tu prueba gratuita de Kame Agenda.",
        `Si no activás un plan, tu página de reservas y tu bot de WhatsApp quedan en pausa — y con eso, la comodidad que le diste a tus ${patientLabel} para agendar solos.`,
        "Elegí el plan que mejor te quede: se puede cambiar o cancelar cuando quieras, sin letra chica.",
      ],
      primaryButton: { label: "Elegir mi plan", path: "/upgrade-plan" },
    },
  ];

  return steps[step] || null;
}

export const TRIAL_CAMPAIGN_TOTAL_STEPS = 8;
