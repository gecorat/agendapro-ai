import { toWhatsAppNumber } from "./phone-utils.ts";

// Envío de WhatsApp agnóstico al proveedor: cada profesional puede estar conectado por
// Zernio (API oficial de Meta) o por Evolution API (QR, self-hosted) — el resto del código
// (el bot, los recordatorios) no necesita saber cuál es cuál, solo llama a esta función.
// Formato único de teléfono para que las conversaciones agrupen bien: Zernio manda el
// número con "+" ("+549..."), Evolution lo manda sin él ("549...") — sin esto, la misma
// persona aparecía como dos conversaciones separadas según qué proveedor haya usado.
export function normalizePhone(phone) {
  return (phone || "").replace(/[^\d]/g, "");
}

// Consultado por los webhooks antes de invocar al bot. Si el profesional pausó esta
// conversación puntual (a mano, o automáticamente al responder él mismo), el bot no debe
// contestarle a ese paciente hasta que se reanude explícitamente — o hasta que venza el
// plazo (1h/24h) si la pausa se puso con duración definida.
export async function isChatPaused(base44, professionalId, phone) {
  try {
    const rows = await base44.asServiceRole.entities.ChatPause.filter({ professional_id: professionalId, phone: normalizePhone(phone) });
    const row = rows?.[0];
    if (!row?.paused) return false;
    if (row.paused_until && new Date(row.paused_until) <= new Date()) {
      // Venció el plazo: se reanuda sola, sin que nadie tenga que tocar nada.
      try {
        await base44.asServiceRole.entities.ChatPause.update(row.id, { paused: false, paused_until: null });
      } catch { /* no bloquear por esto */ }
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Ultima linea de defensa antes de mandar cualquier WhatsApp, sin importar de donde salga
// (confirmacion, recordatorio, respuesta del bot). Las fichas de paciente viejas quedaron
// con el telefono a medias — "3541241378", sin codigo de pais — porque la pagina publica lo
// aceptaba como texto libre. WhatsApp resuelve ese numero incompleto como puede, y ahi es
// donde una confirmacion termino en el telefono de otra persona (03/09).
//
// CRITERIO CONSERVADOR a proposito:
//  - Si se puede resolver como argentino, se manda al numero completo (arregla las fichas
//    viejas sin tener que tocarlas una por una).
//  - Si no se puede resolver pero ya trae 11 digitos o mas, se manda tal cual: es un numero
//    con codigo de pais (un paciente del exterior, o el numero que ya viene normalizado del
//    webhook) y no queremos romper lo que hoy funciona.
//  - Si no se puede resolver y tiene 10 digitos o menos, NO se manda: le falta el codigo de
//    pais y no hay forma de saber a quien iria a parar.
function resolveDestination(phone) {
  const ar = toWhatsAppNumber(phone);
  if (ar) return ar;
  const digits = normalizePhone(phone);
  if (digits.length >= 11) return digits;
  return null;
}

export async function sendWhatsAppMessage(base44, practice, phone, text) {
  const to = resolveDestination(phone);
  if (!to) {
    throw new Error(`numero de WhatsApp incompleto, no se envia: "${phone}"`);
  }
  phone = to;
  if (practice?.whatsapp_connection_type === "qr") {
    return sendViaEvolution(base44, practice, phone, text);
  }
  // Por defecto (o connection_type === "official"): Zernio.
  const { getPlatformConfig, sendWhatsApp } = await import("./zernio.ts");
  const plat = await getPlatformConfig(base44);
  return sendWhatsApp(base44, {
    apiKey: plat?.zernio_api_key,
    accountId: practice.zernio_account_id,
    phone,
    message: text,
  });
}

async function sendViaEvolution(base44, practice, phone, text) {
  const instanceName = practice?.evolution_instance_name;
  if (!instanceName) throw new Error("evolution_instance_name faltante para este consultorio");
  // Evolution arma el JID de WhatsApp como `${number}@s.whatsapp.net`, así que el número
  // tiene que ir SOLO con dígitos. Acá estaba el agujero: los mensajes del bot funcionaban
  // porque su teléfono viene del webhook ya normalizado ("5493425526816"), pero las
  // confirmaciones y recordatorios usan Patient.phone, que se carga a mano y queda con "+"
  // y a veces con espacios o guiones ("+54 9 342 552-6816"). Ese "+" producía un JID
  // inválido y el envío fallaba sin que se viera nada: el error se logueaba y el flujo
  // caía al email. Por eso llegaba el mail pero nunca el WhatsApp.
  const number = normalizePhone(phone);
  if (!number) throw new Error(`número de WhatsApp inválido: "${phone}"`);
  const { sendText } = await import("./evolution-api.ts");
  const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
  const baseUrl = (cfg?.[0]?.evolution_base_url || "").replace(/\/$/, "");
  const apiKey = cfg?.[0]?.evolution_api_key;
  if (!baseUrl || !apiKey) throw new Error("Evolution API no está configurada en la plataforma");
  return sendText(baseUrl, apiKey, instanceName, number, text);
}
