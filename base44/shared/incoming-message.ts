// Lectura de un mensaje entrante de WhatsApp (formato Baileys / Evolution API).
//
// POR QUE EXISTE: el webhook leia UNICAMENTE `message.conversation` y
// `message.extendedTextMessage.text`. Todo lo demas caia en un `return` temprano que estaba
// ANTES de guardar la fila de Conversation, asi que desaparecia sin dejar rastro: no se
// guardaba, no subia el chat en la bandeja, no contaba como no leido y no llegaba ningun
// aviso. Un paciente mandaba la foto de una orden medica y del otro lado no pasaba nada.
//
// Dos casos que dolian especialmente:
//
//  1. MEDIA CON TEXTO AL PIE (`caption`). El texto viene en el mensaje y se descartaba
//     igual. "Te mando la orden, me das turno el martes?" quedaba en silencio total.
//  2. MENSAJES EFIMEROS Y DE VER UNA VEZ. El contenido real viene ANIDADO adentro de otro
//     mensaje, asi que un texto comun y corriente se perdia solo porque el paciente tenia
//     los mensajes temporales activados.

// Los sobres que envuelven a otro mensaje. Hay que abrirlos antes de mirar nada.
const WRAPPERS = [
  "ephemeralMessage",
  "viewOnceMessage",
  "viewOnceMessageV2",
  "viewOnceMessageV2Extension",
  "documentWithCaptionMessage",
];

export function unwrapMessage(message, depth = 0) {
  if (!message || depth > 5) return message || null;
  for (const key of WRAPPERS) {
    if (message[key]?.message) return unwrapMessage(message[key].message, depth + 1);
  }
  return message;
}

// Como se describe cada tipo en la bandeja cuando no hay texto que mostrar. El profesional
// tiene que poder ver DE UN VISTAZO que el paciente le mando algo, aunque la app todavia no
// muestre el archivo en si.
const KINDS = [
  ["imageMessage", "\u{1F4F7} Foto"],
  ["videoMessage", "\u{1F3A5} Video"],
  ["audioMessage", "\u{1F3A4} Nota de voz"],
  ["documentMessage", "\u{1F4C4} Documento"],
  ["stickerMessage", "\u{1F600} Sticker"],
  ["locationMessage", "\u{1F4CD} Ubicación"],
  ["liveLocationMessage", "\u{1F4CD} Ubicación en tiempo real"],
  ["contactMessage", "\u{1F464} Contacto"],
  ["contactsArrayMessage", "\u{1F464} Contactos"],
  ["pollCreationMessage", "\u{1F4CA} Encuesta"],
  ["pollUpdateMessage", "\u{1F4CA} Respuesta a una encuesta"],
  ["buttonsResponseMessage", "\u{1F518} Respuesta"],
  ["listResponseMessage", "\u{1F518} Respuesta"],
  ["templateButtonReplyMessage", "\u{1F518} Respuesta"],
];

// Devuelve:
//   text       -> lo que el BOT debe leer como mensaje del paciente. Vacio = el bot no
//                 responde (no hay nada que interpretar).
//   display    -> lo que se guarda en la bandeja. Nunca vacio si hubo algo.
//   kind       -> "text" | "audio" | "media" | "reaction" | "unknown"
//   isAudio    -> nota de voz (tiene su propio circuito de transcripcion).
//
// CRITERIO CON EL CAPTION: el texto al pie de una foto SI se le pasa al bot, porque lo
// escribio el paciente y normalmente es el pedido concreto ("me das turno el martes?"). El
// bot no ve la imagen, pero responde a lo que la persona pidio, que es lo que importa. En la
// bandeja se guarda con el prefijo del tipo, asi el profesional sabe que ademas venia una
// foto.
export function readIncomingMessage(rawMessage) {
  const message = unwrapMessage(rawMessage);
  if (!message) return { text: "", display: "", kind: "unknown", isAudio: false };

  const plain = message.conversation || message.extendedTextMessage?.text || "";
  if (plain) return { text: plain, display: plain, kind: "text", isAudio: false };

  // Las reacciones (un emoji sobre un mensaje anterior) no son un mensaje nuevo: no se
  // guardan ni despiertan al bot, para no ensuciar la bandeja con un "chat nuevo" cada vez
  // que alguien pone un pulgar arriba.
  if (message.reactionMessage) return { text: "", display: "", kind: "reaction", isAudio: false };

  const hit = KINDS.find(([key]) => message[key]);
  if (!hit) return { text: "", display: "", kind: "unknown", isAudio: false };

  const [key, label] = hit;
  const node = message[key] || {};
  const caption = String(node.caption || "").trim();
  const fileName = key === "documentMessage" ? String(node.fileName || "").trim() : "";

  let display = label;
  if (fileName) display += ` (${fileName})`;
  if (caption) display += ` — ${caption}`;

  return {
    text: caption,
    display,
    kind: key === "audioMessage" ? "audio" : "media",
    isAudio: key === "audioMessage",
  };
}
