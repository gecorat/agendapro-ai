// Motor de cálculo de horarios disponibles, portado 1:1 de la lógica que ya usa la
// página de reserva pública (src/pages/PublicBooking.jsx) — así el bot de WhatsApp
// ofrece SIEMPRE horarios reales (respetando horario de atención, descansos, días
// bloqueados, citas ya tomadas y el Google Calendar personal del profesional), nunca
// horarios inventados por la IA. Si cambia la lógica de disponibilidad en un lugar, hay
// que replicar el cambio acá también (no se pudo compartir un solo archivo entre el
// frontend Vite y las funciones Deno de este proyecto).

function parseTimeToDate(date, time) {
  const [h, m] = time.split(':').map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isBlockedDate(availability, date) {
  const dateStr = toDateStr(date);
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
  const dayOfWeek = date.getDay();
  const workRanges = getWorkRanges(availability, dayOfWeek, professionalRefId);
  const breakRanges = getBreakRanges(availability, dayOfWeek, professionalRefId);
  if (!workRanges.length) return [];

  const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
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
