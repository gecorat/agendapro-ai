import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from "base44:runtime";
import { getPlatformConfig, findPracticeByAccount, hmacSha256, orchestrateConversation } from "../../shared/zernio.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const rawBody = await req.text();
    const payload = JSON.parse(rawBody);

    if (payload.event !== "message.received") {
      return Response.json({ ok: true, skipped: true });
    }

    const base44 = createClientFromRequest(req);
    const plat = await getPlatformConfig(base44);

    const secret = plat?.zernio_webhook_secret;
    if (secret) {
      const sig = req.headers.get("X-Zernio-Signature") || req.headers.get("X-Late-Signature");
      if (!sig) return Response.json({ error: "No signature provided" }, { status: 401 });
      const computed = await hmacSha256(secret, rawBody);
      if (sig !== computed) return Response.json({ error: "Invalid signature" }, { status: 400 });
    }

    const msg = payload.message || {};
    const conv = payload.conversation || {};
    const account = payload.account || {};

    const text = msg.text || msg.body || msg.content || "";
    const fromPhone = msg.from || conv.contact?.phone || conv.phone || msg.senderPhone || "";
    const conversationId = conv.id || conv.conversationId || "";
    const accountId = account.id || account.accountId || "";

    if (!text || !fromPhone) {
      return Response.json({ ok: true, skipped: "no_text_or_phone" });
    }

    const practice = await findPracticeByAccount(base44, accountId);
    if (!practice) {
      return Response.json({ ok: true, skipped: "no_matching_professional" });
    }

    const professionalId = practice.created_by_id;

    await base44.asServiceRole.entities.Conversation.create({
      phone: fromPhone,
      professional_id: professionalId,
      role: "user",
      text,
      conversation_id: conversationId,
      account_id: accountId,
    });

    waitUntil(
      orchestrateConversation(base44, {
        fromPhone,
        professionalId,
        conversationId,
        accountId,
        practice,
        text,
      }).catch((e) => console.error("orchestrateConversation error:", e?.message || e))
    );

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}