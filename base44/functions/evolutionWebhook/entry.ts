import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from "base44:runtime";
import { checkWhatsAppUsage } from "../../shared/whatsapp-usage.ts";
import { sendWhatsAppMessage, isChatPaused } from "../../shared/whatsapp-providers.ts";

// Webhook de Evolution API (conexión por QR, self-hosted). Identificamos de qué
// consultorio es cada mensaje por ?practiceId= en la URL (que nosotros mismos generamos
// al crear la instancia), no por un campo dentro del payload. La verificación de origen
// es un secreto propio (?secret=) que también generamos nosotros y guardamos en
// PracticeSettings.evolution_webhook_secret — Evolution no firma el payload, así que no
// hay una firma de proveedor que validar como en otros casos.
export default async function (req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const practiceId = url.searchParams.get("practiceId");
    const secret = url.searchParams.get("secret");
    if (!practiceId) return Response.json({ ok: true, skipped: "no_practice_id" });

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const base44 = createClientFromRequest(req);

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ id: practiceId });
    const practice = practices?.[0];
    if (!practice) return Response.json({ ok: true, skipped: "no_matching_practice" });

    if (!secret || secret !== practice.evolution_webhook_secret) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = String(payload.event || "").toLowerCase();

    // Reflejamos cambios de estado de conexión (por ejemplo, si el usuario cierra sesión
    // desde el propio WhatsApp del celular) sin depender de que alguien abra la app y
    // dispare el polling manual.
    if (event === "connection.update") {
      const state = String(payload.data?.state || "").toLowerCase();
      if (state === "open" || state === "close") {
        await base44.asServiceRole.entities.PracticeSettings.update(practice.id, {
          whatsapp_connected: state === "open",
          whatsapp_status: state === "open" ? "connected" : "disconnected",
        });
      }
      return Response.json({ ok: true });
    }

    if (event !== "messages.upsert") {
      return Response.json({ ok: true, skipped: `unhandled_event:${payload.event}` });
    }

    const msgData = payload.data;
    if (!msgData || msgData.key?.fromMe) {
      return Response.json({ ok: true, skipped: "no_message_or_from_me" });
    }

    const text = msgData.message?.conversation || msgData.message?.extendedTextMessage?.text || "";
    const remoteJid = msgData.key?.remoteJid || "";
    const fromPhone = remoteJid.split("@")[0] || "";
    const conversationId = remoteJid || fromPhone;

    if (!text || !fromPhone) {
      return Response.json({ ok: true, skipped: "no_text_or_phone" });
    }

    const professionalId = practice.created_by_id;

    await base44.asServiceRole.entities.Conversation.create({
      phone: fromPhone,
      professional_id: professionalId,
      role: "user",
      text,
      conversation_id: conversationId,
      account_id: practice.evolution_instance_name,
      // Reusamos el campo wasender_msg_id como identificador genérico de mensaje del
      // proveedor (queda el nombre viejo en el esquema, pero ya no es Wasender-específico).
      wasender_msg_id: msgData.key?.id ? String(msgData.key.id) : undefined,
    });

    // Si el profesional puso esta conversación en pausa (a mano, o automáticamente al
    // responder él mismo), el bot no contesta — solo queda guardado el mensaje del
    // paciente para que lo atienda a mano desde la bandeja.
    if (await isChatPaused(base44, professionalId, fromPhone)) {
      return Response.json({ ok: true, skipped: "chat_paused" });
    }

    const usage = await checkWhatsAppUsage(base44, practice);
    if (!usage.allowed) {
      waitUntil(
        sendWhatsAppMessage(base44, practice, fromPhone, usage.autoReplyToPatient)
          .then(() =>
            base44.asServiceRole.entities.Conversation.create({
              phone: fromPhone,
              professional_id: professionalId,
              role: "assistant",
              text: usage.autoReplyToPatient,
              conversation_id: conversationId,
              account_id: practice.evolution_instance_name,
            })
          )
          .catch((e) => console.error("auto-reply send error:", e?.message || e))
      );
      return Response.json({ ok: true, skipped: "usage_or_plan_blocked" });
    }

    waitUntil(
      base44.asServiceRole.functions.invoke("evolutionConversation", {
        phone: fromPhone,
        text,
        conversationId,
        practiceId: practice.id,
      }).catch((e) => console.error("evolutionConversation invoke error:", e?.message || e))
    );

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
