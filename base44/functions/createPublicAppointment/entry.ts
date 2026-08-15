import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const {
      professional_id,
      service_id,
      start_datetime,
      first_name,
      last_name,
      phone,
      email,
    } = body;

    if (!professional_id || !service_id || !start_datetime || !first_name || !phone || !email) {
      return Response.json({ error: 'Faltan datos requeridos.' }, { status: 400 });
    }

    // asServiceRole: el visitante público (anónimo) no tiene permisos de lectura sobre
    // Service/Patient/Appointment según las reglas RLS, así que validamos y escribimos
    // con el rol de servicio, igual que hace getBookedSlots.
    const services = await base44.asServiceRole.entities.Service.filter({ id: service_id });
    const service = services?.[0];
    if (!service || service.created_by_id !== professional_id || service.active === false) {
      return Response.json({ error: 'El servicio no está disponible.' }, { status: 400 });
    }

    const start = new Date(start_datetime);
    if (isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return Response.json({ error: 'El horario seleccionado ya no es válido.' }, { status: 400 });
    }
    const end = new Date(start.getTime() + (service.duration_minutes || 30) * 60000);

    // Re-chequeo server-side de solapamiento justo antes de crear. El frontend ya filtra
    // horarios ocupados al mostrar la grilla, pero esa lista se carga una sola vez al abrir
    // la página: si dos personas llegan a confirmar casi al mismo tiempo para el mismo
    // horario, sin este chequeo ambas reservas se crearían igual (double booking).
    const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);
    const existingAppts = await base44.asServiceRole.entities.Appointment.filter({
      professional_id,
      status: { $ne: 'cancelled' },
      start_datetime: { $gte: dayStart.toISOString(), $lte: dayEnd.toISOString() },
    });
    const overlaps = (existingAppts || []).some((a) => {
      const aStart = new Date(a.start_datetime).getTime();
      const aEnd = new Date(a.end_datetime).getTime();
      return start.getTime() < aEnd && aStart < end.getTime();
    });
    if (overlaps) {
      return Response.json(
        { error: 'slot_taken', message: 'Ese horario ya fue reservado. Por favor elegí otro.' },
        { status: 409 }
      );
    }

    // Buscar paciente existente por teléfono usando asServiceRole: la regla RLS de Patient
    // solo permite leer al dueño de la ficha o al profesional, así que un visitante anónimo
    // nunca encontraba coincidencias acá y terminaba creando un paciente duplicado cada vez.
    const existingPatients = await base44.asServiceRole.entities.Patient.filter({ phone, professional_id });
    let patient = existingPatients?.[0];
    if (!patient) {
      patient = await base44.asServiceRole.entities.Patient.create({
        first_name,
        last_name: last_name || '',
        phone,
        email,
        contact_preference: 'whatsapp',
        consent_reminders: true,
        professional_id,
      });
    }

    const appointment = await base44.asServiceRole.entities.Appointment.create({
      patient_id: patient.id,
      patient_name: `${patient.first_name} ${patient.last_name || ''}`.trim(),
      service_id: service.id,
      service_name: service.name,
      start_datetime: start.toISOString(),
      end_datetime: end.toISOString(),
      status: 'pending',
      origin: 'public_link',
      professional_id,
    });

    return Response.json({ appointment, patient });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
