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
  const systemPrompt =
    bot.system_prompt ||
    "Sos la asistente virtual del consultorio. Ayudá a agendar, confirmar y reprogramar citas. Sé amable, breve y profesional.";
  const model = bot.model && bot.model !== "automatic" ? bot.model : undefined;

  const isClinic = practice?.plan === "clinic";

  const [services, patients, appts, allHistory, professionals] = await Promise.all([
    base44.asServiceRole.entities.Service.filter({ active: true }),
    base44.asServiceRole.entities.Patient.filter({}),
    base44.asServiceRole.entities.Appointment.filter({}),
    base44.asServiceRole.entities.Conversation.filter({ professional_id: professionalId, phone: fromPhone }),
    isClinic ? base44.asServiceRole.entities.Professional.filter({ practice_owner_id: professionalId, active: true }) : Promise.resolve([]),
  ]);

  const myServices = (services || []).filter((s) => s.created_by_id === professionalId);
  const existingPatient = (patients || []).find((p) => p.phone === fromPhone);
  const myUpcoming = (appts || [])
    .filter(
      (a) =>
        a.created_by_id === professionalId &&
        new Date(a.start_datetime) > new Date() &&
        a.status !== "cancelled"
    )
    .slice(0, 5);
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
  const patientText = existingPatient
    ? `Paciente existente: ${existingPatient.first_name} ${existingPatient.last_name || ""}`.trim()
    : "Paciente nuevo (no registrado aún)";
  const historyText = history
    .map((h) => `${h.role === "user" ? "Paciente" : "Asistente"}: ${h.text}`)
    .join("\n");

  // Consultorios con plan Clinic tienen varios profesionales bajo el mismo WhatsApp: el
  // bot le pregunta al paciente con quién/qué especialidad quiere agendar antes de
  // confirmar, salvo que ya lo haya dicho en el historial.
  const professionalsText = (professionals || [])
    .map((p) => `- ${p.first_name} ${p.last_name || ""}${p.specialty ? ` (${p.specialty})` : ""}`.trim())
    .join("\n");
  const professionalsBlock = isClinic
    ? `\n=== PROFESIONALES DISPONIBLES ===\n${professionalsText || "(sin profesionales cargados aún)"}\nEste consultorio tiene varios profesionales. Si el paciente todavía no dijo con quién o qué especialidad prefiere, PREGUNTASELO antes de agendar. Si dice que no tiene preferencia, se lo asigna automáticamente. Cuando agendes, completá appointment.professional_name con el nombre elegido (o dejalo vacío si no tiene preferencia).\n`
    : "";

  const contextPrompt = `${systemPrompt}

=== CONTEXTO DEL CONSULTORIO ===
Consultorio: ${practice?.practice_name || ""}
Especialidad: ${practice?.specialty || ""}
${patientText}
${professionalsBlock}
Servicios disponibles:
${servicesText || "(sin servicios cargados)"}

Próximas citas del consultorio:
${upcomingText || "(ninguna)"}

=== HISTORIAL DE CONVERSACIÓN ===
${historyText || "(sin historial)"}

=== NUEVO MENSAJE DEL PACIENTE ===
${text}

Instrucciones: Respondé al paciente. Si el paciente quiere agendar y tenés toda la información (servicio y fecha/hora${isClinic ? ", y ya se resolvió con qué profesional o que no tiene preferencia" : ""}), configurá action como "book" y completá appointment con service_name (exacto) y datetime en formato ISO 8601 CON offset de zona horaria de Argentina, por ejemplo "2026-09-07T10:00:00-03:00" (nunca sin el "-03:00" al final)${isClinic ? ", y professional_name si el paciente eligió a alguien" : ""}. Si falta información, pedila.

REGLA CRÍTICA E INQUEBRANTABLE: NUNCA le digas al paciente que un turno está "confirmado", "agendado", "reservado" o "listo" salvo que en ESTE MISMO mensaje hayas configurado action="book" con service_name y datetime completos. Si action es "none", tu texto NO puede sonar a confirmación de nada nuevo — como mucho podés recordarle una cita que YA figura en "Próximas citas del consultorio" arriba (y solo si realmente está ahí, con esos datos exactos). Nunca dés por hecho que algo quedó agendado porque lo mencionaste antes en la conversación: la única fuente de verdad es la lista de "Próximas citas del consultorio". Si no estás seguro de si algo se agendó, preguntale al paciente qué necesita en vez de asumir.`;

  const llmRes = await base44.asServiceRole.integrations.Core.InvokeLLM({
    prompt: contextPrompt,
    ...(model ? { model } : {}),
    response_json_schema: {
      type: "object",
      properties: {
        reply: { type: "string", description: "Respuesta al paciente" },
        action: { type: "string", enum: ["none", "book"] },
        appointment: {
          type: "object",
          properties: {
            service_name: { type: "string" },
            datetime: { type: "string", description: "ISO 8601" },
            professional_name: { type: "string", description: "Nombre del profesional elegido por el paciente, si el consultorio tiene varios. Vacío si no tiene preferencia." },
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
        // equivocarse o alucinar que un horario está libre. Esto es la verdad de la base
        // de datos, no lo que dijo el modelo.
        const overlapping = (appts || []).filter((a) => {
          if (a.status === "cancelled") return false;
          if (a.created_by_id !== professionalId) return false;
          const aStart = new Date(a.start_datetime);
          const aEnd = new Date(a.end_datetime);
          return aStart < end && start < aEnd;
        });

        let assignedProfessionalRefId;
        let conflict = false;
        if (isClinic && professionals?.length) {
          const chosenName = (reply.appointment.professional_name || "").toLowerCase().trim();
          let candidate = chosenName
            ? professionals.find((p) => `${p.first_name} ${p.last_name || ""}`.toLowerCase().includes(chosenName))
            : null;
          if (!candidate) {
            candidate = professionals.find(
              (p) => !overlapping.some((a) => a.professional_ref_id === p.id)
            );
          } else if (overlapping.some((a) => a.professional_ref_id === candidate.id)) {
            conflict = true;
          }
          assignedProfessionalRefId = candidate?.id;
          if (!candidate && !conflict) conflict = true; // sin nadie libre en ese horario
        } else if (overlapping.length > 0) {
          conflict = true;
        }

        if (conflict) {
          finalReplyText = `Che, disculpá — ese horario ya no está disponible (se ocupó justo antes). ¿Querés que te proponga otro horario cercano, o preferis decirme vos otra opción?`;
        } else {
          let patientId = existingPatient?.id;
          let patientName = existingPatient
            ? `${existingPatient.first_name} ${existingPatient.last_name || ""}`.trim()
            : "Paciente WhatsApp";
          try {
            if (!patientId) {
              const newPatient = await base44.asServiceRole.entities.Patient.create({
                first_name: "Paciente",
                phone: fromPhone,
                professional_id: professionalId,
              });
              patientId = newPatient.id;
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

            // El texto de confirmación lo armamos NOSOTROS con los datos reales que se
            // guardaron, no confiamos en la redacción libre de la IA para los detalles
            // (día, hora, servicio) — así el paciente nunca lee algo distinto de lo que
            // efectivamente quedó en la agenda.
            const dateStr = start.toLocaleString("es-AR", {
              weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit",
              timeZone: "America/Argentina/Buenos_Aires",
            });
            finalReplyText = `¡Listo! Tu turno de ${service.name} quedó confirmado para el ${dateStr}. Te esperamos.`;

            try {
              await base44.asServiceRole.functions.invoke("sendAppointmentConfirmation", { appointment_id: newAppt.id });
            } catch (e) {
              console.error("sendAppointmentConfirmation invoke error:", e?.message || e);
            }
          } catch (e) {
            console.error("Appointment.create error:", e?.message || e);
            finalReplyText = "Uy, tuve un problema técnico al guardar tu turno. ¿Podés confirmarme de nuevo el día y horario para intentarlo otra vez?";
          }
        }
      }
    }
  }

  await base44.asServiceRole.entities.Conversation.create({
    phone: fromPhone,
    professional_id: professionalId,
    role: "assistant",
    text: finalReplyText,
    conversation_id: conversationId,
    account_id: accountId,
  });

  // El envío por WhatsApp va AL FINAL, después de que todo lo importante (la cita, el
  // registro de la conversación) ya está guardado de forma durable. Con 3 reintentos y
  // espera creciente (1s, 3s, 6s) ante errores temporales/timeouts — se probó en vivo que
  // mensajes muy seguidos (menos de 30s de diferencia) pueden chocar con algún límite de
  // velocidad del proveedor. Si TODOS los intentos fallan, no lo escondemos: lo marcamos
  // en el propio registro de la conversación para que se vea en la bandeja de Chats que
  // ese mensaje puede no haber llegado.
  const { sendWhatsAppMessage } = await import("./whatsapp-providers.ts");
  const delays = [1000, 3000, 6000];
  let sent = false;
  let lastError = null;
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      await sendWhatsAppMessage(base44, practice, fromPhone, finalReplyText);
      sent = true;
      break;
    } catch (e) {
      lastError = e;
      console.error(`sendWhatsAppMessage intento ${attempt + 1} falló:`, e?.message || e);
      if (attempt < delays.length) {
        await new Promise((r) => setTimeout(r, delays[attempt]));
      }
    }
  }
  if (!sent) {
    console.error("sendWhatsAppMessage: se agotaron los reintentos, el mensaje quedó sin enviar:", lastError?.message || lastError);
    try {
      const convs = await base44.asServiceRole.entities.Conversation.filter({ professional_id: professionalId, phone: fromPhone, role: "assistant", text: finalReplyText });
      const last = (convs || []).sort((a, b) => new Date(b.created_date) - new Date(a.created_date))[0];
      if (last) {
        await base44.asServiceRole.entities.Conversation.update(last.id, { delivery_failed: true });
      }
    } catch { /* no romper el flujo por esto */ }
  }

  return { ...reply, reply: finalReplyText, appointment_created: !!appointmentCreated };
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