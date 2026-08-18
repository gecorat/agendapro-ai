export async function getPlatformConfig(base44) {
  const list = await base44.asServiceRole.entities.PlatformConfig.filter({});  return list?.[0] || null;
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

Instrucciones: Respondé al paciente. Si el paciente quiere agendar y tenés toda la información (servicio y fecha/hora${isClinic ? ", y ya se resolvió con qué profesional o que no tiene preferencia" : ""}), configurá action como "book" y completá appointment con service_name (exacto) y datetime (ISO 8601)${isClinic ? ", y professional_name si el paciente eligió a alguien" : ""}. Si falta información, pedila.`;

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

  await base44.asServiceRole.entities.Conversation.create({
    phone: fromPhone,
    professional_id: professionalId,
    role: "assistant",
    text: reply.reply,
    conversation_id: conversationId,
    account_id: accountId,
  });

  const plat = await getPlatformConfig(base44);
  await sendWhatsApp(base44, {
    apiKey: plat?.zernio_api_key,
    accountId,
    conversationId,
    phone: fromPhone,
    message: reply.reply,
  });

  if (
    reply.action === "book" &&
    reply.appointment?.service_name &&
    reply.appointment?.datetime
  ) {
    const service = myServices.find(
      (s) => s.name.toLowerCase() === reply.appointment.service_name.toLowerCase()
    );
    if (service) {
      let patientId = existingPatient?.id;
      let patientName = existingPatient
        ? `${existingPatient.first_name} ${existingPatient.last_name || ""}`.trim()
        : "Paciente WhatsApp";
      if (!patientId) {
        const newPatient = await base44.asServiceRole.entities.Patient.create({
          first_name: "Paciente",
          phone: fromPhone,
          professional_id: professionalId,
        });
        patientId = newPatient.id;
      }
      const start = new Date(reply.appointment.datetime);
      const end = new Date(start.getTime() + (service.duration_minutes || 30) * 60000);

      // Plan Clinic: resolver a qué profesional del equipo se le asigna el turno. Si el
      // paciente eligió uno por nombre, usamos ese; si no, el primero activo que no tenga
      // otro turno superpuesto a esa hora ("primer profesional con disponibilidad libre").
      let assignedProfessionalRefId;
      if (isClinic && professionals?.length) {
        const chosenName = (reply.appointment.professional_name || "").toLowerCase().trim();
        let candidate = chosenName
          ? professionals.find((p) => `${p.first_name} ${p.last_name || ""}`.toLowerCase().includes(chosenName))
          : null;
        if (!candidate) {
          const overlapping = (appts || []).filter(
            (a) => a.status !== "cancelled" && new Date(a.start_datetime) < end && new Date(a.end_datetime) > start
          );
          candidate = professionals.find(
            (p) => !overlapping.some((a) => a.professional_ref_id === p.id)
          );
        }
        assignedProfessionalRefId = candidate?.id;
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
      // Flujo unificado: disparar email de confirmación al paciente con links de gestión
      try {
        await base44.asServiceRole.functions.invoke("sendAppointmentConfirmation", { appointment_id: newAppt.id });
      } catch { /* no romper el flujo del bot */ }
    }
  }

  return reply;
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
  const byProfile = wa.find(
    (a) => a.profileId === profileId || a.profile === profileId || a.profile?._id === profileId
  );
  return byProfile || wa[wa.length - 1] || null;
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