// Transcribe un audio de WhatsApp (nota de voz) a texto, usando el mismo motor de IA
// (InvokeLLM de Base44) que ya arma las respuestas del bot — la opción SIN costo aparte.
// IMPORTANTE: no está confirmado que este servicio soporte audio hasta probarlo en vivo
// (no hay forma de verificarlo sin un audio real llegando por WhatsApp). Si no lo soporta,
// o si el audio no se entiende, esta función devuelve null y quien la llama decide qué
// avisarle al paciente — nunca rompe el flujo ni deja todo en silencio como pasaba antes.
export async function transcribeAudioMessage(base44, base64Audio, mimeType) {
  if (!base64Audio) return null;
  try {
    const cleanBase64 = base64Audio.includes(",") ? base64Audio.split(",").pop() : base64Audio;
    const binary = atob(cleanBase64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const mt = mimeType || "audio/ogg";
    const ext = mt.includes("ogg") ? "ogg" : mt.includes("mp4") || mt.includes("m4a") ? "m4a" : mt.includes("mpeg") || mt.includes("mp3") ? "mp3" : mt.includes("wav") ? "wav" : "ogg";
    const file = new File([bytes], `audio.${ext}`, { type: mt });

    const uploaded = await base44.asServiceRole.integrations.Core.UploadFile({ file });
    const fileUrl = uploaded?.file_url;
    if (!fileUrl) {
      console.error("transcribeAudioMessage: UploadFile no devolvió file_url");
      return null;
    }

    const res = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: "Transcribí EXACTAMENTE lo que se dice en este audio, en español, palabra por palabra, sin agregar comentarios ni resumir ni traducir. Si no se entiende nada o el audio está vacío/en silencio, respondé ÚNICAMENTE: [inaudible]",
      file_urls: [fileUrl],
    });
    const text = (typeof res === "string" ? res : (res?.text ?? res?.output ?? res?.reply ?? "")).toString().trim();
    if (!text || /^\[?inaudible\]?$/i.test(text)) return null;
    return text;
  } catch (e) {
    console.error("transcribeAudioMessage error:", e?.message || e);
    return null;
  }
}
