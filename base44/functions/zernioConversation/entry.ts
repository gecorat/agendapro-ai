import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { orchestrateConversation, findPracticeByAccount, getPlatformConfig } from "../../shared/zernio.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { phone, text, accountId, conversationId, internalToken } = body;

    if (!phone || !text) {
      return Response.json({ error: 'phone and text required' }, { status: 400 });
    }

    const plat = await getPlatformConfig(base44);
    const secret = plat?.zernio_webhook_secret;
    if (!secret || !internalToken || internalToken !== secret) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const practice = accountId ? await findPracticeByAccount(base44, accountId) : null;
    const professionalId = practice?.created_by_id || null;

    if (!professionalId) {
      return Response.json({ error: 'No se encontró un profesional para este accountId' }, { status: 400 });
    }

    const result = await orchestrateConversation(base44, {
      fromPhone: phone,
      professionalId,
      conversationId: conversationId || "",
      accountId: accountId || "",
      practice: practice || {},
      text,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}