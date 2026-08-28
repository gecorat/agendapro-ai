import { findPatientByCanonicalPhone } from "./phone-utils.ts";
import { sendEmail } from "./email-sender.ts";
import { buildEmailHtml } from "./email-template.ts";
import { generateSlotsForDay, findNextAvailableDaySlots, pickClosestSlots, isTimeAvailable } from "./scheduling.ts";
import { getGoogleBusyRanges } from "./google-calendar.ts";
import { DEFAULT_OBJECTIVE_PROMPT, DEFAULT_TONE_PROMPT, DEFAULT_RESPONSE_DELAY_SECONDS } from "./bot-defaults.ts";

// Link corto de Google Maps para la dirección del consultorio. Si hay coordenadas
// guardadas (address_lat/lng, las carga el autocompletado de dirección del perfil) el
// link va directo a ese punto exacto; si no, arma una búsqueda por texto de la
// dirección — funciona igual en WhatsApp, solo que Google puede tardar un toque más en
// afinar el resultado exacto.
export function buildMapsLink(practice) {
  if (practice?.address_lat != null && practice?.address_lng != null) {
    return `https://maps.google.com/?q=${practice.address_lat},${practice.address_lng}`;
  }
  const addressParts = [practice?.address, practice?.address_city, practice?.address_province].filter(Boolean).join(', ');
  if (!addressParts) return null;
  return `https://maps.google.com/?q=${encodeURIComponent(addressParts)}`;
}

function formatSlotList(slots) {
  return slots
    .map((s) => `- ${s.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" })}`)
    .join("\n");
}

// Mensajes cortos y cálidos que se mandan JUSTO ANTES de los datos completos de la cita
// (ver buildConfirmationMessage más abajo) — así la conversación se siente en dos tiempos
// naturales ("listo, ya te mando los datos..." y después la tarjeta con todo) en vez de
// tirarle al paciente un bloque grande de texto de una sola vez.
function buildBookAckMessage() {
  return '¡Perfecto! ✅ Ya quedó agendado tu turno. Te paso los datos en un toque...';
}
function buildRescheduleAckMessage() {
  return '¡Listo! 🔁 Ya reagendé tu turno. Te paso los datos actualizados en un toque...';
}

// Arma el mensaje de confirmación final que recibe el paciente por WhatsApp, con formato
// enriquecido (negrita nativa de WhatsApp con un solo asterisco) y emojis. Se construye
// SIEMPRE de este lado con los datos reales que quedaron guardados — nunca se deja que
// la IA redacte los detalles de la cita, para que el paciente nunca lea algo distinto de
// lo que efectivamente quedó en la agenda.
function buildConfirmationMessage({ practice, service, start, professionalName, title = '✅ *Turno confirmado*' }) {
  const dateStr = start.toLocaleString("es-AR", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  });
  const addressText = [practice?.address, practice?.address_city].filter(Boolean).join(', ');
  const mapsLink = buildMapsLink(practice);

  const lines = [
    title,
    `📅 *Día y horario:* ${dateStr}`,
    `🩺 *Servicio:* ${service?.name || 'Consulta'}`,
  ];
  if (professionalName) lines.push(`👤 *Profesional:* ${professionalName}`);
  if (addressText) lines.push(`📍 *Dirección:* ${addressText}`);
  if (mapsLink) lines.push(`🗺️ ${mapsLink}`);
  lines.push('');
  lines.push('¡Te esperamos! 😊');
  lines.push('🔁 *Si necesitás reagendar o cancelar, avisanos por este mismo medio* 😊');
  lines.push('⏰ Te vamos a recordar la cita unas horas antes.');
  return lines.join('\n');
}

// Le avisa al PROFESIONAL (dueño de la cuenta) por email cuando el bot de WhatsApp
// agenda, reagenda o cancela un turno solo, sin que nadie del consultorio haya estado
// mirando la pantalla. Antes esto no existía: el bot le confirmaba todo al paciente por
// WhatsApp, pero el profesional se enteraba recién al abrir la Agenda — sin ningún aviso.
// Best-effort: si falla el envío, no debe romper la respuesta al paciente.
async function notifyProfessionalOfBotAction(base44, practice, { verb, appt }) {
  // Push primero: no depende de que professional_email esté cargado (el email sí lo
  // necesita, ver el early-return de abajo) y no bloquea nada si falla o si todavía no hay
  // VAPID configurado.
  try {
    const { sendPushToUsers, getPracticeRecipientUserIds } = await import('./push.ts');
    const recipients = await getPracticeRecipientUserIds(base44, practice);
    await sendPushToUsers(base44, recipients, {
      title: `El bot ${verb} un turno`,
      body: `${appt.patient_name || 'Un paciente'} — ${appt.service_name || 'Consulta'}`,
      url: '/agenda',
      tag: `appt-${appt.id}`,
    });
  } catch (e) {
    console.error('push notifyProfessionalOfBotAction error:', e?.message || e);
  }

  try {
    if (!practice?.professional_email) return;
    const dateStr = new Date(appt.start_datetime).toLocaleString("es-AR", {
      weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    });
    // No dependemos de `req` (orchestrateConversation no lo recibe) — usamos el dominio
    // público configurado por el admin. Si no está configurado, mandamos el aviso igual
    // pero sin el botón "Ver en la Agenda" (mejor eso que armar un link a un dominio
    // genérico incorrecto).
    let appUrl = "";
    try {
      const cfgList = await base44.asServiceRole.entities.PlatformConfig.filter({});
      appUrl = (cfgList?.[0]?.app_base_url || "").trim().replace(/\/+$/, "");
    } catch {}
    await sendEmail(base44, {
      to: practice.professional_email,
      subject: `El bot de WhatsApp ${verb} un turno — ${appt.service_name || "Consulta"}`,
      body: buildEmailHtml({
        title: `Turno ${verb} por el bot`,
        greeting: `Hola ${practice.practice_name || ""}`.trim(),
        lines: [`El bot de WhatsApp acaba de ${verb} un turno con ${appt.patient_name || "un paciente"}, sin que hiciera falta que lo atiendas vos.`],
        details: [
          { label: "Paciente", value: appt.patient_name || "—" },
          { label: "Servicio", value: appt.service_name || "—" },
          { label: "Día y horario", value: dateStr },
        ],
        primaryButton: appUrl ? { label: "Ver en la Agenda", url: `${appUrl}/agenda?edit=${appt.id}` } : null,
        footer: practice.practice_name || "Kame Agenda",
      }),
    });
  } catch (e) {
    console.error("notifyProfessionalOfBotAction error:", e?.message || e);
  }
}

export async function getPlatformConfig(base44) {
  const list = await base44.asServiceRole.entities.PlatformConfig.filter({});
  return list?.[0] || null;
}

export async function findPracticeByAccount(base44, accountId) {
  if (!accountId) return null;
  const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
  return practices.find((p) => p.zernio_account_id === accountId) || null;
}

export async function sendWhatsApp(base44, { apiKey, accountId, conversationId, phone, message }) {
  if (!apiKey) throw new Error("Zernio API key no configurada");
  if (!accountId) throw new Error("Zernio Account ID no configurado");

  const url = conversationId
    ? `https://zernio.com/api/v1/inbox/conversations/${conversationId}/messages`
    : `https://zernio.com/api/v1/inbox/messages`;

  const body = conversationId
    ? { accountId, message }
    : { accountId, phone, message };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zernio API ${res.status}: ${errText}`);
  }
  return await res.json();
}

export async function hmacSha256(secret, body) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function orchestrateConversation(base44, ctx) {
  const { fromPhone, professionalId, conversationId, accountId, practice, text } = ctx;

  const botList = await base44.asServiceRole.entities.BotConfig.filter({});
  const bot = botList?.[0] || {};
  // Prioridad del prompt de OBJETIVO: lo que cargó el propio profesional en su
  // Configuración del bot > lo que dejó cargado el admin en BotConfig (compatibilidad
  // con lo que ya había antes) > el predeterminado de la plataforma.
  // El prompt de TONO es nuevo (no tenía equivalente antes), así que solo tiene el
  // override del profesional y el predeterminado.
  const objectivePrompt = practice?.bot_objective_prompt || bot.system_prompt || DEFAULT_OBJECTIVE_PROMPT;
  const tonePrompt = practice?.bot_tone_prompt || DEFAULT_TONE_PROMPT;
  const assistantName = (practice?.bot_assistant_name || "").trim();
  const nameBlock = assistantName
    ? `Te llamás ${assistantName}. Presentáte con ese nombre si el paciente te pregunta cómo te llamás, o de forma natural al saludar por primera vez en la conversación — no hace falta repetirlo en cada mensaje.`
    : `No tenés un nombre propio asignado: presentate genéricamente como "la asistente virtual del consultorio" si te preguntan cómo te llamás.`;
  const systemPrompt = `${objectivePrompt}\n\n${tonePrompt}\n\n${nameBlock}`;
  const model = bot.model && bot.model !== "automatic" ? bot.model : undefined;
  // Cuánto esperar antes de mandar la respuesta por WhatsApp, configurable por el
  // profesional (5/15/30/60s) — para que no se sienta instantáneo/robotizado.
  const responseDelaySeconds = Number(practice?.bot_response_delay_seconds) || DEFAULT_RESPONSE_DELAY_SECONDS;

  const isClinic = practice?.plan === "clinic";

  const [services, patients, appts, allHistory, professionals, availability] = await Promise.all([
    base44.asServiceRole.entities.Service.filter({ active: true }),
    base44.asServiceRole.entities.Patient.filter({}),
    base44.asServiceRole.entities.Appointment.filter({}),
    base44.asServiceRole.entities.Conversation.filter({ professional_id: professionalId, phone: fromPhone }),
    isClinic ? base44.asServiceRole.entities.Professional.filter({ practice_owner_id: professionalId, active: true }) : Promise.resolve([]),
    base44.asServiceRole.entities.Availability.filter({ practice_owner_id: professionalId }),
  ]);

  const myServices = (services || []).filter((s) => s.created_by_id === professionalId);
  // TODAS las citas de este consultorio (no de toda la plataforma). OJO: el campo
  // correcto para esto es `professional_id` — `created_by_id` en una cita creada por el
  // bot/una función del servidor SIEMPRE es un id genérico interno del sistema, nunca el
  // id del profesional, así que comparar contra eso nunca matcheaba. Confirmado en vivo:
  // esto rompía "tus citas" (reagendar/cancelar nunca encontraba nada) Y hacía que el
  // cálculo de horarios disponibles chequeara contra TODAS las citas de TODOS los
  // consultorios de la plataforma en vez de solo las propias.
  const myAppts = (appts || []).filter((a) => a.professional_id === professionalId);
  const existingPatient = findPatientByCanonicalPhone(
    (patients || []).filter((p) => p.professional_id === professionalId),
    fromPhone
  );
  const myUpcoming = myAppts
    .filter((a) => new Date(a.start_datetime) > new Date() && a.status !== "cancelled")
    .slice(0, 5);
  // Citas futuras DE ESTE PACIENTE puntual (no de todo el consultorio) — es lo que el bot
  // necesita para saber qué reagendar o cancelar cuando el paciente lo pide sin repetir
  // todos los datos. Antes no existía este recorte: el bot no tenía forma de saber cuál de
  // las citas del paciente había que tocar, así que un pedido de "reagendame" no llegaba
  // a ningún lado.
  const myPatientUpcoming = existingPatient
    ? myAppts.filter(
        (a) =>
          a.patient_id === existingPatient.id &&
          new Date(a.start_datetime) > new Date() &&
          a.status !== "cancelled"
      )
    : [];
  const history = (allHistory || [])
    .sort((a, b) => new Date(b.created_date) - new Date(a.created_date))
    .slice(0, 10)
    .reverse();

  const servicesText = myServices
    .map((s) => `- ${s.name} (${s.duration_minutes} min${s.price ? ", $" + s.price : ""})`)
    .join("\n");
  const upcomingText = myUpcoming
    .map((a) => `- ${new Date(a.start_datetime).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" })} ${a.service_name} (${a.status})`)
    .join("\n");
  const patientUpcomingText = myPatientUpcoming
    .map((a) => `- ${a.service_name} — ${new Date(a.start_datetime).toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}`)
    .join("\n");
  const patientText = existingPatient
    ? `Paciente existente: ${existingPatient.first_name} ${existingPatient.last_name || ""}`.trim()
    : "Paciente nuevo (no registrado aún)";
  const historyText = history
    .map((h) => `${h.role === "user" ? "Paciente" : "Asistente"}: ${h.text}`)
    .join("\n");

  // Consultorios con plan Clinic tienen varios profesionales bajo el mismo WhatsApp: el
  // bot le pregunta al paciente con quién/qué especialidad quiere agendar antes de
  // confirmar, salvo que ya lo haya dicho en el historial. OJO: esto depende de que
  // realmente HAYA profesionales cargados, no solo del plan — confirmado en vivo que un
  // consultorio en plan Clinic pero sin nadie cargado igual preguntaba "¿con qué
  // profesional preferis?" sin sentido, ya que no hay ninguno entre quien elegir.
  const hasProfessionals = isClinic && (professionals || []).length > 0;
  const professionalsText = (professionals || [])
    .map((p) => `- ${p.first_name} ${p.last_name || ""}${p.specialty ? ` (${p.specialty})` : ""}`.trim())
    .join("\n");
  const professionalsBlock = hasProfessionals
    ? `\n=== PROFESIONALES DISPONIBLES ===\n${professionalsText}\nEste consultorio tiene varios profesionales. Si el paciente todavía no dijo con quién o qué especialidad prefiere, PREGUNTASELO antes de agendar. Si dice que no tiene preferencia, se lo asigna automáticamente. Cuando agendes, completá appointment.professional_name con el nombre elegido (o dejalo vacío si no tiene preferencia).\n`
    : "";

  // SIN esto, la IA no tiene forma de saber qué día es "hoy" y termina adivinando —
  // confirmado en vivo: un pedido de "mañana a las 10" se agendó para el jueves en vez del
  // día siguiente real, porque la IA no tenía ninguna fecha de referencia en el prompt.
  // Se lo damos explícito, con el día de la semana en palabras (no solo la fecha) para que
  // no tenga ni que calcularlo.
  const nowAR = new Date();
  const todayLabel = nowAR.toLocaleDateString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const nowTimeLabel = nowAR.toLocaleTimeString("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    hour: "2-digit",
    minute: "2-digit",
  });
  const todayIsoDate = nowAR.toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }); // YYYY-MM-DD

  const contextPrompt = `${systemPrompt}

=== FECHA Y HORA ACTUAL ===
Hoy es ${todayLabel} (${todayIsoDate}), son las ${nowTimeLabel} hora de Argentina. Cuando el paciente diga "hoy", "mañana", "pasado mañana", un día de la semana ("el viernes", "el lunes que viene") u otra referencia relativa, calculá la fecha exacta a partir de ESTA fecha de hoy, nunca de memoria ni de otra suposición. IMPORTANTE: para calcular appointment.datetime, usá EXCLUSIVAMENTE la fecha/hora que el paciente pidió en su ÚLTIMO mensaje (el de "NUEVO MENSAJE DEL PACIENTE" más abajo) — ignorá por completo horarios que se hayan mencionado en mensajes ANTERIORES del historial (intentos fallidos, ideas descartadas, etc.), salvo que el paciente esté respondiendo "sí"/confirmando explícitamente esa propuesta concreta que vos mismo le acabas de hacer en tu mensaje anterior. El texto de tu respuesta y el valor de appointment.datetime SIEMPRE tienen que describir exactamente el mismo día y hora — nunca uno distinto del otro.

=== CONTEXTO DEL CONSULTORIO ===
Consultorio: ${practice?.practice_name || ""}
Especialidad: ${practice?.specialty || ""}
${patientText}
${professionalsBlock}
Servicios disponibles:
${servicesText || "(sin servicios cargados)"}

Próximas citas del consultorio:
${upcomingText || "(ninguna)"}

Tus citas (las de ESTE paciente puntual, con quién estás hablando ahora):
${patientUpcomingText || "(no tiene ninguna cita próxima)"}

=== HISTORIAL DE CONVERSACIÓN ===
${historyText || "(sin historial)"}

=== NUEVO MENSAJE DEL PACIENTE ===
${text}

Instrucciones: Respondé al paciente. Configurá "action" según lo que el paciente quiera hacer:
- "book": para agendar un turno NUEVO. Necesitás tener servicio y fecha/hora completos${isClinic ? ", y ya resuelto con qué profesional o que no tiene preferencia" : ""}. Completá appointment.service_name (exacto, tal cual aparece en "Servicios disponibles") y appointment.datetime en ISO 8601 CON offset de Argentina, ej. "2026-09-07T10:00:00-03:00" (nunca sin el "-03:00" al final)${isClinic ? ", y appointment.professional_name si eligió a alguien" : ""}. Si el paciente es NUEVO (mirá el bloque de arriba) y ya te dijo su nombre en algún momento de la conversación, completá también appointment.patient_first_name — así queda registrado bien en vez de como "Paciente" genérico. Si falta información, pedisela en vez de adivinar. NO hace falta que vos verifiques si ese horario está realmente libre — eso lo valida el sistema automáticamente contra la agenda real: si el horario elegido no está disponible, el sistema le va a ofrecer al paciente 3 alternativas reales en tu lugar, así que podés intentar el action="book" con confianza en cuanto tengas los datos.
- "reschedule": cuando el paciente pide cambiar el día/hora de una cita que YA tiene (mirá "Tus citas" arriba). Completá appointment.datetime con la nueva fecha/hora (mismo formato ISO con offset). Si el paciente tiene más de una cita próxima, completá también appointment.service_name con el nombre EXACTO (tal cual figura en el catálogo) del servicio de la cita que está reagendando, para indicar cuál de esas es (si no lo aclaró y hay ambigüedad, PREGUNTASELO en vez de adivinar cuál). Si además el paciente pide cambiar el SERVICIO de esa cita (ej. "cambiame a consulta de marketing", "quiero que sea la otra consulta"), completá appointment.service_name con el nombre EXACTO del servicio NUEVO que pidió (tal cual figura en el catálogo de servicios de arriba) — el sistema se encarga de actualizarlo y de validar que el horario elegido también sea válido para la duración de ese servicio nuevo. Igual que con "book", el sistema valida la disponibilidad real y ofrece alternativas si hace falta.
- "cancel": cuando el paciente pide cancelar/anular una cita que ya tiene. Completá appointment.service_name solo si hace falta desambiguar entre varias citas próximas suyas.
- "none": para cualquier otra respuesta (preguntas, saludos, falta info todavía).

REGLA CRÍTICA SOBRE DISPONIBILIDAD — LEÉ ESTO CON CUIDADO: VOS NUNCA sabés qué horarios están realmente libres. No tenés acceso directo a la agenda real — SOLO el sistema lo sabe, y SOLO te lo dice DESPUÉS de que vos configures action="book" o "reschedule" con un servicio y un datetime concretos. Por lo tanto:
- NUNCA le digas al paciente en tu propio texto libre qué horarios "tenés disponibles" (ej. "tengo a las 9, 10:30 o 11:30") si esos horarios NO vinieron de un resultado real del sistema en ESTE mismo intercambio. Inventar una lista de horarios "disponibles" por tu cuenta es directamente mentirle al paciente con datos falsos, aunque suene razonable.
- Si el paciente te da CUALQUIER día y horario concreto (aunque sea la primera vez que lo menciona, aunque no estés segura de si va a estar libre, aunque vos "creas" que ya le dijiste que no antes), IGUAL configurá action="book" (o "reschedule") con esos datos exactos y dejá que el sistema decida. Nunca rechaces un horario en tu propio texto sin haber intentado la acción primero.
- El sistema SIEMPRE responde: si el horario pedido está libre, se agenda solo y el paciente recibe la confirmación formateada automáticamente; si NO está libre, el sistema reemplaza tu respuesta por un mensaje con hasta 3 alternativas REALES sacadas de la agenda. Vos no tenés que generar esas alternativas ni decidir si algo está libre — solo intentar la acción con los datos que te dio el paciente.
- Si el paciente todavía no dio NINGÚN día/horario concreto (por ejemplo, solo pregunta "¿cuándo tenés lugar?" sin proponer nada), ahí sí usás action="none" y le pedís que te diga un día y horario que le venga bien — sin inventar ninguna lista de horarios vos misma.
- PROHIBIDO TERMINANTE: nunca respondas (ni en este mensaje ni citando uno anterior) frases como "no tengo disponibilidad a las X", "no cuento con ese horario", "esa hora no está libre" o equivalentes, salvo que hayas configurado action="book"/"reschedule" EN ESTE MISMO mensaje con ese datetime exacto y haya sido el propio sistema (no vos) el que determinó que no estaba libre. No importa si en un mensaje anterior el sistema ya rechazó ese mismo horario: cada vez que el paciente lo repita o insista, hay que volver a intentar action="book" con esos datos — la disponibilidad puede haber cambiado, y nunca es tuya la decisión de rechazarlo en texto libre.

REGLA CRÍTICA E INQUEBRANTABLE: NUNCA le digas al paciente que un turno quedó "confirmado", "agendado", "reagendado", "cancelado" o "listo" salvo que en ESTE MISMO mensaje hayas configurado action="book"/"reschedule"/"cancel" con los datos completos que hacen falta en cada caso. Si action es "none", tu texto NO puede sonar a confirmación de nada nuevo — como mucho podés recordarle una cita que YA figura en "Tus citas" arriba (y solo si realmente está ahí, con esos datos exactos). Nunca dés por hecho que algo quedó agendado, reagendado o cancelado porque lo mencionaste antes en la conversación: la única fuente de verdad es la lista de "Tus citas" / "Próximas citas del consultorio" de ESTE mensaje. Si no estás seguro de qué cita tocar, preguntá en vez de asumir.`;

  const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: contextPrompt,
    ...(model ? { model } : {}),
    response_json_schema: {
      type: "object",
      properties: {
        reply: { type: "string", description: "Respuesta al paciente" },
        action: { type: "string", enum: ["none", "book", "reschedule", "cancel"] },
        appointment: {
          type: "object",
          properties: {
            service_name: { type: "string" },
            datetime: { type: "string", description: "ISO 8601" },
            professional_name: { type: "string", description: "Nombre del profesional elegido por el paciente, si el consultorio tiene varios. Vacío si no tiene preferencia." },
            patient_first_name: { type: "string", description: "Nombre de pila del paciente, SOLO si es un paciente NUEVO (mirá el bloque 'Paciente nuevo/existente' del contexto) y ya te lo dijo en algun momento de esta conversación. Dejalo vacío si el paciente ya está registrado, o si todavía no te dijo su nombre." },
          },
        },
      },
      required: ["reply", "action"],
    },
  });

  const reply = typeof llmRes === "string" ? JSON.parse(llmRes) : llmRes;

  // A partir de acá, reply.reply puede quedar SOBRESCRITO según lo que realmente haya
  // pasado en la base de datos. Antes se mandaba el texto de la IA literal (que podía decir
  // "confirmado" sin haberse guardado nada) — ahora el mensaje final siempre refleja la
  // realidad, no lo que la IA cree que pasó.
  let finalReplyText = reply.reply;
  // Cuando la cita se agenda o reagenda con éxito, `finalReplyText` pasa a ser un
  // mensaje CORTO y cálido ("¡listo! ya te mando los datos..."), y esto se completa con
  // los datos completos de la cita — se manda como un SEGUNDO mensaje de WhatsApp, un
  // rato después del primero, para que la conversación se sienta en dos tiempos en vez de
  // un bloque único de texto largo apenas confirma.
  let secondaryReplyText = null;
  let appointmentCreated = null;

  if (
    reply.action === "book" &&
    reply.appointment?.service_name &&
    reply.appointment?.datetime
  ) {
    const service = myServices.find(
      (s) => s.name.trim().toLowerCase() === reply.appointment.service_name.trim().toLowerCase()
    );

    if (!service) {
      // Antes esto fallaba en silencio: no se creaba la cita pero igual se mandaba el
      // "confirmado" de la IA. Ahora, si no reconocemos el servicio, se lo decimos al
      // paciente en vez de mentirle.
      const availableNames = myServices.map((s) => s.name).join(", ");
      finalReplyText = `Disculpá, no tengo cargado un servicio que coincida exactamente con "${reply.appointment.service_name}". Los servicios disponibles son: ${availableNames || "(ninguno cargado todavía)"}. ¿Cuál de estos te gustaría agendar?`;
    } else {
      // La IA suele devolver el datetime SIN offset de zona horaria (ej. "2026-09-07T10:00:00").
      // Sin esto, JavaScript lo interpreta como UTC, no como hora Argentina — y un pedido
      // para "las 10hs" terminaba guardándose como las 07:00 locales (probado en vivo, un
      // desfase real de 3 horas). Si la IA no puso ningún offset explícito (ni "Z" ni
      // "+HH:MM"/"-HH:MM"), asumimos que quiso decir hora Argentina y lo forzamos acá.
      let rawDatetime = reply.appointment.datetime;
      if (rawDatetime && !/(Z|[+-]\d{2}:\d{2})$/.test(rawDatetime)) {
        rawDatetime = `${rawDatetime}-03:00`;
      }
      const start = new Date(rawDatetime);
      const end = new Date(start.getTime() + (service.duration_minutes || 30) * 60000);

      if (isNaN(start.getTime())) {
        finalReplyText = "No pude entender bien la fecha y hora. ¿Podés indicarme el día y horario de otra forma? Por ejemplo: 'mañana a las 15hs'.";
      } else {
        // Chequeo real de disponibilidad ANTES de confirmar nada: la IA puede
        // equivocarse o alucinar que un horario está libre. Ahora esto valida contra el
        // horario de atención real, los descansos, los días bloqueados, las citas ya
        // tomadas Y el Google Calendar personal del profesional (antes NO chequeaba
        // horario de atención ni Google Calendar, solo otras citas de Kame — el bot podía
        // agendar fuera de horario sin que nadie lo notara). Acepta CUALQUIER horario
        // realmente libre dentro del horario laboral (no exige que caiga en una grilla
        // redonda — eso rechazaba horarios válidos que no eran múltiplo exacto de la
        // duración del servicio, confirmado en vivo). La grilla (generateSlotsForDay) se
        // usa sólo para OFRECER alternativas cuando hace falta, no para aceptar o no.
        let assignedProfessionalRefId;
        if (isClinic && professionals?.length) {
          const chosenName = (reply.appointment.professional_name || "").toLowerCase().trim();
          const candidate = chosenName
            ? professionals.find((p) => `${p.first_name} ${p.last_name || ""}`.toLowerCase().includes(chosenName))
            : null;
          assignedProfessionalRefId = candidate ? candidate.id : null; // null = sin preferencia, probamos con todos
        }
        const candidateProfessionalIds = isClinic && professionals?.length
          ? (assignedProfessionalRefId ? [assignedProfessionalRefId] : professionals.map((p) => p.id))
          : [null]; // null = el dueño de la cuenta (planes sin equipo)

        const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);

        let matched = null;
        let referenceSlots = [];
        for (const profRefId of candidateProfessionalIds) {
          let googleBusy = [];
          try {
            googleBusy = await getGoogleBusyRanges(base44, professionalId, profRefId || undefined, dayStart.toISOString(), dayEnd.toISOString());
          } catch { /* si Google falla, seguimos sin ese dato en vez de bloquear todo el chequeo */ }
          if (isTimeAvailable(start, end, service, availability, myAppts, profRefId || null, googleBusy)) {
            matched = { professionalRefId: profRefId || undefined };
            break;
          }
          if (!referenceSlots.length) referenceSlots = generateSlotsForDay(start, service, availability, myAppts, profRefId || null, googleBusy);
        }

        if (!matched) {
          // No había ningún profesional con ESE horario exacto libre. En vez de un "no
          // disponible" genérico, ofrecemos alternativas REALES (nunca inventadas): las 3
          // más cercanas a lo que pidió, del mismo día si había algo libre, o del próximo
          // día real con lugar si ese día está completo o bloqueado.
          let offerSlots = referenceSlots;
          if (!offerSlots.length) {
            const refProfId = candidateProfessionalIds[0];
            const found = findNextAvailableDaySlots(start, service, availability, myAppts, refProfId || null, []);
            offerSlots = found.slots;
          }
          const options = pickClosestSlots(offerSlots, start, 3);
          finalReplyText = options.length
            ? `Che, disculpá — ese horario exacto no está disponible. Te propongo estas opciones:\n${formatSlotList(options)}\n\n¿Te sirve alguna?`
            : `Che, disculpá — no encontré horarios disponibles cerca de esa fecha. ¿Podés decirme otro día que te venga bien?`;
        } else {
          assignedProfessionalRefId = matched.professionalRefId;
          let patientId = existingPatient?.id;
          // Si es un paciente NUEVO y la IA logró sacarle el nombre en la conversación
          // (appointment.patient_first_name), lo usamos acá en vez de guardarlo como
          // "Paciente" genérico para siempre. Antes esto NUNCA pasaba — ni se le pedía el
          // nombre al paciente, ni había forma de que la IA lo devolviera aunque se lo
          // preguntara: la ficha quedaba con el nombre "Paciente" a mano de por vida.
          const suppliedFirstName = (reply.appointment.patient_first_name || "").trim();
          let patientName = existingPatient
            ? `${existingPatient.first_name} ${existingPatient.last_name || ""}`.trim()
            : (suppliedFirstName || "Paciente WhatsApp");
          try {
            if (!patientId) {
              const newPatient = await base44.asServiceRole.entities.Patient.create({
                first_name: suppliedFirstName || "Paciente",
                phone: fromPhone,
                professional_id: professionalId,
              });
              patientId = newPatient.id;
              patientName = newPatient.first_name;
            }

            const newAppt = await base44.asServiceRole.entities.Appointment.create({
              patient_id: patientId,
              patient_name: patientName,
              service_id: service.id,
              service_name: service.name,
              start_datetime: start.toISOString(),
              end_datetime: end.toISOString(),
              status: "confirmed",
              origin: "whatsapp",
              professional_id: professionalId,
              professional_ref_id: assignedProfessionalRefId,
              confirm_token: crypto.randomUUID(),
              cancel_token: crypto.randomUUID(),
            });

            appointmentCreated = newAppt;

            // Empuja el evento a Google Calendar de quien atiende, igual que hace la
            // reserva pública y el formulario manual — antes esto nunca se llamaba para
            // citas creadas por el bot de WhatsApp.
            try {
              await base44.asServiceRole.functions.invoke("syncAppointmentGoogle", { appointmentId: newAppt.id });
            } catch (e) {
              console.error("syncAppointmentGoogle invoke error:", e?.message || e);
            }

            // El mensaje de confirmación lo armamos NOSOTROS con los datos reales que se
            // guardaron (nunca dejamos que la IA redacte los detalles), con el formato
            // enriquecido (negrita + emojis) definido en buildConfirmationMessage.
            // Si hay varios profesionales (clinic) mostramos quién atiende; si no, mostramos
            // el nombre del consultorio/profesional único (antes esta línea directamente no
            // aparecía para planes sin equipo, dejando la confirmación incompleta).
            const professionalName = assignedProfessionalRefId
              ? (() => {
                  const p = professionals.find((pr) => pr.id === assignedProfessionalRefId);
                  return p ? `${p.first_name} ${p.last_name || ""}`.trim() : undefined;
                })()
              : (practice?.practice_name || undefined);
            finalReplyText = buildBookAckMessage();
            secondaryReplyText = buildConfirmationMessage({ practice, service, start, professionalName });

            try {
              await base44.asServiceRole.functions.invoke("sendAppointmentConfirmation", { appointment_id: newAppt.id });
            } catch (e) {
              console.error("sendAppointmentConfirmation invoke error:", e?.message || e);
            }
            // Aviso al PROFESIONAL de que el bot agendó solo un turno nuevo — antes esto
            // no pasaba y el consultorio se enteraba recién al abrir la Agenda a mano.
            await notifyProfessionalOfBotAction(base44, practice, { verb: "agendó", appt: newAppt });
          } catch (e) {
            console.error("Appointment.create error:", e?.message || e);
            finalReplyText = "Uy, tuve un problema técnico al guardar tu turno. ¿Podés confirmarme de nuevo el día y horario para intentarlo otra vez?";
          }
        }
      }
    }
  } else if (reply.action === "reschedule" && reply.appointment?.datetime) {
    // El paciente quiere mover una cita que YA tiene — antes esta acción ni siquiera
    // existía: el bot no tenía forma de tocar una cita existente, así que un pedido de
    // "reagendame" no rompía nada pero tampoco hacía nada (ni avisaba al paciente).
    let target = null;
    const wantedService = (reply.appointment.service_name || "").trim().toLowerCase();
    if (wantedService) {
      target = myPatientUpcoming.find((a) => (a.service_name || "").trim().toLowerCase() === wantedService);
    }
    if (!target && myPatientUpcoming.length === 1) target = myPatientUpcoming[0];

    if (!target) {
      finalReplyText = myPatientUpcoming.length === 0
        ? "No encontré ninguna cita tuya próxima para reagendar. ¿Querés que te agende un turno nuevo?"
        : `Tenés más de un turno próximo (${myPatientUpcoming.map((a) => a.service_name).join(", ")}). ¿Cuál de esos querés reagendar?`;
    } else {
      // Si el paciente pidió, ADEMÁS del horario nuevo, un servicio DISTINTO al que ya
      // tenía esa cita (ej. "cambiame a consulta de marketing"), antes esto se ignoraba
      // por completo: quedaba reagendada la hora pero con el servicio viejo, sin avisar de
      // nada — confirmado en vivo. Ahora, si el nombre pedido coincide con un servicio real
      // del catálogo, lo tratamos también como un cambio de servicio (no solo de horario), y
      // usamos SU duración real para validar el horario y armar la cita — dos servicios
      // pueden durar distinto, así que no alcanza con reusar el horario/duración viejos.
      let newService = null;
      let serviceNotFound = false;
      if (wantedService && wantedService !== (target.service_name || "").trim().toLowerCase()) {
        newService = myServices.find((s) => s.name.trim().toLowerCase() === wantedService) || null;
        if (!newService) serviceNotFound = true;
      }

      if (serviceNotFound) {
        const availableNames = myServices.map((s) => s.name).join(", ");
        finalReplyText = `Disculpá, no tengo cargado un servicio que coincida exactamente con "${reply.appointment.service_name}". Los servicios disponibles son: ${availableNames || "(ninguno cargado todavía)"}. ¿Cuál de estos te gustaría?`;
      } else {
      let rawDatetime = reply.appointment.datetime;
      if (rawDatetime && !/(Z|[+-]\d{2}:\d{2})$/.test(rawDatetime)) {
        rawDatetime = `${rawDatetime}-03:00`;
      }
      const start = new Date(rawDatetime);
      const durationMs = new Date(target.end_datetime).getTime() - new Date(target.start_datetime).getTime();
      const end = newService
        ? new Date(start.getTime() + (newService.duration_minutes || 30) * 60000)
        : new Date(start.getTime() + (durationMs > 0 ? durationMs : 30 * 60000));

      if (isNaN(start.getTime())) {
        finalReplyText = "No pude entender bien la nueva fecha y hora. ¿Podés indicármela de otra forma? Por ejemplo: 'mañana a las 15hs'.";
      } else {
        // Mismo chequeo real que en el agendado nuevo: horario de atención, descansos,
        // días bloqueados, otras citas y Google Calendar — no solo "choca con otra cita".
        // Resolvemos un objeto Service para calcular la grilla de horarios: si el paciente
        // pidió cambiar de servicio, usamos el NUEVO (con su propia duración real); si no,
        // el original (si sigue existiendo; si ya no existe, uno sintético con la duración
        // que ya tenía esa cita, para no dejar de poder reagendarla por eso).
        const targetService = newService
          || myServices.find((s) => s.name.trim().toLowerCase() === (target.service_name || "").trim().toLowerCase())
          || { name: target.service_name, duration_minutes: Math.max(5, Math.round((durationMs > 0 ? durationMs : 30 * 60000) / 60000)), margin_minutes: 0 };

        const dayStart = new Date(start); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(start); dayEnd.setHours(23, 59, 59, 999);
        let googleBusy = [];
        try {
          googleBusy = await getGoogleBusyRanges(base44, professionalId, target.professional_ref_id || undefined, dayStart.toISOString(), dayEnd.toISOString());
        } catch { /* si Google falla, seguimos sin ese dato */ }
        // Los slots se calculan contra TODAS las citas del consultorio salvo la que estamos
        // moviendo (así no choca contra sí misma). Usamos myAppts (escopeado a este
        // consultorio), no el `appts` crudo de toda la plataforma.
        const apptsExcludingTarget = myAppts.filter((a) => a.id !== target.id);
        // Acepta cualquier horario realmente libre dentro del horario laboral, no solo los
        // alineados a la grilla redonda (mismo criterio que en el agendado nuevo).
        const isValidSlot = isTimeAvailable(start, end, targetService, availability, apptsExcludingTarget, target.professional_ref_id || null, googleBusy);

        if (!isValidSlot) {
          let offerSlots = generateSlotsForDay(start, targetService, availability, apptsExcludingTarget, target.professional_ref_id || null, googleBusy);
          if (!offerSlots.length) {
            const found = findNextAvailableDaySlots(start, targetService, availability, apptsExcludingTarget, target.professional_ref_id || null, []);
            offerSlots = found.slots;
          }
          const options = pickClosestSlots(offerSlots, start, 3);
          finalReplyText = options.length
            ? `Che, disculpá — ese horario nuevo no está disponible. Te propongo estas opciones:\n${formatSlotList(options)}\n\n¿Te sirve alguna?`
            : `Che, disculpá — no encontré horarios disponibles cerca de esa fecha. ¿Podés decirme otro día que te venga bien?`;
        } else {
          try {
            await base44.asServiceRole.entities.Appointment.update(target.id, {
              start_datetime: start.toISOString(),
              end_datetime: end.toISOString(),
              ...(newService ? { service_name: newService.name } : {}),
            });
            try {
              await base44.asServiceRole.functions.invoke("syncAppointmentGoogle", { appointmentId: target.id });
            } catch (e) {
              console.error("syncAppointmentGoogle invoke error (reschedule):", e?.message || e);
            }
            const professionalName = target.professional_ref_id
              ? (() => {
                  const p = (professionals || []).find((pr) => pr.id === target.professional_ref_id);
                  return p ? `${p.first_name} ${p.last_name || ""}`.trim() : undefined;
                })()
              : (practice?.practice_name || undefined);
            finalReplyText = buildRescheduleAckMessage();
            secondaryReplyText = buildConfirmationMessage({ practice, service: targetService, start, professionalName, title: '🔁 *Turno reagendado*' });
            await notifyProfessionalOfBotAction(base44, practice, {
              verb: "reagendó",
              appt: { ...target, start_datetime: start.toISOString(), ...(newService ? { service_name: newService.name } : {}) },
            });
          } catch (e) {
            console.error("Appointment.update error (reschedule):", e?.message || e);
            finalReplyText = "Uy, tuve un problema técnico al reagendar tu turno. ¿Podés confirmarme de nuevo el nuevo día y horario?";
          }
        }
      }
      }
    }
  } else if (reply.action === "cancel") {
    // Igual que reschedule: antes esta acción no existía, un pedido de cancelación por
    // WhatsApp no tenía forma de tocar la cita real.
    let target = null;
    const wantedService = (reply.appointment?.service_name || "").trim().toLowerCase();
    if (wantedService) {
      target = myPatientUpcoming.find((a) => (a.service_name || "").trim().toLowerCase() === wantedService);
    }
    if (!target && myPatientUpcoming.length === 1) target = myPatientUpcoming[0];

    if (!target) {
      finalReplyText = myPatientUpcoming.length === 0
        ? "No encontré ninguna cita tuya próxima para cancelar."
        : `Tenés más de un turno próximo (${myPatientUpcoming.map((a) => a.service_name).join(", ")}). ¿Cuál de esos querés cancelar?`;
    } else {
      try {
        await base44.asServiceRole.entities.Appointment.update(target.id, { status: "cancelled" });
        try {
          await base44.asServiceRole.functions.invoke("syncAppointmentGoogle", { appointmentId: target.id });
        } catch (e) {
          console.error("syncAppointmentGoogle invoke error (cancel):", e?.message || e);
        }
        finalReplyText = `Listo, cancelé tu turno de ${target.service_name}. Si querés agendar otro, avisame.`;
        await notifyProfessionalOfBotAction(base44, practice, { verb: "canceló", appt: target });
      } catch (e) {
        console.error("Appointment.update error (cancel):", e?.message || e);
        finalReplyText = "Uy, tuve un problema técnico al cancelar tu turno. ¿Podés intentar de nuevo en un momento?";
      }
    }
  }

  // Envía y guarda UN mensaje del bot: registra la Conversation, intenta mandarlo por
  // WhatsApp con reintentos, y marca cómo terminó (wasender_msg_id o delivery_failed).
  // Se usa una vez para el mensaje único normal, o dos veces (con una demora entre medio)
  // cuando hay un mensaje corto de confirmación + los datos completos de la cita.
  //
  // Confirmado en vivo: el plan trial de WasenderAPI limita a 1 mensaje por minuto — el
  // segundo mensaje de cualquier conversación rápida choca con un 429 que trae
  // "retry_after" (en segundos). Reintentar rápido (1s/3s/6s) no servía de nada contra ese
  // límite específico. Ahora, si el error trae retry_after, esperamos ESE tiempo real (con
  // un tope de seguridad) en vez de un número fijo que no alcanza.
  const { sendWhatsAppMessage } = await import("./whatsapp-providers.ts");
  async function sendAndSaveBotMessage(text) {
    const savedMsg = await base44.asServiceRole.entities.Conversation.create({
      phone: fromPhone,
      professional_id: professionalId,
      role: "assistant",
      text,
      conversation_id: conversationId,
      account_id: accountId,
      sent_by: "bot",
    });

    const MAX_RETRY_WAIT_MS = 90000; // tope de seguridad por intento
    const fallbackDelays = [1000, 3000, 6000];
    const maxAttempts = 3;
    let sent = false;
    let lastError = null;
    let sendResult = null;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        sendResult = await sendWhatsAppMessage(base44, practice, fromPhone, text);
        sent = true;
        break;
      } catch (e) {
        lastError = e;
        console.error(`sendWhatsAppMessage intento ${attempt + 1} falló:`, e?.message || e);
        if (attempt < maxAttempts - 1) {
          const wait = e?.retryAfterMs
            ? Math.min(e.retryAfterMs, MAX_RETRY_WAIT_MS)
            : fallbackDelays[attempt];
          console.error(`Esperando ${wait}ms antes del próximo intento (retry_after real: ${e?.retryAfterMs || "n/a"})`);
          await new Promise((r) => setTimeout(r, wait));
        }
      }
    }
    const wasenderMsgId = sendResult?.data?.msgId;
    if (sent && wasenderMsgId) {
      try {
        await base44.asServiceRole.entities.Conversation.update(savedMsg.id, { wasender_msg_id: String(wasenderMsgId) });
      } catch { /* no romper el flujo por esto */ }
    }
    if (!sent) {
      console.error("sendWhatsAppMessage: se agotaron los reintentos, el mensaje quedó sin enviar:", lastError?.message || lastError);
      try {
        await base44.asServiceRole.entities.Conversation.update(savedMsg.id, { delivery_failed: true });
      } catch { /* no romper el flujo por esto */ }
    }
  }

  // Demora configurable antes de mandar cada mensaje (practice.bot_response_delay_seconds,
  // 5/15/30/60s) — para que la conversación no se sienta instantánea/robotizada. Se aplica
  // ANTES del primer mensaje (como antes) y, si hay un segundo mensaje (los datos completos
  // de la cita después del mensaje corto de confirmación), TAMBIÉN antes de ese — así se
  // siente como dos tiempos naturales de conversación, no un bloque único de texto largo.
  if (responseDelaySeconds > 0) {
    await new Promise((r) => setTimeout(r, responseDelaySeconds * 1000));
  }
  await sendAndSaveBotMessage(finalReplyText);

  if (secondaryReplyText) {
    if (responseDelaySeconds > 0) {
      await new Promise((r) => setTimeout(r, responseDelaySeconds * 1000));
    }
    await sendAndSaveBotMessage(secondaryReplyText);
  }

  return { ...reply, reply: finalReplyText, secondary_reply: secondaryReplyText, appointment_created: !!appointmentCreated };
}

const ZERNIO_BASE = "https://zernio.com/api/v1";

async function zernioFetch(path, init, apiKey) {
  const res = await fetch(`${ZERNIO_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Zernio API ${res.status} ${path}: ${errText}`);
  }
  const ct = res.headers.get("content-type") || "";
  return ct.includes("application/json") ? res.json() : res.text();
}

export async function createZernioProfile(apiKey, name, description) {
  const data = await zernioFetch("/profiles", { method: "POST", body: JSON.stringify({ name, description }) }, apiKey);
  return data?.profile?._id || data?.profileId || data?._id || null;
}

export async function getWhatsAppConnectUrl(apiKey, profileId, redirectUrl) {
  const params = new URLSearchParams({ profileId });
  if (redirectUrl) params.set("redirect_url", redirectUrl);
  const data = await zernioFetch(`/connect/whatsapp?${params}`, { method: "GET" }, apiKey);
  return data?.authUrl || data?.url || null;
}

export async function listZernioAccounts(apiKey) {
  const data = await zernioFetch("/accounts", { method: "GET" }, apiKey);
  return data?.accounts || [];
}

export function findWhatsAppAccount(accounts, profileId) {
  const wa = accounts.filter((a) => (a.platform || "").toLowerCase() === "whatsapp");
  // Zernio devuelve profileId como OBJETO ({ _id, name }), no como string plano — el
  // código viejo comparaba contra a.profile (campo que ni siquiera existe en la respuesta
  // real), así que nunca encontraba el match correcto y terminaba agarrando "la última
  // cuenta de la lista" a ciegas. Eso podía vincular el WhatsApp equivocado a un
  // profesional. Ahora comparamos explícitamente contra profileId._id (u, por las dudas,
  // el caso en que venga como string plano) y NO hacemos fallback ambiguo: si no hay
  // match exacto, mejor decir "pendiente" y reintentar que adivinar.
  return wa.find((a) => {
    const pid = typeof a.profileId === "object" && a.profileId !== null ? a.profileId._id : a.profileId;
    return pid === profileId;
  }) || null;
}

export function extractWhatsAppPhone(account) {
  if (!account) return "";
  return (
    account.phone ||
    account.identifier ||
    account.phoneNumber ||
    account.username ||
    account.whatsappNumber ||
    account.displayPhone ||
    ""
  );
}