// Motor de cálculo de horarios disponibles, portado 1:1 de la lógica que ya usa la
// página de reserva pública (src/pages/PublicBooking.jsx) — así el bot de WhatsApp
// ofrece SIEMPRE horarios reales (respetando horario de atención, descansos, días
// bloqueados, citas ya tomadas y el Google Calendar personal del profesional), nunca
// horarios inventados por la IA. Si cambia la lógica de disponibilidad en un lugar, hay
// que replicar el cambio acá también (no se pudo compartir un solo archivo entre el
// frontend Vite y las funciones Deno de este proyecto).
//
// OJO ZONA HORARIA: en el navegador (de donde se portó esta lógica), `new Date().setHours()`
// usa la zona horaria del propio usuario (Argentina, para esta app). Acá en el servidor
// (Deno) el runtime corre en OTRA zona horaria (probablemente UTC) — usar `.setHours()`
// o `.getDay()` directo sobre un Date corría el horario laboral varias horas, aceptando
// o rechazando horarios que en Argentina eran otra cosa. Confirmado en vivo: pedir un
// turno a las 14:45 (dentro de un horario 09:00-18:00 sin descansos) se rechazaba porque
// el límite de las 18:00 se interpretaba en UTC, no en hora argentina. Todas las
// funciones de acá abajo por eso pasan SIEMPRE por argentinaYMD/argentinaDayOfWeek /
// parseTimeToDate, que fijan expresamente el offset "-03:00", sin importar en qué huso
// horario esté corriendo el proceso que las llama.
const AR_TZ = 'America/Argentina/Buenos_Aires';

// Fecha (año-mes-día) que corresponde a un instante, LEÍDA en horario argentino — sin
// esto, un mismo instante cerca de la medianoche podía "caer" en el día equivocado según
// el huso horario del servidor.
function argentinaYMD(date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: AR_TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

// Día de la semana (0=domingo..6=sábado) en horario argentino. El truco: se arma un
// instante al mediodía argentino de esa fecha (nunca cruza medianoche hacia otro día en
// UTC) y se lee con getUTCDay(), que no depende del huso horario del proceso.
function argentinaDayOfWeek(date) {
  const ymd = argentinaYMD(date);
  return new Date(`${ymd}T12:00:00-03:00`).getUTCDay();
}

// Arma un Date para una hora "HH:mm" en el mismo DÍA (argentino) que `date`, siempre en
// horario argentino real, sin importar el huso horario del proceso que corre esto.
function parseTimeToDate(date, time) {
  const [h, m] = time.split(':').map(Number);
  const ymd = argentinaYMD(date);
  const hh = String(h).padStart(2, '0');
  const mm = String(m).padStart(2, '0');
  return new Date(`${ymd}T${hh}:${mm}:00-03:00`);
}

// Principio y fin del día (00:00:00.000 y 23:59:59.999) en horario argentino.
function argentinaDayBounds(date) {
  const ymd = argentinaYMD(date);
  return {
    start: new Date(`${ymd}T00:00:00.000-03:00`),
    end: new Date(`${ymd}T23:59:59.999-03:00`),
  };
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function isBlockedDate(availability, date) {
  const dateStr = argentinaYMD(date);
  return availability.some((a) => (a.type === 'holiday' || a.type === 'block') && a.date === dateStr);
}

function getWorkRanges(availability, dayOfWeek, professionalRefId) {
  const scoped = availability.filter((a) => (a.professional_ref_id || null) === (professionalRefId || null));
  const work = scoped.filter((a) => a.type === 'work' && a.day_of_week === dayOfWeek);
  if (work.length) return work.map((w) => ({ start: w.start_time, end: w.end_time })).sort((a, b) => a.start.localeCompare(b.start));
  const hasAnyWorkConfigured = scoped.some((a) => a.type === 'work');
  if (!hasAnyWorkConfigured && !professionalRefId && dayOfWeek >= 1 && dayOfWeek <= 5) return [{ start: '09:00', end: '18:00' }];
  return [];
}

function getBreakRanges(availability, dayOfWeek, professionalRefId) {
  return availability
    .filter((a) => (a.professional_ref_id || null) === (professionalRefId || null))
    .filter((a) => a.type === 'break' && a.day_of_week === dayOfWeek)
    .map((b) => ({ start: b.start_time, end: b.end_time }));
}

// Devuelve los horarios de inicio (objetos Date) disponibles para UN día puntual, para
// un servicio y profesional dados. `appointments` puede venir sin filtrar por día, se
// filtra acá adentro.
export function generateSlotsForDay(date, service, availability, appointments, professionalRefId, googleBusy) {
  if (!service) return [];
  if (isBlockedDate(availability, date)) return [];
  const dayOfWeek = argentinaDayOfWeek(date);
  const workRanges = getWorkRanges(availability, dayOfWeek, professionalRefId);
  const breakRanges = getBreakRanges(availability, dayOfWeek, professionalRefId);
  if (!workRanges.length) return [];

  const { start: dayStart, end: dayEnd } = argentinaDayBounds(date);
  const booked = (appointments || []).filter((a) => {
    if (a.status === 'cancelled') return false;
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

// Busca, a partir de un día concreto, hasta `maxDaysForward` días hacia adelante, el
// primer día que tenga al menos un horario libre, y devuelve sus slots. Se usa cuando el
// día que pidió el paciente está completo o es un día bloqueado — en vez de decirle
// simplemente "no hay lugar", le ofrecemos el próximo día real con disponibilidad.
export function findNextAvailableDaySlots(fromDate, service, availability, appointments, professionalRefId, googleBusy, maxDaysForward = 14) {
  for (let i = 0; i <= maxDaysForward; i++) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + i);
    const slots = generateSlotsForDay(d, service, availability, appointments, professionalRefId, googleBusy);
    if (slots.length) return { date: d, slots };
  }
  return { date: null, slots: [] };
}

// De una lista de horarios disponibles (Date[]) para un día, elige hasta `count`, los
// más cercanos al horario que el paciente pidió originalmente (por diferencia absoluta
// de tiempo), y los devuelve ordenados cronológicamente para mostrarlos de forma natural.
export function pickClosestSlots(slots, requestedTime, count = 3) {
  if (!slots.length) return [];
  const target = requestedTime instanceof Date ? requestedTime.getTime() : null;
  const sorted = [...slots];
  if (target !== null) {
    sorted.sort((a, b) => Math.abs(a.getTime() - target) - Math.abs(b.getTime() - target));
  }
  return sorted.slice(0, count).sort((a, b) => a.getTime() - b.getTime());
}

// Chequeo DIRECTO de disponibilidad para un horario EXACTO (no necesariamente alineado a
// la grilla de generateSlotsForDay). generateSlotsForDay sirve para OFRECER opciones (ahí
// tiene sentido una grilla prolija de horarios redondos); pero para ACEPTAR el horario que
// el paciente pidió puntualmente, exigir que caiga justo en esa grilla era demasiado
// estricto — confirmado en vivo: un horario realmente libre, dentro del horario de
// atención y sin ningún choque, se rechazaba solo porque no coincidía exacto con un múltiplo
// de la duración del servicio contado desde el inicio del horario laboral. Esta función
// valida el rango pedido contra horario de atención, descansos, otras citas y Google
// Calendar directamente, sin pasar por ninguna grilla.
export function isTimeAvailable(start, end, service, availability, appointments, professionalRefId, googleBusy) {
  if (!service) return false;
  if (start.getTime() < Date.now()) return false;
  if (isBlockedDate(availability, start)) return false;

  const dayOfWeek = argentinaDayOfWeek(start);
  const workRanges = getWorkRanges(availability, dayOfWeek, professionalRefId);
  const withinWork = workRanges.some((r) => {
    const rStart = parseTimeToDate(start, r.start);
    const rEnd = parseTimeToDate(start, r.end);
    return start.getTime() >= rStart.getTime() && end.getTime() <= rEnd.getTime();
  });
  if (!withinWork) return false;

  const breakRanges = getBreakRanges(availability, dayOfWeek, professionalRefId);
  const overlapsBreak = breakRanges.some((br) => rangesOverlap(start, end, parseTimeToDate(start, br.start), parseTimeToDate(start, br.end)));
  if (overlapsBreak) return false;

  const overlapsBooked = (appointments || []).some((a) => {
    if (a.status === 'cancelled') return false;
    if ((a.professional_ref_id || null) !== (professionalRefId || null)) return false;
    return rangesOverlap(start, end, new Date(a.start_datetime), new Date(a.end_datetime));
  });
  if (overlapsBooked) return false;

  const overlapsGoogle = (googleBusy || []).some((b) => rangesOverlap(start, end, new Date(b.start), new Date(b.end)));
  if (overlapsGoogle) return false;

  return true;
}
