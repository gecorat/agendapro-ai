import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendEmail } from '../../shared/email-sender.ts';
import { buildEmailHtml } from '../../shared/email-template.ts';
import { sendWhatsAppMessage } from '../../shared/whatsapp-providers.ts';
import { canSendWhatsApp } from '../../shared/plan.ts';

// Avisa al PACIENTE por WhatsApp y/o email cuando el PROFESIONAL reagenda o cancela una
// cita a mano desde la Agenda (DayDetailSheet, AppointmentForm, etc.). Antes esto solo
// pasaba cuando la acción venía del bot de WhatsApp — un cambio hecho a mano desde el
// panel no le avisaba nada al paciente, aunque el cambio quedara reflejado en la Agenda.
// Best-effort en los dos canales: si uno falla (o no hay dato), sigue con el otro; nunca
// rompe el guardado de la cita en sí, que ya pasó antes de llamar a esta función.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { appointmentId, changeType, previousStartDatetime } = body || {};
    if (!appointmentId || !['rescheduled', 'cancelled'].includes(changeType)) {
      return Response.json({ error: 'appointmentId y changeType (rescheduled|cancelled) son requeridos' }, { status: 400 });
    }

    const appts = await base44.asServiceRole.entities.Appointment.filter({ id: appointmentId });
    const appt = appts?.[0];
    if (!appt) return Response.json({ notified: false, reason: 'appointment_not_found' });

    let patient = null;
    if (appt.patient_id) {
      const pats = await base44.asServiceRole.entities.Patient.filter({ id: appt.patient_id });
      patient = pats?.[0] || null;
    }
    if (!patient) return Response.json({ notified: false, reason: 'no_patient' });

    const practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
    const practice = practices.find((p) => p.created_by_id === (appt.professional_id || appt.created_by_id)) || null;

    const patientName = `${patient.first_name || ''} ${patient.last_name || ''}`.trim() || 'Paciente';
    const serviceName = appt.service_name || 'tu consulta';
    const newDateStr = new Date(appt.start_datetime).toLocaleString('es-AR', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'America/Argentina/Buenos_Aires',
    });
    const oldDateStr = previousStartDatetime
      ? new Date(previousStartDatetime).toLocaleString('es-AR', {
          weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
          timeZone: 'America/Argentina/Buenos_Aires',
        })
      : null;
    const practiceName = practice?.practice_name || 'el consultorio';

    const waText = changeType === 'rescheduled'
      ? `Hola ${patientName}, te escribimos de ${practiceName} para avisarte que tu turno de ${serviceName}${oldDateStr ? ` (antes ${oldDateStr})` : ''} fue reagendado para el ${newDateStr}. Cualquier consulta, avisanos por acá.`
      : `Hola ${patientName}, te escribimos de ${practiceName} para avisarte que tu turno de ${serviceName} del ${newDateStr} fue cancelado. Si querés reagendar, avisanos por acá.`;

    let whatsappSent = false;
    if (canSendWhatsApp(practice) && patient.phone) {
      try {
        await sendWhatsAppMessage(base44, practice, patient.phone, waText);
        whatsappSent = true;
        // Queda en el historial de la conversación con este paciente, igual que
        // cualquier otro mensaje del bot, para que la bandeja de chats no tenga un hueco.
        await base44.asServiceRole.entities.Conversation.create({
          phone: patient.phone,
          professional_id: appt.professional_id || appt.created_by_id,
          role: 'assistant',
          text: waText,
          conversation_id: patient.phone,
          account_id: practice.whatsapp_connection_type === 'qr' ? practice.evolution_instance_name : practice.zernio_account_id,
          sent_by: 'system',
        });
      } catch (e) {
        console.error('notifyPatientOfAppointmentChange WhatsApp error:', e?.message || e);
      }
    }

    let emailSent = false;
    if (patient.email) {
      try {
        await sendEmail(base44, {
          to: patient.email,
          subject: changeType === 'rescheduled' ? `Tu cita fue reagendada — ${serviceName}` : `Tu cita fue cancelada — ${serviceName}`,
          body: buildEmailHtml({
            title: changeType === 'rescheduled' ? 'Cita reagendada' : 'Cita cancelada',
            greeting: `Hola ${patientName}`,
            lines: changeType === 'rescheduled'
              ? [`Tu cita de ${serviceName} fue reagendada${oldDateStr ? ` (antes ${oldDateStr})` : ''}.`]
              : [`Tu cita de ${serviceName} del ${newDateStr} fue cancelada.`],
            details: [
              { label: changeType === 'rescheduled' ? 'Nuevo día y horario' : 'Día y horario', value: newDateStr },
            ],
            footer: practiceName,
          }),
        });
        emailSent = true;
      } catch (e) {
        console.error('notifyPatientOfAppointmentChange email error:', e?.message || e);
      }
    }

    return Response.json({ notified: whatsappSent || emailSent, whatsappSent, emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
