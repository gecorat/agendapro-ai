export const PROFESSIONAL_TYPES = [
  { value: "dentist", label: "Odontólogo" },
  { value: "psychologist", label: "Psicólogo" },
  { value: "doctor", label: "Médico clínico" },
  { value: "physiotherapist", label: "Fisioterapeuta" },
  { value: "nutritionist", label: "Nutricionista" },
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
      { name: "Limpieza dental", description: "Profilaxis y limpieza", duration_minutes: 45, margin_minutes: 10, color: "#10b981", follow_up_days: 180 },
      { name: "Control mensual", description: "Control de seguimiento", duration_minutes: 20, margin_minutes: 0, color: "#f59e0b", follow_up_days: 30 },
    ],
  },
  psychologist: {
    patientLabel: "Consultantes",
    services: [
      { name: "Sesión individual", description: "Sesión de terapia individual", duration_minutes: 50, margin_minutes: 10, color: "#8b5cf6", follow_up_days: 7 },
      { name: "Sesión de pareja", description: "Terapia de pareja", duration_minutes: 60, margin_minutes: 10, color: "#ec4899", follow_up_days: 7 },
      { name: "Primera entrevista", description: "Entrevista inicial diagnóstica", duration_minutes: 60, margin_minutes: 15, color: "#3b82f6", follow_up_days: 7 },
    ],
  },
  doctor: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta clínica", description: "Consulta médica general", duration_minutes: 30, margin_minutes: 10, color: "#3b82f6", follow_up_days: 30 },
      { name: "Control de seguimiento", description: "Control post-consulta", duration_minutes: 20, margin_minutes: 5, color: "#f59e0b", follow_up_days: 30 },
      { name: "Chequeo anual", description: "Chequeo médico completo", duration_minutes: 60, margin_minutes: 15, color: "#10b981", follow_up_days: 365 },
    ],
  },
  physiotherapist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Sesión de kinesiología", description: "Sesión de tratamiento", duration_minutes: 45, margin_minutes: 10, color: "#3b82f6", follow_up_days: 7 },
      { name: "Evaluación inicial", description: "Primera evaluación", duration_minutes: 60, margin_minutes: 15, color: "#f59e0b", follow_up_days: 7 },
    ],
  },
  nutritionist: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta nutricional", description: "Consulta inicial y plan alimentario", duration_minutes: 45, margin_minutes: 10, color: "#10b981", follow_up_days: 30 },
      { name: "Seguimiento", description: "Control de seguimiento", duration_minutes: 30, margin_minutes: 5, color: "#f59e0b", follow_up_days: 30 },
    ],
  },
  other: {
    patientLabel: "Pacientes",
    services: [
      { name: "Consulta general", description: "Consulta de rutina", duration_minutes: 30, margin_minutes: 5, color: "#3b82f6", follow_up_days: 0 },
    ],
  },
};

export function getPreset(type) {
  return PRESETS[type] || PRESETS.other;
}

export function getTypeLabel(type) {
  return PROFESSIONAL_TYPES.find((t) => t.value === type)?.label || "Otro";
}