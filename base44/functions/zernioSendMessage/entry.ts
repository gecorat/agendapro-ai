import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendWhatsAppMessage } from "../../shared/whatsapp-providers.ts";

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const { phone, message, conversationId } = body;

    if (!phone || !message) {
      return Response.json({ error: 'phone and message required' }, { status: 400 });
    }

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === user.id);
    if (!practice?.whatsapp_connected) {
      return Response.json({ error: 'Tu WhatsApp no está conectado' }, { status: 400 });
    }

    // Antes esto solo sabía mandar por Zernio — ahora usa la misma función genérica que el
    // bot automático, que elige el proveedor correcto según whatsapp_connection_type.
    const result = await sendWhatsAppMessage(base44, practice, phone, message);

    await base44.asServiceRole.entities.Conversation.create({
      phone,
      professional_id: user.id,
      role: "assistant",
      text: message,
      conversation_id: conversationId || "",
      account_id: practice.whatsapp_connection_type === 'qr' ? practice.wasender_session_id : practice.zernio_account_id,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}