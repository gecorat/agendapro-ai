import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findPatientByCanonicalPhone, toWhatsAppNumber } from '../../shared/phone-utils.ts';
import { findPracticeByOwner, rowBelongsTo } from '../../shared/ownership.ts';
import { pushAppointmentToGoogle } from '../../shared/google-calendar.ts';
import { sendPushToUsers, getPracticeRecipientUserIds } from '../../shared/push.ts';
import { sendWhatsAppMessage } from '../../shared/whatsapp-providers.ts';
import { buildConfirmationMessage, buildPublicBookAckMessage, notifyProfessionalOfBotAction } from '../../shared/zernio.ts';
import { getAppointmentContext } from '../../shared/appointment-context.ts';
import { argentinaDayBounds, isTimeAvailable } from '../../shared/scheduling.ts';
import { getGoogleBusyRanges } from '../../shared/google-calendar.ts';
import { canSendWhatsApp } from '../../shared/plan.ts';
import { logNotification, logWhatsAppToConversation } from '../../shared/notification-log.ts';

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const {
      professional_id,
      professional_ref_id, // opcional: a que profesional puntual del equipo (plan Clinic) va esta cita
      service_id,
      start_datetime,
      first_name,
      last_name,
      phone,
      email,
    } = body;

    if (!professional_id || !service_id || !start_datetime || !first_name || !phone || !email) {
      return Response.json({ error: 'Faltan datos requeridos.' }, { status: 400 });
    }

    // El telefono se resuelve a un numero completo ANTES de hacer nada. Sin esto, el campo
    // aceptaba cualquier texto y despues se le mandaba el WhatsApp a esa cadena tal cual:
    // un numero sin codigo de pais ("3425902123") lo resuelve WhatsApp como puede y la
    // confirmacion termina en el telefono de otra persona real. Confirmado en vivo el 03/09.
    // Excepcion: si YA viene con el 54 y largo completo, se respeta tal cual. Ahi no se
    // puede distinguir un movil (549 + 10) de un FIJO con WhatsApp Business (54 + 10), y
    // normalizarlo le agregaria un 9 que el fijo no tiene, guardando el numero de otro.
    const rawDigits = String(phone || '').replace(/\D/g, '');
    const waPhone = (rawDigits.startsWith('54') && rawDigits.length >= 12)
      ? rawDigits
      : toWhatsAppNumber(phone);
    if (!waPhone) {
      return Response.json(
        { error: 'telefono_invalido', message: 'Revisá el teléfono: escribilo con código de área, por ejemplo 342 590 2123.' },
        { status: 400 }
      );
    }

    const services = await base44.asServiceRole.entities.Service.filter({ id: service_id });
    const service = services?.[0];
    // rowBelongsTo mira practice_owner_id y, si no lo tiene, created_by_id (ver
    // ownership.ts). Comparar created_by_id a secas rechazaba todo servicio creado por el
    // onboarding — y a la vez habría aceptado el de OTRA cuenta, porque Base44 les estampa
    // a todas el mismo id de servicio.
    if (!service || !rowBelongsTo(service, professional_id) || service.active === false) {
      return Response.json({ error: 'El servicio no está disponible.' }, { status: 400 });
    }

    // A que profesional del equipo va la cita. Se valida que exista, que sea de ESTE
    // consultorio y que este activo.
    //
    // Por que importa: este campo es la CLAVE con la que se filtran las citas para el
    // chequeo de solapamiento y la disponibilidad. Se tomaba del body sin verificar nada, asi
    // que mandando un valor cualquiera el filtro quedaba vacio, no chocaba con ninguna cita
    // ni con ningun horario de atencion, y un turno ya vendido se volvia a vender.
    if (professional_ref_id) {
      const prof = (await base44.asServiceRole.entities.Professional.filter({ id: professional_ref_id }))?.[0];
      if (!prof || prof.practice_owner_id !== professional_id || prof.active === false) {
        return Response.json(
          { error: 'profesional_invalido', message: 'Ese profesional no está disponible. Actualizá la página y probá de nuevo.' },
          { status: 400 }
        );
      }
    }

    const start = new Date(start_datetime);
    if (isNaN(start.getTime()) || start.getTime() < Date.now()) {
      return Response.json({ error: 'El horario seleccionado ya no es válido.' }, { status: 400 });
    }
    const end = new Date(start.getTime() + (service.duration_minutes || 30) * 60000);

    // Re-chequeo server-side de solapamiento justo antes de crear. Si la reserva es para
    // un profesional PUNTUAL del equipo (plan Clinic), el choque se chequea SOLO contra
    // las citas de ESE profesional — dos personas del mismo equipo pueden tener citas a
    // la misma hora sin problema, cada uno con su propia agenda.
    // OJO ZONA HORARIA: usamos argentinaDayBounds (mismo helper que ya usa scheduling.ts
    // para el bot) en vez de `.setHours()` directo sobre el Date — `.setHours()` corre en
    // el huso horario del PROCESO (Deno, probablemente UTC), no en el de Argentina. Con
    // `.setHours()` crudo, una reserva entre las 21:00 y 23:59 hora Argentina calculaba mal
    // la ventana del día (desplazada ~3hs) y podía no traer una cita cercana ya existente
    // para el chequeo de solapamiento — riesgo real de doble reserva en ese horario.
    const { start: dayStart, end: dayEnd } = argentinaDayBounds(start);
    const existingAppts = await base44.asServiceRole.entities.Appointment.filter({
      professional_id,
      status: { $ne: 'cancelled' },
      start_datetime: { $gte: dayStart.toISOString(), $lte: dayEnd.toISOString() },
    });
    const relevantAppts = professional_ref_id
      ? (existingAppts || []).filter((a) => a.professional_ref_id === professional_ref_id)
      : (existingAppts || []).filter((a) => !a.professional_ref_id);
    const overlaps = relevantAppts.some((a) => {
      const aStart = new Date(a.start_datetime).getTime();
      const aEnd = new Date(a.end_datetime).getTime();
      return start.getTime() < aEnd && aStart < end.getTime();
    });
    if (overlaps) {
      return Response.json(
        { error: 'slot_taken', message: 'Ese horario ya fue reservado. Por favor elegí otro.' },
        { status: 409 }
      );
    }

    // Validacion real de disponibilidad, con el MISMO motor que usa el bot
    // (shared/scheduling.ts). Hasta ahora este camino solo miraba si chocaba con otra cita:
    // no miraba horario de atencion, ni descansos, ni dias bloqueados, ni el Google Calendar
    // del profesional. O sea que un POST directo a esta funcion podia dejar un turno un
    // domingo a las 3 de la manana, o en pleno horario de almuerzo.
    //
    // La pagina publica ya calcula los horarios con esta misma logica y con los mismos datos
    // (Availability por practice_owner_id + getGoogleBusySlots), asi que una reserva hecha
    // desde la pagina pasa por aca sin cambios. Esto atrapa lo que NO viene de la pagina:
    // llamadas directas, y pestanas viejas cuyos horarios ya quedaron desactualizados.
    //
    // Si el chequeo falla por un error nuestro (no por el horario), se deja pasar: preferimos
    // aceptar una reserva a perderla por una consulta que fallo.
    try {
      const availability = await base44.asServiceRole.entities.Availability.filter({ practice_owner_id: professional_id });
      let googleBusy = [];
      try {
        googleBusy = await getGoogleBusyRanges(
          base44,
          professional_id,
          professional_ref_id || null,
          dayStart.toISOString(),
          dayEnd.toISOString()
        ) || [];
      } catch (e) {
        // Google caido no puede impedir una reserva: el resto de la validacion ya corrio.
        console.error('getGoogleBusyRanges error (createPublicAppointment):', e?.message || e);
      }

      const ok = isTimeAvailable(start, end, service, availability || [], existingAppts || [], professional_ref_id || null, googleBusy);
      if (!ok) {
        return Response.json(
          { error: 'horario_no_disponible', message: 'Ese horario ya no está disponible. Actualizá la página y elegí otro.' },
          { status: 409 }
        );
      }
    } catch (e) {
      console.error('validacion de disponibilidad fallo (createPublicAppointment):', e?.message || e);
    }

    // Buscar paciente existente por teléfono, comparando por teléfono CANÓNICO (últimos
    // 10 dígitos), no texto exacto.
    const allPatients = await base44.asServiceRole.entities.Patient.filter({ professional_id });
    let patient = findPatientByCanonicalPhone(allPatients, phone);
    if (!patient) {
      patient = await base44.asServiceRole.entities.Patient.create({
        first_name,
        last_name: last_name || '',
        phone: waPhone,
        email,
        // Si el paciente dejó su email en el formulario público, es porque quiere recibir
        // cosas ahí: "both" para que le lleguen confirmaciones y recordatorios por los dos
        // canales. Antes esto era 'whatsapp' fijo, así que a nadie que reservara por el link
        // público le llegaba jamás un email, por más que lo hubiera cargado.
        contact_preference: email ? 'both' : 'whatsapp',
        consent_reminders: true,
        professional_id,
        professional_ref_id: professional_ref_id || undefined,
      });
    } else {
      const updates = {};
      if (first_name && first_name !== patient.first_name) updates.first_name = first_name;
      if ((last_name || '') !== (patient.last_name || '')) updates.last_name = last_name || '';
      if (email && email !== patient.email) updates.email = email;
      // Repara sobre la marcha las fichas viejas que quedaron con el telefono a medias
      // (sin codigo de pais). Es el mismo numero — findPatientByCanonicalPhone ya lo
      // matcheo por los ultimos 10 digitos — solo que ahora queda enviable.
      if (patient.phone !== waPhone) updates.phone = waPhone;
      // Si esta reserva puntual es con un profesional del equipo, el paciente "pasa a
      // ser" de ese profesional en la lista (el más reciente con quien reservó).
      if (professional_ref_id && professional_ref_id !== patient.professional_ref_id) {
        updates.professional_ref_id = professional_ref_id;
      }
      if (Object.keys(updates).length) {
        patient = await base44.asServiceRole.entities.Patient.update(patient.id, updates);
      }
    }

    // Cuándo la reserva de la página pública queda CONFIRMADA al instante en vez de
    // "pending" (esperando que el profesional la apruebe a mano):
    //  - Pro/Clinic: siempre automático.
    //  - Basic/Trial: según lo que haya elegido el profesional en Configuración
    //    (auto_confirm_public_bookings), con aprobación manual como predeterminado.
    // OJO: antes esto exigía ADEMÁS tener WhatsApp conectado, porque el único aviso al
    // paciente era por ese canal. Ya no hace falta: si no hay WhatsApp, igual le llega la
    // confirmación por email (sendAppointmentConfirmation, más abajo).
    const practice = await findPracticeByOwner(base44, professional_id);
    const isProOrClinic = practice?.plan === 'pro' || practice?.plan === 'clinic';
    const autoConfirm = isProOrClinic || practice?.auto_confirm_public_bookings === true;

    const appointment = await base44.asServiceRole.entities.Appointment.create({
      patient_id: patient.id,
      patient_name: `${patient.first_name} ${patient.last_name || ''}`.trim(),
      service_id: service.id,
      service_name: service.name,
      start_datetime: start.toISOString(),
      end_datetime: end.toISOString(),
      status: autoConfirm ? 'confirmed' : 'pending',
      origin: 'public_link',
      professional_id,
      professional_ref_id: professional_ref_id || undefined,
    });

    // Empuja el evento a Google Calendar de quien atiende esta cita, si tiene la
    // sincronización conectada. Si falla o no está conectado, no rompe la reserva.
    const googleEventId = await pushAppointmentToGoogle(base44, appointment, professional_id);
    if (googleEventId) {
      await base44.asServiceRole.entities.Appointment.update(appointment.id, { google_event_id: googleEventId });
      appointment.google_event_id = googleEventId;
    }

    if (autoConfirm) {
      // Email: el workflow "Email de confirmación al paciente" solo dispara en un UPDATE
      // de status a "confirmed", no en un CREATE que ya nace confirmado — así que acá lo
      // invocamos a mano, igual que hace el bot de WhatsApp al agendar.
      try {
        // skip_whatsapp: unas líneas más abajo mandamos nosotros la confirmación por
        // WhatsApp (en dos mensajes), así que sendAppointmentConfirmation solo debe
        // encargarse del email — si no, al paciente le llegaría todo duplicado.
        await base44.asServiceRole.functions.invoke('sendAppointmentConfirmation', { appointment_id: appointment.id, skip_whatsapp: true });
      } catch (e) {
        console.error('sendAppointmentConfirmation invoke error (createPublicAppointment):', e?.message || e);
      }
      // WhatsApp: mismo formato de DOS mensajes (aviso corto + tarjeta con los detalles)
      // que ya usa el bot al agendar por chat — antes esto venía todo junto en un solo
      // mensaje cuando se reservaba desde la página, a diferencia de la experiencia por
      // WhatsApp. Solo si hay WhatsApp conectado: sin él, el paciente ya recibió la
      // confirmación por email arriba.
      if (canSendWhatsApp(practice)) {
        // Se registra el envío (NotificationLog + historial del chat) igual que en el resto
        // de los avisos. Este camino era el ÚNICO que no dejaba rastro de nada: cuando una
        // confirmación llegó al teléfono equivocado (03/09) no había forma de reconstruir a
        // qué número había salido. Ahora queda el número exacto al que se envió.
        const ackText = buildPublicBookAckMessage(patient.first_name);
        let waText = null;
        try {
          const { professionalName } = await getAppointmentContext(base44, appointment, practice);
          waText = buildConfirmationMessage({ practice, service, start, professionalName });
          await sendWhatsAppMessage(base44, practice, patient.phone, ackText);
          await sendWhatsAppMessage(base44, practice, patient.phone, waText);
          await logNotification(base44, { appointment, practice, patient, kind: 'confirmation', channel: 'whatsapp', status: 'sent' });
          await logWhatsAppToConversation(base44, { practice, phone: patient.phone, text: ackText });
          if (waText) await logWhatsAppToConversation(base44, { practice, phone: patient.phone, text: waText });
        } catch (e) {
          console.error('sendWhatsAppMessage error (createPublicAppointment):', e?.message || e);
          await logNotification(base44, { appointment, practice, patient, kind: 'confirmation', channel: 'whatsapp', status: 'failed', error: e });
        }
      }
    }

    // Push al dueño (y a cualquier profesional del equipo) — no bloquea la respuesta de la
    // reserva si falla o si todavía no hay VAPID configurado.
    try {
      if (practice) {
        const recipients = await getPracticeRecipientUserIds(base44, practice);
        await sendPushToUsers(base44, recipients, {
          title: autoConfirm ? 'Nueva reserva confirmada' : 'Nueva reserva pendiente',
          body: `${patient.first_name} ${patient.last_name || ''}`.trim() + ` — ${service.name}`,
          url: '/agenda',
          tag: `appt-${appointment.id}`,
        });
      }
    } catch (e) {
      console.error('push createPublicAppointment error:', e?.message || e);
    }

    // Aviso por EMAIL al profesional cuando la cita nace ya confirmada. El workflow
    // "Alerta de cita pendiente" (sendPendingAppointmentAlert) solo dispara para citas en
    // estado 'pending', así que al auto-confirmar las reservas de planes Pro/Clinic el
    // profesional dejó de recibir cualquier aviso por mail de una reserva nueva —
    // confirmado en vivo. Reusamos el mismo aviso que ya manda el bot al agendar (email +
    // push), etiquetado como reserva desde la página en vez de "el bot".
    if (autoConfirm && practice) {
      try {
        await notifyProfessionalOfBotAction(base44, practice, {
          verb: 'agendó',
          appt: appointment,
          actorLabel: 'Un paciente',
          channelLabel: 'Un paciente, desde tu página de reservas,',
        });
      } catch (e) {
        console.error('notifyProfessionalOfBotAction error (createPublicAppointment):', e?.message || e);
      }
    }

    return Response.json({ appointment, patient });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
