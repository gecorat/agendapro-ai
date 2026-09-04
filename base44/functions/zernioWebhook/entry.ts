import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from "base44:runtime";
import { getPlatformConfig, findPracticeByAccount, hmacSha256, sendWhatsApp } from "../../shared/zernio.ts";
import { checkWhatsAppUsage } from "../../shared/whatsapp-usage.ts";
import { normalizePhone, isChatPaused } from "../../shared/whatsapp-providers.ts";
import { sendPushToUsers, getPracticeRecipientUserIds } from "../../shared/push.ts";
import { getBotPauseStatus } from "../../shared/bot-status.ts";
import { ownerIdOf } from "../../shared/ownership.ts";
import { formatArTime } from "../../shared/timezone.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);
    const base44 = createClientFromRequest(req);

    // DEBUG TEMPORAL: guardamos el payload real de Zernio para poder verlo, ya que el
    // formato exacto de campos no coincidía con lo documentado/asumido y varios mensajes
    // reales se estaban descartando en silencio (devolvíamos 200 igual, por diseño, para
    // no generar reintentos de Zernio). Esto no afecta el flujo normal.
    try {
      const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
      if (cfg?.[0]) {
        await base44.asServiceRole.entities.PlatformConfig.update(cfg[0].id, { debug_last_webhook_payload: rawBody.slice(0, 4000) });
      }
    } catch {}

    if (payload.event !== "message.received") {
      return Response.json({ ok: true, skipped: true });
    }

    const plat = await getPlatformConfig(base44);

    const secret = plat?.zernio_webhook_secret;
    if (!secret) {
      return Response.json({ error: "Webhook secret not configured" }, { status: 401 });
    }
    const sig = req.headers.get("X-Zernio-Signature") || req.headers.get("X-Late-Signature");
    if (!sig) return Response.json({ error: "No signature provided" }, { status: 401 });
    const computed = await hmacSha256(secret, rawBody);
    if (sig !== computed) return Response.json({ error: "Invalid signature" }, { status: 401 });

    const msg = payload.message || {};
    const conv = payload.conversation || {};
    const account = payload.account || {};

    let text = msg.text || msg.body || msg.content || "";
    // Confirmado con un payload real capturado en producción: el teléfono viene en
    // message.sender.phoneNumber, no en message.from como asumíamos antes — por eso
    // fromPhone quedaba vacío y el mensaje se descartaba en silencio ("no_text_or_phone"),
    // aunque el webhook respondiera 200 OK.
    const fromPhoneRaw = msg.sender?.phoneNumber || msg.from || conv.participantUsername || conv.contact?.phone || conv.phone || msg.senderPhone || "";
    // Normalizado acá mismo (Zernio manda "+549...", WasenderAPI manda "549..." sin +) para
    // que la misma persona no aparezca como dos conversaciones separadas según el proveedor
    // que haya usado. Zernio enruta la respuesta por conversationId, no por este campo, así
    // que normalizar acá no afecta el envío real.
    const fromPhone = normalizePhone(fromPhoneRaw);
    const conversationId = conv.id || conv.conversationId || "";
    const accountId = account.id || account.accountId || "";

    // Notas de voz: a diferencia del campo de texto/teléfono de arriba (confirmados con un
    // payload real en producción), el nombre EXACTO del campo de audio en el payload de
    // Zernio todavía no está confirmado — no hubo un audio real para verificarlo. Probamos
    // los nombres más probables; si ninguno matchea, no rompe nada, se comporta igual que
    // antes (se ignora). El payload completo queda igual guardado en
    // PlatformConfig.debug_last_webhook_payload más arriba, por si hay que ajustar el
    // nombre real del campo una vez que llegue un audio de verdad.
    const audioUrl = msg.audioUrl || msg.audio?.url || msg.media?.url || msg.attachmentUrl || msg.mediaUrl
      || (String(msg.type || "").toLowerCase() === "audio" ? (msg.url || msg.content) : null) || null;
    if (!text && audioUrl) {
      try {
        const audioRes = await fetch(audioUrl);
        if (audioRes.ok) {
          const buf = new Uint8Array(await audioRes.arrayBuffer());
          let binary = "";
          for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
          const base64 = btoa(binary);
          const mimetype = audioRes.headers.get("content-type") || msg.audio?.mimetype || "audio/ogg";
          const { transcribeAudioMessage } = await import("../../shared/audio-transcription.ts");
          const transcribed = await transcribeAudioMessage(base44, base64, mimetype);
          if (transcribed) text = transcribed;
        }
      } catch (e) {
        console.error("audio transcription error (zernio):", e?.message || e);
      }
    }

    if (!text || !fromPhone) {
      // Había audio pero no se pudo transcribir (o no encontramos el campo correcto):
      // avisamos al paciente en vez de dejarlo en silencio total como antes.
      if (audioUrl && fromPhone) {
        waitUntil(
          sendWhatsApp(base44, {
            apiKey: plat?.zernio_api_key,
            accountId,
            conversationId,
            phone: fromPhone,
            message: "Uy, no pude escuchar bien tu audio 🙏 ¿Me lo podés escribir en texto, por favor?",
          }).catch((e) => console.error("audio fallback send error (zernio):", e?.message || e))
        );
      }
      return Response.json({ ok: true, skipped: "no_text_or_phone" });
    }

    const practice = await findPracticeByAccount(base44, accountId);
    if (!practice) {
      return Response.json({ ok: true, skipped: "no_matching_professional" });
    }

    const professionalId = ownerIdOf(practice);

    await base44.asServiceRole.entities.Conversation.create({
      phone: fromPhone,
      professional_id: professionalId,
      role: "user",
      text,
      conversation_id: conversationId,
      account_id: accountId,
    });

    if (await isChatPaused(base44, professionalId, fromPhone)) {
      return Response.json({ ok: true, skipped: "chat_paused" });
    }

    // Interruptor GENERAL del bot (distinto de la pausa por conversación de arriba): puede
    // estar pausado por tiempo (1/8/24hs) o indefinido. Si ya venció el tiempo, se trata
    // como reactivado sin necesidad de ningún proceso en segundo plano (ver bot-status.ts).
    const pauseStatus = getBotPauseStatus(practice);
    if (pauseStatus.paused) {
      waitUntil(
        sendPushToUsers(base44, await getPracticeRecipientUserIds(base44, practice), {
          title: "Mensaje nuevo (bot pausado)",
          body: pauseStatus.indefinite
            ? "Llegó un mensaje de WhatsApp y el bot está pausado indefinidamente — nadie le va a responder."
            : `Llegó un mensaje de WhatsApp y el bot está pausado hasta las ${formatArTime(pauseStatus.until)}.`,
          url: "/asistente",
          tag: `wa-${fromPhone}`,
        }).catch((e) => console.error("push bot_paused error:", e?.message || e))
      );
      return Response.json({ ok: true, skipped: "bot_paused" });
    }

    // Chequeo de plan + cupo mensual ANTES de gastar una llamada al LLM. Si no hay cupo
    // o el plan no habilita WhatsApp, le contestamos algo amable al paciente en vez de
    // dejarlo mudo, y avisamos al profesional (con el conteo de 90/95/100% ya resuelto
    // adentro de checkWhatsAppUsage).
    const usage = await checkWhatsAppUsage(base44, practice);
    if (!usage.allowed) {
      waitUntil(
        sendPushToUsers(base44, await getPracticeRecipientUserIds(base44, practice), {
          title: "Mensaje nuevo (sin cupo)",
          body: "Llegó un mensaje de WhatsApp pero se acabó el cupo del plan — el bot no puede responder.",
          url: "/upgrade-plan",
          tag: `wa-${fromPhone}`,
        }).catch((e) => console.error("push usage_blocked error:", e?.message || e))
      );
      waitUntil(
        sendWhatsApp(base44, {
          apiKey: plat?.zernio_api_key,
          accountId,
          conversationId,
          phone: fromPhone,
          message: usage.autoReplyToPatient,
        })
          .then(() =>
            base44.asServiceRole.entities.Conversation.create({
              phone: fromPhone,
              professional_id: professionalId,
              role: "assistant",
              text: usage.autoReplyToPatient,
              conversation_id: conversationId,
              account_id: accountId,
            })
          )
          .catch((e) => console.error("auto-reply send error:", e?.message || e))
      );
      return Response.json({ ok: true, skipped: "usage_or_plan_blocked" });
    }

    waitUntil(
      base44.asServiceRole.functions.invoke("zernioConversation", {
        phone: fromPhone,
        text,
        accountId,
        conversationId,
        internalToken: secret,
      }).catch((e) => console.error("zernioConversation invoke error:", e?.message || e))
    );

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}