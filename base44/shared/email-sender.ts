// Capa de envío de email aislada para facilitar la migración futura a Resend.
// Hoy usa el SendEmail nativo de Base44 (requiere envíos a externos habilitados).
// Para migrar a Resend, reemplazar el cuerpo de sendEmail() por la API de Resend
// usando una API key almacenada como secreto (RESEND_API_KEY).

export async function sendEmail(base44, { to, subject, body }) {
  if (!to) throw new Error("sendEmail: destinatario requerido");
  await base44.asServiceRole.integrations.Core.SendEmail({ to, subject, body });
}