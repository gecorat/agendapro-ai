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
//
// OJO con duplicados: si por algún motivo quedó más de UNA ficha de Patient con el mismo
// teléfono (pasa más de lo que gustaría — confirmado en vivo con una cuenta de prueba que
// tenía 2 fichas duplicadas), NO alcanza con el primer match que aparezca: el orden de
// `patients` no está garantizado entre llamadas (no viene ordenado), así que un mismo
// paciente podía "resolverse" a una ficha distinta en cada mensaje — y entonces un turno
// creado bajo la ficha A quedaba invisible al buscar "tus citas" bajo la ficha B. Para que
// sea SIEMPRE la misma, entre varios matches nos quedamos con el más antiguo
// (created_date más chico): es determinístico y no cambia de una llamada a la otra.
export function findPatientByCanonicalPhone(patients, phone) {
  const target = canonicalPhone(phone);
  if (!target) return null;
  const matches = (patients || []).filter((p) => canonicalPhone(p.phone) === target);
  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];
  return matches.sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
}
