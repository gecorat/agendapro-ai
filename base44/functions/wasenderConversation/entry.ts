import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { orchestrateConversation } from "../../shared/zernio.ts";
import { ownerIdOf } from "../../shared/ownership.ts";

// [DEPRECADO] Reemplazado por evolutionConversation.ts — ver wasenderWebhook.ts.
// Equivalente a zernioConversation, pero para consultorios conectados por QR
// (WasenderAPI). orchestrateConversation es la misma para ambos proveedores — decide
// solo/internamente por dónde mandar la respuesta según practice.whatsapp_connection_type.
export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const { phone, text, conversationId, practiceId } = body;

    if (!phone || !text || !practiceId) {
      return Response.json({ error: 'phone, text y practiceId son requeridos' }, { status: 400 });
    }

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({ id: practiceId });
    const practice = practices?.[0];
    if (!practice) return Response.json({ error: 'No se encontró el consultorio' }, { status: 400 });

    // Autenticación interna: solo wasenderWebhook debería llamar a esta función, y ya
    // validó la firma del webhook antes de invocarla — igual revalidamos acá que el
    // consultorio realmente tenga una sesión QR activa, como defensa extra.
    if (practice.whatsapp_connection_type !== 'qr' || !practice.wasender_session_id) {
      return Response.json({ error: 'Este consultorio no tiene una conexión QR activa' }, { status: 400 });
    }

    const result = await orchestrateConversation(base44, {
      fromPhone: phone,
      professionalId: ownerIdOf(practice),
      conversationId: conversationId || "",
      accountId: practice.wasender_session_id,
      practice,
      text,
    });

    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
