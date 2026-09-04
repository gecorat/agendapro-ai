import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendEmail, replyToFor } from '../../shared/email-sender.ts';
import { buildEmailHtml } from '../../shared/email-template.ts';
import { sendWhatsAppMessage } from '../../shared/whatsapp-providers.ts';
import { canSendWhatsApp } from '../../shared/plan.ts';
import { logNotification } from '../../shared/notification-log.ts';
import { getAppUrl } from '../../shared/email-template.ts';
import { findPracticeByOwner } from '../../shared/ownership.ts';

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
    // Los recordatorios ya enviados corresponden al horario VIEJO: al reagendar hay que
    // resetear el contador para que sendReminders vuelva a avisar sobre el horario nuevo.
    // Sin esto, un turno reagendado desde el panel se quedaba sin recordatorio.
    if (changeType === 'rescheduled' && (appt.reminders_sent || 0) > 0) {
      try {
        await base44.asServiceRole.entities.Appointment.update(appt.id, { reminders_sent: 0 });
      } catch (e) {
        console.error('notifyPatientOfAppointmentChange reset reminders_sent error:', e?.message || e);
      }
    }

    if (!patient) return Response.json({ notified: false, reason: 'no_patient' });

    // Por el criterio de propiedad real: comparar created_by_id a secas dejaba sin aviso a
    // las cuentas creadas por el onboarding (ver base44/shared/ownership.ts).
    const practice = await findPracticeByOwner(base44, appt.professional_id || appt.created_by_id);

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

    // Botones de autogestión, los mismos que ya traen la confirmación y el recordatorio.
    // Antes este mail salía SIN ningún botón: al paciente le avisábamos que su turno había
    // cambiado y no le dejábamos ninguna forma de reagendarlo ni cancelarlo.
    //
    // Reagendar necesita página pública (el flujo termina eligiendo un horario nuevo en
    // /u/:handle), así que si el consultorio todavía no eligió su @usuario, ese botón no se
    // muestra — mejor eso que un link que lleva a la nada.
    const appUrl = await getAppUrl(base44, req);
    let cancelToken = appt.cancel_token;
    const needsTokenSave = !cancelToken;
    if (!cancelToken) cancelToken = crypto.randomUUID();
    const rescheduleUrl = practice?.handle ? `${appUrl}/reschedule/${cancelToken}` : null;
    const cancelUrl = `${appUrl}/x/${cancelToken}`;
    const bookAgainUrl = practice?.handle ? `${appUrl}/u/${practice.handle}` : null;

    const waText = changeType === 'rescheduled'
      ? `Hola ${patientName}, te escribimos de ${practiceName} para avisarte que tu turno de ${serviceName}${oldDateStr ? ` (antes ${oldDateStr})` : ''} fue reagendado para el ${newDateStr}. Cualquier consulta, avisanos por acá.`
      : `Hola ${patientName}, te escribimos de ${practiceName} para avisarte que tu turno de ${serviceName} del ${newDateStr} fue cancelado. Si querés reagendar, avisanos por acá.`;

    const logArgs = { appointment: appt, practice, patient, kind: changeType === 'rescheduled' ? 'rescheduled' : 'cancelled' };

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
        await logNotification(base44, { ...logArgs, channel: 'whatsapp', status: 'sent' });
      } catch (e) {
        console.error('notifyPatientOfAppointmentChange WhatsApp error:', e?.message || e);
        await logNotification(base44, { ...logArgs, channel: 'whatsapp', status: 'failed', error: e });
      }
    }

    let emailSent = false;
    if (patient.email) {
      try {
        await sendEmail(base44, {
          to: patient.email,
          // Si el paciente responde el aviso de cambio, que le llegue al profesional.
          replyTo: replyToFor(practice),
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
            // Reagendado: puede volver a mover el turno o cancelarlo.
            // Cancelado: el turno ya no existe, así que lo único útil es sacar uno nuevo.
            primaryButton: changeType === 'rescheduled'
              ? (rescheduleUrl ? { label: 'Reagendar', url: rescheduleUrl } : null)
              : (bookAgainUrl ? { label: 'Reservar otro turno', url: bookAgainUrl } : null),
            secondaryButton: changeType === 'rescheduled'
              ? { label: 'Cancelar cita', url: cancelUrl }
              : null,
          }),
        });
        emailSent = true;
        await logNotification(base44, { ...logArgs, channel: 'email', status: 'sent' });
      } catch (e) {
        console.error('notifyPatientOfAppointmentChange email error:', e?.message || e);
        await logNotification(base44, { ...logArgs, channel: 'email', status: 'failed', error: e });
      }
    }

    // El token recién se guarda si de verdad se usó en un mail enviado: así no se le
    // escribe un cancel_token a una cita cuyo paciente no tiene email.
    if (needsTokenSave && emailSent) {
      try {
        await base44.asServiceRole.entities.Appointment.update(appt.id, { cancel_token: cancelToken });
      } catch (e) {
        console.error('notifyPatientOfAppointmentChange cancel_token save error:', e?.message || e);
      }
    }

    return Response.json({ notified: whatsappSent || emailSent, whatsappSent, emailSent });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
