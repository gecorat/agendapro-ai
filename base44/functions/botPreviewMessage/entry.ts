import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { DEFAULT_OBJECTIVE_PROMPT, DEFAULT_TONE_PROMPT } from '../../shared/bot-defaults.ts';

// Simulador del bot para el profesional logueado (/bot) — a diferencia de la versión vieja
// (que armaba el prompt en el propio frontend, con datos parciales), esto corre en el
// servidor y usa EXACTAMENTE las mismas variables reales que el bot de WhatsApp real
// (bot_objective_prompt / bot_tone_prompt / bot_assistant_name de PracticeSettings,
// servicios y horarios reales) — así la prueba refleja de verdad cómo respondería con el
// plan Pro o Clinic.
//
// Si el modelo decide agendar y el horario está realmente libre, se crea una cita DE
// VERDAD (visible en la Agenda), marcada is_demo=true con demo_expires_at a 5 minutos —
// nunca dispara recordatorios, sync de Google Calendar ni avisos push (ver los filtros
// is_demo en sendReminders/autoCompleteAppointments y los `if` correspondientes acá). El
// paciente de prueba se reutiliza entre simulaciones en vez de crear uno nuevo cada vez.

const DEMO_TTL_MS = 5 * 60 * 1000;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const message = (body?.message || '').toString().trim();
    const history = Array.isArray(body?.history) ? body.history : [];
    if (!message) return Response.json({ error: 'Falta el mensaje' }, { status: 400 });

    const professionalId = user.id;

    const [practices, services, availability, appts] = await Promise.all([
      base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: professionalId }),
      base44.asServiceRole.entities.Service.filter({ created_by_id: professionalId, active: true }),
      base44.asServiceRole.entities.Availability.filter({ practice_owner_id: professionalId }),
      base44.asServiceRole.entities.Appointment.filter({ professional_id: professionalId }),
    ]);
    const practice = practices?.[0];
    if (!practice) return Response.json({ error: 'No se encontró tu consultorio' }, { status: 404 });

    // Limpieza best-effort de citas/paciente de prueba vencidos de este mismo profesional,
    // en cada mensaje — así el simulador nunca deja basura acumulada sin necesitar un cron
    // aparte (se complementa con el borrado inmediato que dispara el frontend a los 5 min).
    const now = new Date();
    const expiredDemoAppts = (appts || []).filter(
      (a) => a.is_demo && a.demo_expires_at && new Date(a.demo_expires_at) <= now
    );
    for (const a of expiredDemoAppts) {
      try {
        await base44.asServiceRole.entities.Appointment.delete(a.id);
      } catch { /* no bloquea el resto */ }
    }

    const activeAppts = (appts || []).filter(
      (a) => a.status !== 'cancelled' && !expiredDemoAppts.some((e) => e.id === a.id)
    );

    const objectivePrompt = practice.bot_objective_prompt || DEFAULT_OBJECTIVE_PROMPT;
    const tonePrompt = practice.bot_tone_prompt || DEFAULT_TONE_PROMPT;
    const assistantName = (practice.bot_assistant_name || '').trim();
    // Mismo criterio que el bot real (ver zernio.ts): el modo de personalidad y los datos
    // obligatorios salen de PracticeSettings, no están fijos acá. Antes este simulador los
    // ignoraba por completo, así que probabas en /bot y respondía distinto de como iba a
    // responder en WhatsApp real.
    const personaMode = practice.bot_persona_mode === 'professional' ? 'professional' : 'assistant';
    const nameBlock = personaMode === 'professional'
      ? `Hablás en PRIMERA PERSONA, como si vos mismo fueras ${practice.practice_name || 'el profesional'} respondiendo directamente por WhatsApp — NO te presentes como "la asistente virtual" ni como un bot aparte, y no uses ningún nombre de asistente distinto. Si te preguntan si sos una IA o un bot, respondé con naturalidad y sin dar vueltas, pero el resto de la conversación sigue en primera persona como si fueras vos.`
      : (assistantName
        ? `Te llamás ${assistantName}. Presentáte con ese nombre si te preguntan cómo te llamás, o de forma natural al saludar.`
        : `No tenés un nombre propio: presentate como "la asistente virtual del consultorio" si te preguntan.`);

    const requiredPatientFields = Array.isArray(practice.bot_required_patient_fields)
      ? practice.bot_required_patient_fields
      : ['last_name'];
    const requireLastName = requiredPatientFields.includes('last_name');
    const requireEmail = requiredPatientFields.includes('email');
    const requireDni = requiredPatientFields.includes('dni');
    const requiredDataLabels = ['nombre'];
    if (requireLastName) requiredDataLabels.push('apellido');
    if (requireEmail) requiredDataLabels.push('email');
    if (requireDni) requiredDataLabels.push('DNI');
    const requiredDataText = requiredDataLabels.join(', ');

    const myServices = services || [];
    const servicesText = myServices.length
      ? myServices.map((s) => `- ${s.name} (${s.duration_minutes} min${s.price ? ', $' + s.price : ''})`).join('\n')
      : '(el consultorio todavía no cargó servicios)';

    const DAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const workByDay: Record<string, string[]> = {};
    (availability || []).filter((a) => a.type === 'work').forEach((a) => {
      const d = DAYS[a.day_of_week] || `día ${a.day_of_week}`;
      workByDay[d] = workByDay[d] || [];
      workByDay[d].push(`${a.start_time}-${a.end_time}`);
    });
    const availabilityText = Object.keys(workByDay).length
      ? Object.entries(workByDay).map(([d, r]) => `- ${d}: ${r.join(', ')}`).join('\n')
      : '- lunes a viernes 09:00-18:00 (horario por defecto, el consultorio no cargó uno propio)';

    const todayStr = now.toLocaleString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    });

    const systemPrompt = `${objectivePrompt}

${tonePrompt}

${nameBlock}

=== MODO SIMULADOR (dentro de la plataforma, no es WhatsApp real) ===
El propio profesional está probando en carne propia cómo respondés, usando los datos reales de SU consultorio (abajo). Es una demo dentro de la app: no hace falta pedir el teléfono (en WhatsApp real ya lo tenés por el propio chat). Del resto de los datos del paciente sí pedí los mismos que pedirías de verdad, para que la prueba refleje cómo va a ser la conversación real.

Datos que NECESITÁS de un paciente nuevo antes de agendar: ${requiredDataText}. Si todavía te falta alguno, pedíselo en vez de agendar sin él o inventarlo. Cuando te los dé, completá patient_first_name${requireLastName ? ', patient_last_name' : ''}${requireEmail ? ', patient_email' : ''}${requireDni ? ', patient_dni' : ''}.

=== CONTEXTO REAL DEL CONSULTORIO ===
Ahora mismo es: ${todayStr} (hora de Argentina).
Servicios:
${servicesText}
Horarios de atención:
${availabilityText}

Instrucciones sobre la reserva: si el paciente eligió un servicio y un día/horario concreto y confirma, configurá book=true, service_name (EXACTO tal cual aparece arriba) y datetime en ISO 8601 CON offset de Argentina (ej. "2026-09-07T10:00:00-03:00"). El sistema valida solo si ese horario está realmente libre — si no lo está, tu respuesta se reemplaza automáticamente por un aviso real, así que intentá con confianza en cuanto tengas los datos. Nunca digas que algo quedó "agendado" o "confirmado" si no configuraste book=true en ESTE mismo mensaje.`;

    const historyText = history
      .slice(-12)
      .map((h: any) => `${h.role === 'user' ? 'Paciente' : 'Bot'}: ${h.content}`)
      .join('\n');

    const prompt = `${systemPrompt}\n\n=== CONVERSACIÓN ===\n${historyText ? historyText + '\n' : ''}Paciente: ${message}\nBot:`;

    const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          book: { type: 'boolean' },
          service_name: { type: 'string' },
          datetime: { type: 'string', description: 'ISO 8601 con offset -03:00' },
          patient_first_name: { type: 'string' },
          patient_last_name: { type: 'string', description: 'Apellido del paciente, si ya te lo dijo en esta conversación.' },
          patient_email: { type: 'string', description: 'Email del paciente, si ya te lo dijo en esta conversación.' },
          patient_dni: { type: 'string', description: 'DNI del paciente, si ya te lo dijo en esta conversación.' },
        },
        required: ['reply', 'book'],
      },
    });
    const parsed = typeof llmRes === 'string' ? JSON.parse(llmRes) : llmRes;

    let replyText = parsed?.reply || 'Disculpá, no entendí. ¿Podés repetirlo?';
    let booked = false;
    let appointment = null;

    if (parsed?.book && parsed?.service_name && parsed?.datetime) {
      const service = myServices.find(
        (s: any) => s.name.trim().toLowerCase() === String(parsed.service_name).trim().toLowerCase()
      );
      const start = new Date(parsed.datetime);

      if (service && !isNaN(start.getTime()) && start.getTime() > Date.now()) {
        const end = new Date(start.getTime() + (service.duration_minutes || 30) * 60000);
        const overlaps = activeAppts.some((a: any) => {
          const aS = new Date(a.start_datetime).getTime();
          const aE = new Date(a.end_datetime).getTime();
          return start.getTime() < aE && aS < end.getTime();
        });

        if (!overlaps) {
          const demoPatients = await base44.asServiceRole.entities.Patient.filter({
            professional_id: professionalId,
            is_demo: true,
          });
          // Los datos que la IA logró juntar en esta simulación se reflejan en la ficha de
          // prueba, para que el profesional vea en la Agenda exactamente lo que habría
          // quedado guardado en una conversación real (y no un "Prueba (simulador)" fijo).
          const demoFields = {
            first_name: (parsed.patient_first_name || '').trim() || 'Prueba',
            last_name: (parsed.patient_last_name || '').trim() || '(simulador)',
            ...(parsed.patient_email ? { email: String(parsed.patient_email).trim() } : {}),
            ...(parsed.patient_dni ? { dni: String(parsed.patient_dni).trim() } : {}),
          };
          let patient = demoPatients?.[0];
          if (!patient) {
            patient = await base44.asServiceRole.entities.Patient.create({
              ...demoFields,
              phone: '000000000',
              professional_id: professionalId,
              is_demo: true,
              consent_reminders: false,
            });
          } else {
            try {
              patient = await base44.asServiceRole.entities.Patient.update(patient.id, demoFields);
            } catch { /* si falla, seguimos con la ficha de prueba tal cual estaba */ }
          }

          const demoExpiresAt = new Date(Date.now() + DEMO_TTL_MS).toISOString();
          appointment = await base44.asServiceRole.entities.Appointment.create({
            patient_id: patient.id,
            patient_name: `${patient.first_name} ${patient.last_name || ''}`.trim(),
            service_id: service.id,
            service_name: service.name,
            start_datetime: start.toISOString(),
            end_datetime: end.toISOString(),
            status: 'confirmed',
            origin: 'bot_preview',
            professional_id: professionalId,
            is_demo: true,
            demo_expires_at: demoExpiresAt,
          });
          booked = true;
        } else {
          replyText = `${replyText}\n\n(En la simulación ese horario ya está ocupado por otra cita real tuya — probá con otro.)`;
        }
      }
    }

    return Response.json({ reply: replyText, booked, appointment });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
