import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendEmail } from "../../shared/email-sender.ts";
import { sendWhatsAppMessage } from "../../shared/whatsapp-providers.ts";
import { buildEmailHtml, getAppUrl } from "../../shared/email-template.ts";
import { getAppointmentContext } from "../../shared/appointment-context.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);
    const appUrl = await getAppUrl(base44, req);

    const all = await base44.asServiceRole.entities.Appointment.filter({ status: "confirmed" });
    const toRemind = (all || []).filter((a) => {
      if (a.is_demo) return false; // cita de prueba del simulador /bot — nunca recordatorios reales
      const start = new Date(a.start_datetime);
      const reminders = a.reminders_sent || 0;
      const in24Window = reminders === 0 && start >= now && start <= in24h;
      const in3Window = reminders === 1 && start >= now && start <= in3h;
      return in24Window || in3Window;
    });

    // Cache de PracticeSettings para evitar consultas repetidas
    let practices = null;
    const getPracticeFor = async (appt) => {
      if (!practices) {
        practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
      }
      const profId = appt.professional_id || appt.created_by_id;
      return (practices || []).find((p) => p.created_by_id === profId) || null;
    };

    let sent = 0;
    let skipped = 0;
    const errors = [];

    for (const appt of toRemind) {
      try {
        // Paciente
        let patient = null;
        if (appt.patient_id) {
          try {
            const pats = await base44.asServiceRole.entities.Patient.filter({ id: appt.patient_id });
            patient = pats?.[0];
          } catch {}
        }
        // Respeta consentimiento explícito
        if (patient && patient.consent_reminders === false) { skipped++; continue; }

        const patientName = patient
          ? `${patient.first_name} ${patient.last_name || ""}`.trim() || appt.patient_name || ""
          : appt.patient_name || "";

        const startDate = new Date(appt.start_datetime);
        const dateStr = startDate.toLocaleString("es-AR", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" });
        const is3h = (appt.reminders_sent || 0) >= 1;
        const serviceName = appt.service_name || "consulta";

        const practice = await getPracticeFor(appt);
        const { professionalName, address } = await getAppointmentContext(base44, appt, practice);

        // Aseguramos un cancel_token para poder ofrecer los mismos botones de la
        // confirmación (reagendar / cancelar) también acá, no solo texto plano. OJO: no lo
        // guardamos todavía con un update aparte — dos updates seguidos sobre el mismo
        // registro en la misma corrida pisaban el cambio (se probó y el cancel_token
        // volvía a null). Lo combinamos en un único update al final, junto a reminders_sent.
        let cancelToken = appt.cancel_token;
        const needsTokenSave = !cancelToken;
        if (!cancelToken) cancelToken = crypto.randomUUID();
        const rescheduleUrl = practice?.handle ? `${appUrl}/reschedule/${cancelToken}` : null;
        const cancelUrl = `${appUrl}/x/${cancelToken}`;

        const subject = is3h ? `Tu cita es en 3 horas — ${serviceName}` : `Recordatorio: tu cita de mañana — ${serviceName}`;
        const emailBody = buildEmailHtml({
          title: is3h ? "Tu cita es en 3 horas" : "Recordatorio de tu cita",
          greeting: `Hola ${patientName}`,
          lines: [
            `Tu cita de ${serviceName} fue confirmada. ¡Te esperamos!`,
            "Si necesitás reagendar o cancelar, usá los botones de abajo.",
          ],
          details: [
            { label: "Día y horario", value: dateStr },
            { label: "Profesional", value: professionalName || "—" },
            ...(address ? [{ label: "Dirección", value: address }] : []),
          ],
          primaryButton: rescheduleUrl ? { label: "Reagendar", url: rescheduleUrl } : null,
          secondaryButton: { label: "Cancelar cita", url: cancelUrl },
          footer: practice?.practice_name || "Kame Agenda",
        });

        const waReminderText = [
          `Hola ${patientName}, te recordamos tu cita de ${serviceName} para el ${dateStr}.`,
          address ? `📍 ${address}` : null,
          "¡Te esperamos!",
        ].filter(Boolean).join("\n");

        // Decidir canal
        const plan = practice?.plan || "trial";
        const pref = patient?.contact_preference || "email";
        // Bug corregido: comparaba contra "premium", que ya no existe (el plan se llama
        // "clinic" desde el rediseño de precios) — los recordatorios por WhatsApp nunca se
        // disparaban para cuentas Clinic.
        const whatsappAllowed = plan === "pro" || plan === "clinic";
        const wantsWhatsApp = pref === "whatsapp" || pref === "both";

        let channelUsed = "email";
        if (whatsappAllowed && wantsWhatsApp && patient?.phone) {
          // Antes esto solo chequeaba `zernio_account_id` para decidir si había WhatsApp
          // conectado — una cuenta conectada por QR (Evolution API) nunca tiene ese campo
          // cargado, así que NUNCA le llegaban recordatorios por WhatsApp a sus pacientes,
          // sin ningún error visible (caía derecho al fallback de email en silencio). Ahora
          // usamos la misma función genérica que ya sabe elegir Zernio o Evolution según
          // corresponda, igual que el bot y las respuestas manuales.
          const whatsAppConnected = !!practice?.whatsapp_connected;
          if (whatsAppConnected) {
            try {
              await sendWhatsAppMessage(base44, practice, patient.phone, waReminderText);
              channelUsed = "whatsapp";
            } catch (e) {
              // Fallback a email si WhatsApp falla y el paciente acepta email
              if (pref === "both" && patient.email) {
                await sendEmail(base44, { to: patient.email, subject, body: emailBody });
                channelUsed = "email";
              } else {
                throw e;
              }
            }
          } else if (patient.email) {
            await sendEmail(base44, { to: patient.email, subject, body: emailBody });
          } else {
            skipped++; continue;
          }
        } else if (patient?.email) {
          await sendEmail(base44, { to: patient.email, subject, body: emailBody });
        } else {
          skipped++; continue;
        }

        await base44.asServiceRole.entities.Appointment.update(appt.id, {
          reminders_sent: (appt.reminders_sent || 0) + 1,
          ...(needsTokenSave ? { cancel_token: cancelToken } : {}),
        });
        sent++;
      } catch (e) {
        errors.push({ appointment_id: appt.id, error: e?.message || String(e) });
      }
    }

    return Response.json({ sent, skipped, total: toRemind.length, errors });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
