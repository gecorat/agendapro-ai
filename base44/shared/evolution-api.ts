// Cliente de Evolution API (self-hosted, sobre Baileys) — reemplaza a WasenderAPI como
// proveedor de la conexión "qr" de WhatsApp. Escrito contra el contrato REST estándar de
// Evolution API v2. Si tu instancia corre una versión distinta y algún endpoint no
// responde con esta forma exacta, es la primera sospecha a revisar.
//
// A diferencia de WasenderAPI (una API key distinta por sesión), acá usamos SIEMPRE la
// Global API Key de la plataforma (PlatformConfig.evolution_api_key) para administrar
// todas las instancias — Evolution está pensado así: una key de administrador que puede
// crear/gestionar instancias de cualquier profesional.

function authHeaders(apiKey) {
  return { apikey: apiKey, 'Content-Type': 'application/json' };
}

// Nombre de instancia determinístico a partir del ID del consultorio, para poder
// recrearlo/reutilizarlo sin tener que guardar nada extra si algún día se pierde el dato.
export function instanceNameFor(practiceId) {
  return `kame_${practiceId}`;
}

async function safeJson(res) {
  try { return await res.json(); } catch { return {}; }
}

// Crea la instancia si no existe. Evolution devuelve 403/409 si el nombre ya está tomado
// — en ese caso no es un error real para nosotros, seguimos de largo (idempotente).
export async function ensureInstance(baseUrl, apiKey, instanceName, webhookUrl) {
  const createRes = await fetch(`${baseUrl}/instance/create`, {
    method: 'POST',
    headers: authHeaders(apiKey),
    body: JSON.stringify({
      instanceName,
      qrcode: true,
      integration: 'WHATSAPP-BAILEYS',
    }),
  });
  const createData = await safeJson(createRes);
  const alreadyExists = !createRes.ok && /already|exist|in use/i.test(JSON.stringify(createData));
  if (!createRes.ok && !alreadyExists) {
    throw new Error(createData?.message || createData?.error || `Evolution API: no se pudo crear la instancia (${createRes.status})`);
  }

  // Configuramos (o reconfiguramos) el webhook siempre, así si cambia la URL de la app
  // (ej. otro dominio) queda al día sin tener que borrar/recrear la instancia a mano.
  try {
    await fetch(`${baseUrl}/webhook/set/${instanceName}`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({
        webhook: {
          url: webhookUrl,
          enabled: true,
          events: ['MESSAGES_UPSERT', 'CONNECTION_UPDATE'],
        },
      }),
    });
  } catch (e) {
    console.error('[evolution-api] error configurando webhook:', e?.message || e);
  }

  return createData;
}

// Pide el QR (o pairing code) para vincular el dispositivo. Devuelve el string que hay
// que renderizar como QR (`code`) y, si Evolution solo da la imagen ya generada
// (`base64`, un data-URI), lo devolvemos también para que el frontend caiga a mostrarlo
// como <img> en vez de generar el QR de nuevo del lado del cliente.
export async function connectInstance(baseUrl, apiKey, instanceName) {
  const res = await fetch(`${baseUrl}/instance/connect/${instanceName}`, {
    headers: authHeaders(apiKey),
  });
  const data = await safeJson(res);
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Evolution API: no se pudo iniciar la conexión (${res.status})`);
  }
  return { code: data?.code || null, base64: data?.base64 || null };
}

// Estado de conexión de la instancia: 'open' (conectado), 'connecting', 'close'.
export async function getConnectionState(baseUrl, apiKey, instanceName) {
  const res = await fetch(`${baseUrl}/instance/connectionState/${instanceName}`, {
    headers: authHeaders(apiKey),
  });
  const data = await safeJson(res);
  const state = data?.instance?.state || data?.state || '';
  return String(state).toLowerCase();
}

// Trae el número de teléfono conectado (el "owner" de la instancia). No todas las
// versiones de Evolution lo exponen igual, así que probamos el campo más común y
// devolvemos null en vez de romper si no está.
export async function getConnectedPhone(baseUrl, apiKey, instanceName) {
  try {
    const res = await fetch(`${baseUrl}/instance/fetchInstances?instanceName=${instanceName}`, {
      headers: authHeaders(apiKey),
    });
    const data = await safeJson(res);
    const item = Array.isArray(data) ? data[0] : data?.[0];
    const ownerJid = item?.instance?.owner || item?.ownerJid || '';
    return ownerJid ? ownerJid.split('@')[0] : null;
  } catch {
    return null;
  }
}

export async function deleteInstance(baseUrl, apiKey, instanceName) {
  try {
    await fetch(`${baseUrl}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: authHeaders(apiKey),
    });
  } catch (e) {
    console.error('[evolution-api] error borrando instancia:', e?.message || e);
  }
}

export async function sendText(baseUrl, apiKey, instanceName, phone, text) {
  let res;
  try {
    res = await fetch(`${baseUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ number: phone, text }),
    });
  } catch (networkErr) {
    console.error(`[evolution-api] error de red al enviar a ${phone}:`, networkErr?.message || networkErr);
    throw networkErr;
  }
  const data = await safeJson(res);
  if (!res.ok) {
    console.error(`[evolution-api] fallo al enviar a ${phone} — status ${res.status}:`, data?.message || JSON.stringify(data));
    const err = new Error(data?.message || `Evolution API: send-message falló (${res.status})`);
    if (res.status === 429) err.retryAfterMs = 30000; // Evolution no siempre da retry_after; 30s por defecto.
    throw err;
  }
  return data;
}

// Pide el contenido de un mensaje multimedia (audio, imagen, etc.) ya decodificado en
// base64 — los medios de WhatsApp viajan cifrados extremo a extremo, así que no se puede
// simplemente hacer fetch() a la URL que viene en el mensaje: Evolution tiene la clave de
// sesión y lo descifra de su lado, este endpoint es la forma oficial de pedirle el
// resultado ya legible. `messageKey` es el objeto `key` tal cual viene en el mensaje
// original del webhook (remoteJid/id/fromMe).
export async function getBase64Media(baseUrl, apiKey, instanceName, messageKey) {
  try {
    const res = await fetch(`${baseUrl}/chat/getBase64FromMediaMessage/${instanceName}`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: false }),
    });
    const data = await safeJson(res);
    if (!res.ok) {
      console.error(`[evolution-api] fallo al pedir base64 de media — status ${res.status}:`, data?.message || JSON.stringify(data));
      return null;
    }
    return { base64: data?.base64 || null, mimetype: data?.mimetype || null };
  } catch (e) {
    console.error('[evolution-api] error de red al pedir base64 de media:', e?.message || e);
    return null;
  }
}

export async function fetchProfilePicture(baseUrl, apiKey, instanceName, phone) {
  try {
    const res = await fetch(`${baseUrl}/chat/fetchProfilePictureUrl/${instanceName}`, {
      method: 'POST',
      headers: authHeaders(apiKey),
      body: JSON.stringify({ number: phone }),
    });
    if (!res.ok) return null;
    const data = await safeJson(res);
    return data?.profilePictureUrl || null;
  } catch {
    return null;
  }
}
