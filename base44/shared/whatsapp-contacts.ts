import { normalizePhone } from "./whatsapp-providers.ts";

// Nombre con el que un numero aparece en WhatsApp, para que la bandeja de Chats deje de
// mostrar un numero pelado cuando la persona todavia no tiene ficha de paciente.
//
// HAY DOS NOMBRES DISTINTOS Y NO SON LO MISMO:
//
//  - "profile" (pushName): el nombre que la PERSONA se puso a si misma en su perfil de
//    WhatsApp. Viene en cada mensaje entrante del webhook, gratis y siempre. Es el unico
//    que se puede dar por seguro.
//  - "agenda": el nombre que el titular tiene guardado en la agenda del celular que escaneo
//    el QR. Se pide a Evolution con /chat/findContacts y NO siempre viene: WhatsApp fue
//    restringiendo esa sincronizacion y hay reportes de que el campo vuelve vacio.
//
// El de agenda le gana al de perfil cuando existe, porque es el que el profesional
// reconoce. Por eso un nombre de perfil nunca pisa uno de agenda.

export async function rememberWhatsAppContact(base44, { professionalId, phone, name, source = "profile" }) {
  try {
    const digits = normalizePhone(phone);
    const clean = String(name || "").trim().slice(0, 120);
    if (!digits || !clean) return;
    // Un numero que es identico al nombre no aporta nada (algunos clientes mandan el propio
    // telefono como pushName cuando la persona no configuro un nombre de perfil).
    if (normalizePhone(clean) === digits) return;

    const existing = await base44.asServiceRole.entities.WhatsAppContact.filter({
      professional_id: professionalId,
      phone: digits,
    });
    const row = existing?.[0];

    if (!row) {
      await base44.asServiceRole.entities.WhatsAppContact.create({
        phone: digits,
        professional_id: professionalId,
        name: clean,
        source,
        synced_at: new Date().toISOString(),
      });
      return;
    }

    // Un nombre de perfil no pisa uno que vino de la agenda del celular.
    if (source === "profile" && row.source === "agenda") return;
    if (row.name === clean && row.source === source) return;

    await base44.asServiceRole.entities.WhatsAppContact.update(row.id, {
      name: clean,
      source,
      synced_at: new Date().toISOString(),
    });
  } catch (e) {
    // Best-effort puro: guardar un nombre NUNCA puede romper la recepcion de un mensaje.
    console.error("rememberWhatsAppContact error:", e?.message || e);
  }
}
