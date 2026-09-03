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

// Convierte lo que el paciente tipeo en un numero de WhatsApp completo y enviable.
//
// POR QUE HACE FALTA: la pagina publica aceptaba el telefono como texto libre y el backend
// solo verificaba que no estuviera vacio. Despues se le manda el WhatsApp a esa cadena tal
// cual, y Evolution arma el JID con lo que le des. Un numero de 10 digitos sin codigo de
// pais ("3425902123", que es como lo escribe cualquiera en Argentina) no identifica a nadie
// en particular: WhatsApp lo resuelve como puede y la confirmacion termina en el telefono
// de OTRA persona real. Confirmado en vivo el 03/09.
//
// CRITERIO: si viene con "+" y un codigo de pais que no es 54, se respeta tal cual (puede
// ser un paciente del exterior). Sin "+", se asume Argentina, que es donde opera la app y
// donde nadie escribe ni el +54 ni el 9.
//
// Formato de salida: 549 + 10 digitos (area + abonado), que es el E.164 argentino de movil
// sin el "+", tal como lo espera Evolution.
// Devuelve null si no se puede resolver — en ese caso NO hay que mandar nada.
export function toWhatsAppNumber(raw) {
  const input = String(raw || "").trim();
  if (!input) return null;

  const digits = input.replace(/\D/g, "").replace(/^00/, "");
  if (!digits) return null;

  // Internacional explicito y no argentino: se respeta (ej. un paciente de Brasil que
  // escribio +5511...). Solo cuando el usuario se tomo el trabajo de poner el "+".
  const looksInternational = input.trim().startsWith("+") || input.trim().startsWith("00");
  if (looksInternational && !digits.startsWith("54")) {
    return digits.length >= 8 && digits.length <= 15 ? digits : null;
  }

  // Argentina: se saca el 54 de pais y el 9 de movil si vinieron, para quedarnos con los
  // 10 digitos nacionales (codigo de area + abonado) y rearmarlo siempre igual.
  let national = digits;
  if (national.startsWith("54")) national = national.slice(2);
  // El 0 de larga distancia (0342...). Ningun codigo de area empieza con 0, asi que si esta
  // adelante solo puede ser el prefijo nacional.
  if (national.startsWith("0")) national = national.slice(1);
  // Ningun codigo de area argentino empieza con 9 tampoco, asi que un 9 adelante solo puede
  // ser el prefijo de movil.
  if (national.length === 11 && national.startsWith("9")) national = national.slice(1);
  // El 15 del viejo formato de celular (342 15 590 2123).
  //
  // El codigo de area TIENE que empezar con 1, 2 o 3: en el plan de numeracion argentino no
  // existe ninguno que empiece con 0, 4, 5, 6, 7, 8 o 9. Sin esa restriccion la regla del
  // "15" pisaba numeros extranjeros de 12 digitos escritos sin "+": un fijo de Brasil como
  // 551532123456 (area 15 de Sorocaba) se convertia en 5495532123456, o sea el numero de
  // OTRA persona. Es exactamente el bug que ya paso una vez, al reves.
  national = national.replace(/^([123]\d{1,3})15(\d{6,8})$/, "$1$2");

  if (national.length !== 10) return null;
  // Mismo criterio como chequeo final: un nacional argentino valido siempre arranca con el
  // codigo de area, y ninguno empieza con 0, 4, 5, 6, 7, 8 o 9.
  if (!/^[123]/.test(national)) return null;
  return `549${national}`;
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
