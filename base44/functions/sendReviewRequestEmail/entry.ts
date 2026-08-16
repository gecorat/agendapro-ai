import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendEmail } from '../../shared/email-sender.ts';
import { buildEmailHtml } from '../../shared/email-template.ts';

// El bot\u00f3n "Email" de Reviews usaba antes base44.integrations.Core.SendEmail (el sistema
// nativo de Base44), que solo puede enviar a usuarios REGISTRADOS de la app. Los pacientes
// no lo son, as\u00ed que ese env\u00edo fallaba en silencio. Esta funci\u00f3n usa el mismo canal Resend
// (con tu dominio propio) que ya usamos para las confirmaciones de turno.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { review_id } = body;

    if (!review_id) {
      return Response.json({ error: 'Falta review_id' }, { status: 400 });
    }

    const review = await base44.asServiceRole.entities.ReviewRequest.get(review_id);
    if (!review) {
      return Response.json({ error: 'Solicitud de rese\u00f1a no encontrada' }, { status: 404 });
    }
    if (!review.patient_email) {
      return Response.json({ error: 'Este paciente no tiene email cargado' }, { status: 400 });
    }

    let appUrl = 'https://agendate.base44.app';
    try {
      const cfgList = await base44.asServiceRole.entities.PlatformConfig.filter({});
      const configured = (cfgList?.[0]?.app_base_url || '').trim();
      if (configured) appUrl = configured.replace(/\/+$/, '');
    } catch {}

    const reviewLink = `${appUrl}/r/${review.id}${review.token ? `?t=${review.token}` : ''}`;
    const message = review.request_message || `\u00a1Hola ${review.patient_name || ''}! Gracias por tu visita. \u00bfNos dejar\u00edas una rese\u00f1a?`;

    const html = buildEmailHtml({
      title: '\u00bfNos dej\u00e1s tu rese\u00f1a?',
      lines: [message],
      primaryButton: { label: 'Dejar rese\u00f1a', url: reviewLink },
    });

    await sendEmail(base44, {
      to: review.patient_email,
      subject: '\u00bfNos dej\u00e1s tu rese\u00f1a?',
      body: html,
    });

    await base44.asServiceRole.entities.ReviewRequest.update(review_id, {
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
