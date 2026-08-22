// Un mismo número de WhatsApp argentino puede llegar escrito de formas distintas según de
// dónde salga: "+543425526816" (sin el 9 de celular, típico si alguien lo tipea a mano),
// "+5493425526816" o "5493425526816" (como lo normaliza el webhook de WhatsApp), o
// "3425526816" (solo el número local, sin código de país). Comparar como texto exacto
// hacía que la MISMA persona terminara con una ficha de paciente distinta por cada formato
// — confirmado en vivo: un mismo profesional (Gonzalo) tenía 4 fichas separadas.
//
// Los últimos 10 dígitos (código de área + abonado) identifican al número real sin
// importar cómo se haya escrito el código de país o el "9" de celular. Esto es específico
// para Argentina, pero es donde opera la app hoy.
export function canonicalPhone(phone) {
  const digits = (phone || "").replace(/\D/g, "");
  if (digits.length <= 10) return digits;
  return digits.slice(-10);
}

// Busca, entre los pacientes YA cargados de un profesional, el que tenga el mismo
// teléfono canónico. Se hace en JS (no vía filtro de base de datos) porque el motor de
// consultas no soporta "termina con" — hay que traer la lista y comparar acá.
export function findPatientByCanonicalPhone(patients, phone) {
  const target = canonicalPhone(phone);
  if (!target) return null;
  return (patients || []).find((p) => canonicalPhone(p.phone) === target) || null;
}
