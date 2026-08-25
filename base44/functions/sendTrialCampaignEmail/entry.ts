import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { buildEmailHtml, getAppUrl } from '../../shared/email-template.ts';
import { sendEmail } from '../../shared/email-sender.ts';
import { getTrialCampaignStep, getPatientLabel } from '../../shared/trial-campaign-content.ts';

// Un paso (email) de la campaña de conversión de trial. La invoca el workflow
// "Trial Conversion Campaign" una vez por día programado (0, 2, 4, 6, 8, 10, 12, 14).
//
// Se corta sola (no manda el email) si para ese momento el usuario ya no es un target
// válido: ya pasó a un plan pago (¡objetivo cumplido!), la cuenta está suspendida, o
// nunca llegó a crear su PracticeSettings. Así no le seguimos insistiendo a alguien que
// ya convirtió o que ya no corresponde.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { user_id, email, full_name, step } = body;

    if (!email) return Response.json({ error: 'email required' }, { status: 400 });
    if (step === undefined || step === null) return Response.json({ error: 'step required' }, { status: 400 });

    let professionalType = 'other';
    if (user_id) {
      try {
        const settingsList = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user_id });
        const settings = settingsList?.[0];
        if (settings) {
          if (settings.suspended) {
            return Response.json({ sent: false, reason: 'suspended' });
          }
          if (settings.plan && settings.plan !== 'trial') {
            // Ya se convirtió a un plan pago (o un admin se lo asignó a mano): la campaña
            // cumplió su objetivo, no seguimos mandando emails de venta.
            return Response.json({ sent: false, reason: 'already_on_paid_plan' });
          }
          professionalType = settings.professional_type || 'other';
        }
        // Si no hay settings todavía (no terminó el onboarding), seguimos mandando la
        // campaña igual, con copy genérico — es justo a quien más le sirve el empujón.
      } catch {
        // Si falla la consulta, no bloqueamos el envío por eso.
      }
    }

    const name = (full_name || '').split(' ')[0] || 'profesional';
    const patientLabel = getPatientLabel(professionalType);
    const content = getTrialCampaignStep(Number(step), { name, patientLabel });
    if (!content) {
      return Response.json({ error: `invalid step: ${step}` }, { status: 400 });
    }

    const appUrl = await getAppUrl(base44, req);

    await sendEmail(base44, {
      to: email,
      subject: content.subject,
      body: buildEmailHtml({
        title: content.title,
        greeting: `Hola ${name}`,
        lines: content.lines,
        primaryButton: { label: content.primaryButton.label, url: `${appUrl}${content.primaryButton.path}` },
        footer: 'Kame Agenda · Tu recepcionista virtual',
      }),
    });

    return Response.json({ sent: true, step: Number(step) });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
