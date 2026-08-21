// Envío de WhatsApp agnóstico al proveedor: cada profesional puede estar conectado por
// Zernio (API oficial de Meta) o por WasenderAPI (QR, no oficial) — el resto del código
// (el bot, los recordatorios) no necesita saber cuál es cuál, solo llama a esta función.
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
  const res = await fetch("https://www.wasenderapi.com/api/send-message", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ to: phone, text }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.success === false) {
    throw new Error(data?.message || `WasenderAPI send-message falló (${res.status})`);
  }
  return data;
}
