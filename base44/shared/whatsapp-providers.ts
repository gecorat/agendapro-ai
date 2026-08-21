// Envío de WhatsApp agnóstico al proveedor: cada profesional puede estar conectado por
// Zernio (API oficial de Meta) o por WasenderAPI (QR, no oficial) — el resto del código
// (el bot, los recordatorios) no necesita saber cuál es cuál, solo llama a esta función.
// Formato único de teléfono para que las conversaciones agrupen bien: Zernio manda el
// número con "+" ("+549..."), WasenderAPI lo manda sin él ("549...") — sin esto, la misma
// persona aparecía como dos conversaciones separadas según qué proveedor haya usado.
export function normalizePhone(phone) {
  return (phone || "").replace(/[^\d]/g, "");
}

// Consultado por los webhooks antes de invocar al bot. Si el profesional pausó esta
// conversación puntual (a mano, o automáticamente al responder él mismo), el bot no debe
// contestarle a ese paciente hasta que se reanude explícitamente.
export async function isChatPaused(base44, professionalId, phone) {
  try {
    const rows = await base44.asServiceRole.entities.ChatPause.filter({ professional_id: professionalId, phone: normalizePhone(phone) });
    return !!rows?.[0]?.paused;
  } catch {
    return false;
  }
}

export async function sendWhatsAppMessage(base44, practice, phone, text) {
  if (practice?.whatsapp_connection_type === "qr") {
    return sendViaWasender(practice, phone, text);
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

async function sendViaWasender(practice, phone, text) {
  const apiKey = practice?.wasender_api_key;
  if (!apiKey) throw new Error("wasender_api_key faltante para este consultorio");
  let res;
  try {
    res = await fetch("https://www.wasenderapi.com/api/send-message", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ to: phone, text }),
    });
  } catch (networkErr) {
    console.error(`[WasenderAPI] error de red al enviar a ${phone}:`, networkErr?.message || networkErr);
    throw networkErr;
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    console.error(`[WasenderAPI] fallo al enviar a ${phone} — status ${res.status}:`, data?.message || JSON.stringify(data));
    const err = new Error(data?.message || `WasenderAPI send-message falló (${res.status})`);
    // Confirmado en vivo: en el plan trial de WasenderAPI, un 429 trae retry_after (en
    // segundos) indicando cuánto hay que esperar de verdad — lo exponemos en el error para
    // que el que reintenta (orchestrateConversation) espere ese tiempo real en vez de un
    // número fijo que no alcanza.
    if (res.status === 429 && data?.retry_after) {
      err.retryAfterMs = Number(data.retry_after) * 1000;
    }
    throw err;
  }
  return data;
}
