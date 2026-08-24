import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendWhatsAppMessage, normalizePhone } from "../../shared/whatsapp-providers.ts";

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
    if (!practice?.whatsapp_connected) {
      return Response.json({ error: 'Tu WhatsApp no está conectado' }, { status: 400 });
    }

    // Antes esto solo sabía mandar por Zernio — ahora usa la misma función genérica que el
    // bot automático, que elige el proveedor correcto según whatsapp_connection_type.
    // OJO: mandamos con el "phone" tal cual vino (algunos proveedores como WasenderAPI
    // requieren formato E.164 con "+"), pero guardamos normalizado para que agrupe bien
    // con los mensajes que llegó el paciente.
    const result = await sendWhatsAppMessage(base44, practice, phone, message);

    // Al responder a mano, pausamos automáticamente el bot para esta conversación — así no
    // se pisan las respuestas. Se reanuda explícitamente con el botón de la bandeja.
    const normalized = normalizePhone(phone);
    try {
      const existing = await base44.asServiceRole.entities.ChatPause.filter({ professional_id: user.id, phone: normalized });
      if (existing?.[0]) {
        await base44.asServiceRole.entities.ChatPause.update(existing[0].id, { paused: true });
      } else {
        await base44.asServiceRole.entities.ChatPause.create({ professional_id: user.id, phone: normalized, paused: true });
      }
    } catch { /* no bloquear el envío si esto falla */ }

    await base44.asServiceRole.entities.Conversation.create({
      phone: normalized,
      professional_id: user.id,
      role: "assistant",
      text: message,
      conversation_id: conversationId || "",
      account_id: practice.whatsapp_connection_type === 'qr' ? practice.evolution_instance_name : practice.zernio_account_id,
      sent_by: "human",
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}