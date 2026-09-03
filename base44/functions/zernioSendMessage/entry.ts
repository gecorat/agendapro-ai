import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendWhatsAppMessage, normalizePhone } from "../../shared/whatsapp-providers.ts";
import { resolveScope } from "../../shared/team-scope.ts";

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

    // El consultorio se resuelve por EQUIPO, no por usuario. Antes se buscaba solo por
    // `created_by_id === user.id`: un profesional invitado no creó ninguna PracticeSettings,
    // así que esto quedaba en undefined y le respondía "Tu WhatsApp no está conectado"
    // AUNQUE SÍ LO ESTUVIERA — o sea que un invitado no podía responder ningún chat.
    const scope = await resolveScope(base44, user);
    if (!scope?.practiceOwnerId) {
      return Response.json({ error: 'No tenemos un consultorio asociado a tu cuenta.' }, { status: 400 });
    }
    const practiceOwnerId = scope.practiceOwnerId;
    const practice = (await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: practiceOwnerId }))?.[0];
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
      // La pausa se guarda con el id del DUEÑO, que es con el que la lee el webhook. Con
      // `user.id` un invitado escribía una fila que nadie consultaba nunca: creía haber
      // pausado el bot y el bot seguía respondiendo.
      const existing = await base44.asServiceRole.entities.ChatPause.filter({ professional_id: practiceOwnerId, phone: normalized });
      if (existing?.[0]) {
        await base44.asServiceRole.entities.ChatPause.update(existing[0].id, { paused: true });
      } else {
        await base44.asServiceRole.entities.ChatPause.create({ professional_id: practiceOwnerId, phone: normalized, paused: true });
      }
    } catch { /* no bloquear el envío si esto falla */ }

    // Igual que la pausa: la fila va con el id del dueño, que es como guarda el webhook.
    // Si no, la respuesta escrita a mano por un invitado quedaba en una "conversación"
    // aparte que no aparecía en ninguna bandeja.
    await base44.asServiceRole.entities.Conversation.create({
      phone: normalized,
      professional_id: practiceOwnerId,
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