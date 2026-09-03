import { canonicalPhone } from "./phone-utils.ts";

// Nombre con el que un numero aparece en WhatsApp, para que la bandeja de Chats deje de
// mostrar un numero pelado cuando la persona todavia no tiene ficha de paciente.
//
// HAY DOS NOMBRES DISTINTOS Y NO SON LO MISMO:
//
//  - "profile" (pushName): el nombre que la PERSONA se puso a si misma en su perfil de
//    WhatsApp. Viene en cada mensaje entrante del webhook, gratis y siempre.
//  - "agenda": el nombre que el titular tiene guardado en la agenda del celular que escaneo
//    el QR. Se pide a Evolution con /chat/findContacts.
//
// El de agenda le gana al de perfil cuando existe, porque es el que el profesional
// reconoce. Por eso un nombre de perfil nunca pisa uno de agenda.
//
// LA CLAVE ES EL TELEFONO CANONICO (ultimos 10 digitos), igual que en el resto de la app.
// Si se guardara el numero completo, la MISMA persona generaria dos filas distintas segun
// de donde salio el dato (el webhook manda "5493425526816", la agenda puede traer
// "543425526816"), y la bandeja mostraria un nombre u otro segun cual leyera primero.

export function normalizeContactName(name, phone) {
  const clean = String(name || "").trim().slice(0, 120);
  if (!clean) return "";
  // Un "nombre" que es el propio numero no aporta nada: algunos clientes mandan el telefono
  // como pushName cuando la persona no configuro un nombre de perfil.
  if (clean.replace(/[^0-9]/g, "") === String(phone || "").replace(/[^0-9]/g, "")) return "";
  return clean;
}

// Decide si hay que escribir, sin tocar la base. Se usa igual en el camino de a uno
// (webhook) y en el masivo (sincronizacion), asi las dos reglas no se pueden desincronizar.
// Devuelve null cuando no hay nada que hacer.
export function planContactWrite(existingRow, { phone, name, source }) {
  const key = canonicalPhone(phone);
  const clean = normalizeContactName(name, phone);
  if (!key || !clean) return null;
  if (!existingRow) return { op: "create", key, name: clean, source };
  // Un nombre de perfil no pisa uno que vino de la agenda del celular.
  if (source === "profile" && existingRow.source === "agenda") return null;
  if (existingRow.name === clean && existingRow.source === source) return null;
  return { op: "update", id: existingRow.id, key, name: clean, source };
}

export async function rememberWhatsAppContact(base44, { professionalId, phone, name, source = "profile" }) {
  try {
    const key = canonicalPhone(phone);
    if (!key) return;

    const existing = await base44.asServiceRole.entities.WhatsAppContact.filter({
      professional_id: professionalId,
      phone: key,
    });
    const plan = planContactWrite(existing?.[0], { phone, name, source });
    if (!plan) return;

    const payload = { name: plan.name, source: plan.source, synced_at: new Date().toISOString() };
    if (plan.op === "create") {
      await base44.asServiceRole.entities.WhatsAppContact.create({
        phone: key,
        professional_id: professionalId,
        ...payload,
      });
    } else {
      await base44.asServiceRole.entities.WhatsAppContact.update(plan.id, payload);
    }
  } catch (e) {
    // Best-effort puro: guardar un nombre NUNCA puede romper la recepcion de un mensaje.
    console.error("rememberWhatsAppContact error:", e?.message || e);
  }
}
