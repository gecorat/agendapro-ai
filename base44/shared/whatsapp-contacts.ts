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
// PRECEDENCIA, de menor a mayor: profile < agenda < manual.
//  - "manual" es el que el profesional escribio a mano en la ficha del chat. Gana siempre y
//    no lo pisa ninguna sincronizacion: si lo escribio el, es el que quiere ver.
//  - "agenda" le gana a "profile" porque es el nombre que el profesional reconoce, no el que
//    la persona se puso a si misma.
//
// LA CLAVE ES EL TELEFONO CANONICO (ultimos 10 digitos), igual que en el resto de la app.
// Si se guardara el numero completo, la MISMA persona generaria dos filas distintas segun
// de donde salio el dato (el webhook manda "5493425526816", la agenda puede traer
// "543425526816"), y la bandeja mostraria un nombre u otro segun cual leyera primero.

export const RANK = { profile: 0, agenda: 1, manual: 2 };

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
  // Un origen mas debil no puede pisar a uno mas fuerte. Sin esto, el boton "Contactos"
  // (que escribe con source "agenda") le borraba al profesional el nombre que el mismo
  // habia puesto a mano.
  if (RANK[source] < RANK[existingRow.source]) return null;
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
