import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildEmailHtml, getAppUrl } from '../../shared/email-template.ts';
import { sendEmail } from '../../shared/email-sender.ts';

// Invitación de prueba con la marca de Kame Agenda, en español, en vez del email nativo
// de Base44 (en inglés, sin marca, confuso). Manda directo a /register — nada de tokens
// ni cuentas previas, la persona entra y arranca su propio trial normal.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || user.role !== 'admin') return Response.json({ error: 'Solo administradores' }, { status: 403 });

    const body = await req.json();
    const { email, name } = body || {};
    if (!email) return Response.json({ error: 'email requerido' }, { status: 400 });

    const appUrl = await getAppUrl(base44, req);
    const registerUrl = `${appUrl}/register`;

    await sendEmail(base44, {
      to: email,
      subject: 'Te invitaron a probar Kame Agenda',
      body: buildEmailHtml({
        title: 'Tu asistente virtual para agendar citas',
        greeting: name ? `Hola ${name}` : 'Hola',
        lines: [
          `${user.full_name || 'Un colega'} te invitó a probar Kame Agenda: agenda online, recordatorios automáticos y un asistente de WhatsApp con IA que atiende a tus pacientes 24/7.`,
          'Empezá gratis, sin tarjeta — el registro te lleva un minuto.',
        ],
        primaryButton: { label: 'Probar Kame Agenda gratis', url: registerUrl },
        footer: 'Kame Agenda · Recepcionista virtual',
      }),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
