import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { getPlatformConfig, sendWhatsApp } from "../../shared/zernio.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { phone, message, conversationId } = body;

    if (!phone || !message) {
      return Response.json({ error: 'phone and message required' }, { status: 400 });
    }

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    const accountId = practice?.zernio_account_id;

    if (!accountId) {
      return Response.json({ error: 'Tu cuenta no tiene un Account ID de Zernio configurado' }, { status: 400 });
    }

    const plat = await getPlatformConfig(base44);

    const result = await sendWhatsApp(base44, {
      apiKey: plat?.zernio_api_key,
      accountId,
      conversationId,
      phone,
      message,
    });

    await base44.asServiceRole.entities.Conversation.create({
      phone,
      professional_id: user.id,
      role: "assistant",
      text: message,
      conversation_id: conversationId || "",
      account_id: accountId,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}