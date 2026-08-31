// Capa de envío de email vía Resend.
// Permite enviar a destinatarios externos (pacientes) sin restricciones de usuario registrado.
//
// El remitente se toma del secret RESEND_FROM_EMAIL (configurar en Dashboard → Secrets una vez
// que el dominio esté verificado en Resend, ej: "Kame Agenda <no-reply@tudominio.com>"). Si no
// está configurado, se usa un remitente genérico como fallback para no romper el envío.
const RESEND_FROM = process.env.RESEND_FROM_EMAIL || "noreply@agendate.base44.app";

// A dónde tiene que ir la respuesta si el paciente contesta el mail. El remitente es un
// no-reply del dominio verificado en Resend (no se puede mandar desde la casilla personal
// del profesional sin verificar SU dominio), así que sin esto una respuesta del paciente
// se perdía en el vacío. Con reply_to, contestar el recordatorio le llega al profesional.
export function replyToFor(practice) {
  const email = (practice?.professional_email || "").trim();
  return email || undefined;
}

export async function sendEmail(base44, { to, subject, body, replyTo }) {
  if (!to) throw new Error("sendEmail: destinatario requerido");
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("sendEmail: RESEND_API_KEY no configurado");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: RESEND_FROM,
      to,
      subject,
      html: body,
      ...(replyTo ? { reply_to: replyTo } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`sendEmail: Resend ${res.status}: ${text}`);
  }
}