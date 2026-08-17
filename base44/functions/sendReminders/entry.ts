import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { sendEmail } from "../../shared/email-sender.ts";
import { sendWhatsApp, getPlatformConfig } from "../../shared/zernio.ts";

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in3h = new Date(now.getTime() + 3 * 60 * 60 * 1000);

    const all = await base44.asServiceRole.entities.Appointment.filter({ status: "confirmed" });
    const toRemind = (all || []).filter((a) => {
      const start = new Date(a.start_datetime);
      const reminders = a.reminders_sent || 0;
      const in24Window = reminders === 0 && start >= now && start <= in24h;
      const in3Window = reminders === 1 && start >= now && start <= in3h;
      return in24Window || in3Window;
    });

    // Cache de PracticeSettings y PlatformConfig para evitar consultas repetidas
    let practices = null;
    let platformConfig = null;
    const getPracticeFor = async (appt) => {
      if (!practices) {
        practices = await base44.asServiceRole.entities.PracticeSettings.filter({});
      }
      const profId = appt.professional_id || appt.created_by_id;
      return (practices || []).find((p) => p.created_by_id === profId) || null;
    };
    const getPlatformConfig = async () => {
      if (!platformConfig) platformConfig = await getPlatformConfigShared(base44);
      return platformConfig;
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
        const subject = is3h ? "Recordatorio: tu cita es en 3 horas" : "Recordatorio de tu cita";
        const body = `Hola ${patientName},\n\nTe recordamos tu cita de ${appt.service_name || "consulta"} para el ${dateStr}.\n\nSi necesitás reprogramar, respondé a este email.\n\n¡Te esperamos!\n\nAgendaPro`;

        // Decidir canal
        const practice = await getPracticeFor(appt);
        const plan = practice?.plan || "trial";
        const pref = patient?.contact_preference || "email";
        const whatsappAllowed = plan === "pro" || plan === "premium";
        const wantsWhatsApp = pref === "whatsapp" || pref === "both";

        let channelUsed = "email";
        if (whatsappAllowed && wantsWhatsApp && patient?.phone) {
          const zernioConnected = practice?.whatsapp_connected && practice?.zernio_account_id;
          if (zernioConnected) {
            try {
              const plat = await getPlatformConfig();
              await sendWhatsApp(base44, {
                apiKey: plat?.zernio_api_key,
                accountId: practice.zernio_account_id,
                phone: patient.phone,
                message: `Hola ${patientName}, te recordamos tu cita de ${appt.service_name || "consulta"} para el ${dateStr}. ¡Te esperamos!`,
              });
              channelUsed = "whatsapp";
            } catch (e) {
              // Fallback a email si WhatsApp falla y el paciente acepta email
              if (pref === "both" && patient.email) {
                await sendEmail(base44, { to: patient.email, subject, body });
                channelUsed = "email";
              } else {
                throw e;
              }
            }
          } else if (patient.email) {
            await sendEmail(base44, { to: patient.email, subject, body });
          } else {
            skipped++; continue;
          }
        } else if (patient?.email) {
          await sendEmail(base44, { to: patient.email, subject, body });
        } else {
          skipped++; continue;
        }

        await base44.asServiceRole.entities.Appointment.update(appt.id, { reminders_sent: (appt.reminders_sent || 0) + 1 });
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

async function getPlatformConfigShared(base44) {
  const list = await base44.asServiceRole.entities.PlatformConfig.filter({});
  return list?.[0] || null;
}