import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from "base44:runtime";
import { checkWhatsAppUsage } from "../../shared/whatsapp-usage.ts";
import { sendWhatsAppMessage, isChatPaused } from "../../shared/whatsapp-providers.ts";

// [DEPRECADO] Reemplazado por evolutionWebhook.ts — la conexión por QR ahora corre sobre
// Evolution API en vez de WasenderAPI. Se deja este archivo sin borrar por si hace falta
// consultarlo, pero WasenderAPI ya no recibe tráfico de esta app (ningún
// PracticeSettings.wasender_session_id se crea ni se usa más).
// Webhook de WasenderAPI (conexión por QR). A diferencia de Zernio, acá identificamos de
// qué consultorio es cada mensaje por el ?practiceId= en la URL (que nosotros mismos
// generamos al crear la sesión), no por un campo dentro del payload — así evitamos
// depender de adivinar el formato exacto que usa el proveedor.
export default async function (req: Request): Promise<Response> {
  try {
    const url = new URL(req.url);
    const practiceId = url.searchParams.get("practiceId");
    if (!practiceId) return Response.json({ ok: true, skipped: "no_practice_id" });

    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const base44 = createClientFromRequest(req);

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ id: practiceId });
    const practice = practices?.[0];
    if (!practice) return Response.json({ ok: true, skipped: "no_matching_practice" });

    // Verificación de firma: WasenderAPI usa comparación directa contra el secret de esa
    // sesión (no HMAC), vía el header X-Webhook-Signature.
    const sig = req.headers.get("X-Webhook-Signature");
    if (!sig || sig !== practice.wasender_webhook_secret) {
      return Response.json({ error: "Invalid signature" }, { status: 401 });
    }

    if (payload.event === "message.sent") {
      // Confirmación real de entrega (o fallo real) de un mensaje que mandamos nosotros.
      // Esto puede llegar AUNQUE el envío inicial haya respondido 200/"in_progress" —
      // confirmado en vivo: un envío puede parecer exitoso al toque y fallar recién acá,
      // de forma asíncrona.
      const msgId = payload.data?.key?.id;
      const success = payload.data?.success;
      if (msgId && success === false) {
        try {
          const rows = await base44.asServiceRole.entities.Conversation.filter({ professional_id: practice.created_by_id, wasender_msg_id: String(msgId) });
          if (rows?.[0]) {
            await base44.asServiceRole.entities.Conversation.update(rows[0].id, { delivery_failed: true });
          }
        } catch (e) {
          console.error("error marcando delivery_failed desde message.sent:", e?.message || e);
        }
      }
      return Response.json({ ok: true });
    }

    if (payload.event !== "messages.received") {
      return Response.json({ ok: true, skipped: `unhandled_event:${payload.event}` });
    }

    const msgData = payload.data?.messages;
    if (!msgData || msgData.key?.fromMe) {
      return Response.json({ ok: true, skipped: "no_message_or_from_me" });
    }

    const text = msgData.messageBody || msgData.message?.conversation || "";
    const fromPhone = msgData.key?.cleanedSenderPn || "";
    const conversationId = msgData.key?.remoteJid || fromPhone;

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
      account_id: practice.wasender_session_id,
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
              account_id: practice.wasender_session_id,
            })
          )
          .catch((e) => console.error("auto-reply send error:", e?.message || e))
      );
      return Response.json({ ok: true, skipped: "usage_or_plan_blocked" });
    }

    waitUntil(
      base44.asServiceRole.functions.invoke("wasenderConversation", {
        phone: fromPhone,
        text,
        conversationId,
        practiceId: practice.id,
      }).catch((e) => console.error("wasenderConversation invoke error:", e?.message || e))
    );

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
