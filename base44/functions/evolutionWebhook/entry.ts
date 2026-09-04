import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { waitUntil } from "base44:runtime";
import { checkWhatsAppUsage } from "../../shared/whatsapp-usage.ts";
import { sendWhatsAppMessage, isChatPaused } from "../../shared/whatsapp-providers.ts";
import { sendPushToUsers, getPracticeRecipientUserIds } from "../../shared/push.ts";
import { getBotPauseStatus } from "../../shared/bot-status.ts";
import { getPracticeSecrets } from "../../shared/secrets.ts";
import { rememberWhatsAppContact } from "../../shared/whatsapp-contacts.ts";
import { readIncomingMessage } from "../../shared/incoming-message.ts";
import { ownerIdOf } from "../../shared/ownership.ts";
import { formatArTime } from "../../shared/timezone.ts";

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

    const secrets = await getPracticeSecrets(base44, practice.id);
    if (!secret || secret !== secrets?.evolution_webhook_secret) {
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

    const remoteJid = msgData.key?.remoteJid || "";

    // Grupos, listas de difusión y el canal de estados NO son pacientes. Acá se cortan, antes
    // de guardar nada y antes de invocar al bot.
    //
    // Por qué hacía falta: el teléfono sale de `remoteJid.split("@")[0]`, y para un grupo eso
    // deja el ID del grupo ("120363428541821553"), que es una cadena no vacía — o sea que
    // pasaba todos los chequeos como si fuera un teléfono real. Resultado confirmado en
    // datos el 03/09: tres conversaciones de grupo en la bandeja del consultorio, con el bot
    // respondiendo adentro del grupo y consumiendo cupo del plan.
    // Se decide SOLO por el sufijo del JID, que es inequívoco. A propósito NO se usa
    // `key.participant`: las versiones nuevas de WhatsApp también lo mandan en chats 1 a 1
    // (direccionamiento por LID), así que filtrar por ahí dejaría afuera mensajes de
    // pacientes reales. Los chats normales terminan en @s.whatsapp.net o @lid y siguen de
    // largo.
    if (
      remoteJid.endsWith("@g.us") ||
      remoteJid.endsWith("@broadcast") ||
      remoteJid.endsWith("@newsletter")
    ) {
      return Response.json({ ok: true, skipped: "group_or_broadcast" });
    }

    const fromPhone = remoteJid.split("@")[0] || "";
    const conversationId = remoteJid || fromPhone;

    // Lectura completa del mensaje (ver shared/incoming-message.ts). Antes acá solo se
    // leían dos campos de texto plano y TODO lo demás se perdía sin dejar rastro.
    //  - `text`    = lo que el bot debe interpretar (vacío = el bot no responde).
    //  - `display` = lo que se guarda en la bandeja, nunca vacío si hubo algo.
    const incoming = readIncomingMessage(msgData.message);
    let text = incoming.text;
    let display = incoming.display;

    // Notas de voz: antes esto se ignoraba por completo (ni se guardaba, ni se avisaba al
    // paciente ni al profesional) porque solo se leía el texto plano del mensaje, que en un
    // audio viene vacío. Los medios de WhatsApp viajan cifrados extremo a extremo, así que
    // no alcanza con el link que viene en el mensaje — Evolution lo descifra de su lado y
    // lo entrega en base64 a través de este endpoint dedicado.
    if (!text && incoming.isAudio) {
      try {
        let base64 = msgData.message?.base64 || msgData.base64 || null;
        const mimetype = msgData.message.audioMessage.mimetype || "audio/ogg";
        if (!base64) {
          const cfg = await base44.asServiceRole.entities.PlatformConfig.filter({});
          const evoBaseUrl = (cfg?.[0]?.evolution_base_url || "").replace(/\/$/, "");
          const evoApiKey = cfg?.[0]?.evolution_api_key;
          if (evoBaseUrl && evoApiKey && practice.evolution_instance_name) {
            const { getBase64Media } = await import("../../shared/evolution-api.ts");
            const media = await getBase64Media(evoBaseUrl, evoApiKey, practice.evolution_instance_name, msgData.key);
            base64 = media?.base64 || null;
          }
        }
        if (base64) {
          const { transcribeAudioMessage } = await import("../../shared/audio-transcription.ts");
          const transcribed = await transcribeAudioMessage(base44, base64, mimetype);
          if (transcribed) {
            text = transcribed;
            display = `\u{1F3A4} ${transcribed}`;
          }
        }
      } catch (e) {
        console.error("audio transcription error (evolution):", e?.message || e);
      }
    }

    if (!fromPhone) {
      return Response.json({ ok: true, skipped: "no_phone" });
    }

    // Una reacción (un emoji sobre un mensaje anterior) no es un mensaje nuevo: no se guarda
    // ni despierta al bot, para no marcar el chat como no leído por un pulgar arriba.
    if (!display) {
      return Response.json({ ok: true, skipped: `sin_contenido:${incoming.kind}` });
    }

    // ownerIdOf, no created_by_id: en las cuentas nuevas ese campo es el id del servicio
    // y el bot habría mezclado los datos de todas ellas (ver shared/ownership.ts).
    const professionalId = ownerIdOf(practice);

    // El nombre de perfil de WhatsApp viene en CADA mensaje entrante y hasta ahora se
    // descartaba. Sin esto, la bandeja de Chats muestra un numero pelado para cualquiera
    // que todavia no tenga ficha de paciente. waitUntil para no demorar la respuesta al
    // webhook: si falla, el mensaje se guarda igual.
    if (msgData.pushName) {
      waitUntil(rememberWhatsAppContact(base44, { professionalId, phone: fromPhone, name: msgData.pushName, source: "profile" }));
    }

    // Se guarda SIEMPRE, aunque el bot no vaya a responder. Esta línea es la que faltaba:
    // antes el `return` de los mensajes sin texto estaba arriba de acá, así que una foto o un
    // PDF no dejaban ninguna fila y el profesional no se enteraba nunca.
    await base44.asServiceRole.entities.Conversation.create({
      phone: fromPhone,
      professional_id: professionalId,
      role: "user",
      text: display,
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

    // Sin texto que interpretar (una foto sin nada escrito, o un audio que no se pudo
    // transcribir) el bot no tiene a qué responder. El mensaje YA quedó guardado arriba, así
    // que el profesional lo ve en la bandeja y lo atiende a mano.
    //
    // Para las notas de voz se le avisa al paciente, que si no queda esperando una respuesta
    // que nunca va a llegar. Ese aviso ahora sale acá A PROPÓSITO: antes se mandaba arriba de
    // todo, y por eso seguía contestando con el bot pausado. Acá ya pasaron la pausa de la
    // conversación y el interruptor general. Los recordatorios no pasan por este archivo, así
    // que siguen saliendo como siempre.
    //
    // Va ANTES de checkWhatsAppUsage porque esa función descuenta del cupo del plan: una foto
    // que no genera ninguna respuesta no tiene por qué gastarle una conversación al
    // profesional. Para el aviso del audio, que sí es un mensaje saliente, el cupo se
    // consulta explícitamente ahí adentro.
    if (!text) {
      if (incoming.isAudio) {
        waitUntil(
          (async () => {
            const audioUsage = await checkWhatsAppUsage(base44, practice);
            if (!audioUsage.allowed) return;
            const aviso = "Uy, no pude escuchar bien tu audio \u{1F64F} ¿Me lo podés escribir en texto, por favor?";
            await sendWhatsAppMessage(base44, practice, fromPhone, aviso);
            await base44.asServiceRole.entities.Conversation.create({
              phone: fromPhone,
              professional_id: professionalId,
              role: "assistant",
              text: aviso,
              conversation_id: conversationId,
              account_id: practice.evolution_instance_name,
              sent_by: "system",
            });
          })().catch((e) => console.error("audio fallback send error (evolution):", e?.message || e))
        );
      }
      return Response.json({ ok: true, skipped: `sin_texto_para_el_bot:${incoming.kind}` });
    }

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
