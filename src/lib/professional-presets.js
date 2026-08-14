export const PROFESSIONAL_TYPES = [
  { value: "dentist", label: "Odontólogo" },
  { value: "psychologist", label: "Psicólogo" },
  { value: "doctor", label: "Médico clínico" },
  { value: "physiotherapist", label: "Fisioterapeuta" },
  { value: "nutritionist", label: "Nutricionista" },
  { value: "dermatologist", label: "Dermatólogo" },
  { value: "pediatrician", label: "Pediatra" },
  { value: "gynecologist", label: "Ginecólogo" },
  { value: "cardiologist", label: "Cardiólogo" },
  { value: "ophthalmologist", label: "Oftalmólogo" },
  { value: "speech_therapist", label: "Fonoaudiólogo" },
  { value: "occupational_therapist", label: "Terapista ocupacional" },
  { value: "podiatrist", label: "Podólogo" },
  { value: "veterinarian", label: "Veterinario" },
  { value: "other", label: "Otro" },
];

// Configuración sugerida por tipo de profesional.
// patientLabel: cómo se llama a los "pacientes" en la app.
// services: servicios sugeridos al configurar por primera vez.
export const PRESETS = {
  dentist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta general", description: "Consulta odontológica de rutina", duration_minutes: 30, margin_minutes: 5, color: "#3b82f6", follow_up_days: 180 },
      { name: "Limpieza dental", description: "Profilaxis y limpieza profesional", duration_minutes: 45, margin_minutes: 10, color: "#10b981", follow_up_days: 180 },
      { name: "Control mensual", description: "Control de seguimiento post-tratamiento", duration_minutes: 20, margin_minutes: 0, color: "#f59e0b", follow_up_days: 30 },
      { name: "Endodoncia", description: "Tratamiento de conducto", duration_minutes: 90, margin_minutes: 15, color: "#ef4444", follow_up_days: 30, prep_notes: "Concurrir con ayuno de 2 horas previas." },
      { name: "Extracción", description: "Extracción dental simple o quirúrgica", duration_minutes: 60, margin_minutes: 15, color: "#8b5cf6", follow_up_days: 7 },
    ],
  },
  psychologist: {
    patientLabel: "Consultantes",
    services: [
      { name: "Sesión individual", description: "Sesión de terapia individual", duration_minutes: 50, margin_minutes: 10, color: "#8b5cf6", follow_up_days: 7 },
      { name: "Sesión de pareja", description: "Terapia de pareja", duration_minutes: 60, margin_minutes: 10, color: "#ec4899", follow_up_days: 7 },
      { name: "Primera entrevista", description: "Entrevista inicial diagnóstica", duration_minutes: 60, margin_minutes: 15, color: "#3b82f6", follow_up_days: 7 },
      { name: "Sesión de devolución", description: "Devolución de evaluación", duration_minutes: 50, margin_minutes: 10, color: "#f59e0b", follow_up_days: 30 },
    ],
  },
  doctor: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta clínica", description: "Consulta médica general", duration_minutes: 30, margin_minutes: 10, color: "#3b82f6", follow_up_days: 30 },
      { name: "Control de seguimiento", description: "Control post-consulta", duration_minutes: 20, margin_minutes: 5, color: "#f59e0b", follow_up_days: 30 },
      { name: "Chequeo anual", description: "Chequeo médico completo", duration_minutes: 60, margin_minutes: 15, color: "#10b981", follow_up_days: 365, prep_notes: "Concurrir con ayuno de 8 horas para análisis." },
      { name: "Certificado médico", description: "Emisión de certificado", duration_minutes: 20, margin_minutes: 5, color: "#64748b", follow_up_days: 0 },
      { name: "Curación", description: "Curación de heridas y suturas", duration_minutes: 30, margin_minutes: 10, color: "#ef4444", follow_up_days: 7 },
    ],
  },
  physiotherapist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Sesión de kinesiología", description: "Sesión de tratamiento", duration_minutes: 45, margin_minutes: 10, color: "#3b82f6", follow_up_days: 7 },
      { name: "Evaluación inicial", description: "Primera evaluación y plan de tratamiento", duration_minutes: 60, margin_minutes: 15, color: "#f59e0b", follow_up_days: 7 },
      { name: "Rehabilitación postquirúrgica", description: "Rehabilitación luego de cirugía", duration_minutes: 60, margin_minutes: 15, color: "#10b981", follow_up_days: 7 },
      { name: "Drenaje linfático", description: "Técnica de drenaje manual", duration_minutes: 45, margin_minutes: 10, color: "#8b5cf6", follow_up_days: 14 },
    ],
  },
  nutritionist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta nutricional", description: "Consulta inicial y plan alimentario", duration_minutes: 45, margin_minutes: 10, color: "#10b981", follow_up_days: 30 },
      { name: "Seguimiento", description: "Control de seguimiento del plan", duration_minutes: 30, margin_minutes: 5, color: "#f59e0b", follow_up_days: 30 },
      { name: "Antropometría", description: "Evaluación de composición corporal", duration_minutes: 40, margin_minutes: 10, color: "#3b82f6", follow_up_days: 90, prep_notes: "Concurrir con ropa cómoda y sin haber comido en la última hora." },
      { name: "Plan deportivo", description: "Plan nutricional para deportistas", duration_minutes: 60, margin_minutes: 10, color: "#8b5cf6", follow_up_days: 30 },
    ],
  },
  dermatologist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta dermatológica", description: "Evaluación de piel, pelo y uñas", duration_minutes: 30, margin_minutes: 10, color: "#3b82f6", follow_up_days: 90 },
      { name: "Control de lunares", description: "Mapeo y control de lesiones cutáneas", duration_minutes: 30, margin_minutes: 10, color: "#f59e0b", follow_up_days: 180 },
      { name: "Limpieza facial", description: "Limpieza profunda y extracciones", duration_minutes: 45, margin_minutes: 10, color: "#10b981", follow_up_days: 90 },
      { name: "Crioterapia", description: "Tratamiento con frío para lesiones", duration_minutes: 20, margin_minutes: 5, color: "#8b5cf6", follow_up_days: 30 },
    ],
  },
  pediatrician: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta pediátrica", description: "Consulta y evaluación infantil", duration_minutes: 30, margin_minutes: 10, color: "#3b82f6", follow_up_days: 30 },
      { name: "Control de niño sano", description: "Control de crecimiento y desarrollo", duration_minutes: 30, margin_minutes: 10, color: "#10b981", follow_up_days: 90 },
      { name: "Vacunación", description: "Aplicación de vacunas del calendario", duration_minutes: 20, margin_minutes: 10, color: "#f59e0b", follow_up_days: 0, prep_notes: "Traer libreta sanitaria y registro previo de vacunas." },
      { name: "Control mensual", description: "Control mensual del primer año", duration_minutes: 20, margin_minutes: 5, color: "#8b5cf6", follow_up_days: 30 },
    ],
  },
  gynecologist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta ginecológica", description: "Consulta y evaluación ginecológica", duration_minutes: 30, margin_minutes: 10, color: "#ec4899", follow_up_days: 180 },
      { name: "Papanicolaou", description: "Estudio citológico preventivo", duration_minutes: 20, margin_minutes: 10, color: "#8b5cf6", follow_up_days: 365, prep_notes: "No mantener relaciones ni usar óvulos 48 hs previas. Concurrir sin menstruar." },
      { name: "Control prenatal", description: "Control durante el embarazo", duration_minutes: 30, margin_minutes: 10, color: "#10b981", follow_up_days: 30 },
      { name: "Ecografía", description: "Ecografía ginecológica", duration_minutes: 30, margin_minutes: 10, color: "#3b82f6", follow_up_days: 90 },
    ],
  },
  cardiologist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta cardiológica", description: "Evaluación cardiovascular", duration_minutes: 30, margin_minutes: 10, color: "#ef4444", follow_up_days: 90 },
      { name: "Electrocardiograma", description: "Estudio del ritmo cardíaco", duration_minutes: 20, margin_minutes: 10, color: "#3b82f6", follow_up_days: 90 },
      { name: "Ecocardiograma", description: "Ecografía del corazón", duration_minutes: 45, margin_minutes: 15, color: "#8b5cf6", follow_up_days: 180 },
      { name: "Control de hipertensión", description: "Seguimiento de presión arterial", duration_minutes: 20, margin_minutes: 5, color: "#f59e0b", follow_up_days: 30 },
    ],
  },
  ophthalmologist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta oftalmológica", description: "Evaluación visual completa", duration_minutes: 40, margin_minutes: 10, color: "#3b82f6", follow_up_days: 180 },
      { name: "Control de vista", description: "Control de agudeza visual", duration_minutes: 20, margin_minutes: 5, color: "#10b981", follow_up_days: 365 },
      { name: "Fondo de ojo", description: "Examen del fondo de ojo", duration_minutes: 30, margin_minutes: 10, color: "#8b5cf6", follow_up_days: 180, prep_notes: "Se aplican gotas que dilatan la pupila; venir con acompañante y no conducir después." },
      { name: "Adaptación de lentes", description: "Medición para lentes de contacto", duration_minutes: 30, margin_minutes: 10, color: "#f59e0b", follow_up_days: 90 },
    ],
  },
  speech_therapist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Sesión de fonoaudiología", description: "Sesión de tratamiento", duration_minutes: 45, margin_minutes: 10, color: "#3b82f6", follow_up_days: 30 },
      { name: "Evaluación inicial", description: "Primera evaluación diagnóstica", duration_minutes: 60, margin_minutes: 15, color: "#f59e0b", follow_up_days: 30 },
      { name: "Estimulación del lenguaje", description: "Estimulación en niños", duration_minutes: 45, margin_minutes: 10, color: "#10b981", follow_up_days: 30 },
    ],
  },
  occupational_therapist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Sesión de TO", description: "Sesión de terapia ocupacional", duration_minutes: 45, margin_minutes: 10, color: "#3b82f6", follow_up_days: 30 },
      { name: "Evaluación inicial", description: "Primera evaluación funcional", duration_minutes: 60, margin_minutes: 15, color: "#f59e0b", follow_up_days: 30 },
      { name: "Rehabilitación motora", description: "Rehabilitación de funciones motoras", duration_minutes: 45, margin_minutes: 10, color: "#10b981", follow_up_days: 30 },
    ],
  },
  podiatrist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta podológica", description: "Evaluación y atención de los pies", duration_minutes: 40, margin_minutes: 10, color: "#3b82f6", follow_up_days: 90 },
      { name: "Curación de uñas", description: "Tratamiento de uñas encarnadas", duration_minutes: 30, margin_minutes: 10, color: "#f59e0b", follow_up_days: 30 },
      { name: "Pie diabético", description: "Atención especializada para pie diabético", duration_minutes: 45, margin_minutes: 15, color: "#ef4444", follow_up_days: 30 },
    ],
  },
  veterinarian: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta veterinaria", description: "Consulta y evaluación clínica", duration_minutes: 30, margin_minutes: 10, color: "#3b82f6", follow_up_days: 90 },
      { name: "Vacunación", description: "Aplicación de vacunas", duration_minutes: 20, margin_minutes: 10, color: "#10b981", follow_up_days: 0 },
      { name: "Castración", description: "Cirugía de castración", duration_minutes: 90, margin_minutes: 30, color: "#8b5cf6", follow_up_days: 15, prep_notes: "Ayuno sólido de 8 hs previo a la cirugía. Agua permitida." },
      { name: "Control anual", description: "Chequeo anual completo", duration_minutes: 40, margin_minutes: 10, color: "#f59e0b", follow_up_days: 365 },
    ],
  },
  other: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta general", description: "Consulta de rutina", duration_minutes: 30, margin_minutes: 5, color: "#3b82f6", follow_up_days: 0 },
      { name: "Primera consulta", description: "Evaluación inicial", duration_minutes: 45, margin_minutes: 10, color: "#10b981", follow_up_days: 30 },
      { name: "Control de seguimiento", description: "Control post-consulta", duration_minutes: 20, margin_minutes: 5, color: "#f59e0b", follow_up_days: 30 },
    ],
  },
};

export function getPreset(type) {
  const preset = PRESETS[type] || PRESETS.other;
  return {
    patientLabel: preset.patientLabel,
    services: [
      { name: "Primera Consulta", description: "Evaluación inicial", duration_minutes: 30, margin_minutes: 5, color: "#3b82f6", follow_up_days: 0 },
    ],
  };
}

export function getTypeLabel(type) {
  return PROFESSIONAL_TYPES.find((t) => t.value === type)?.label || "Otro";
}