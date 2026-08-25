import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const action = body?.action;
    const id = body?.id;
    const token = body?.token;

    if (!id) return Response.json({ error: 'Falta el id de la solicitud' }, { status: 400 });
    if (!token) return Response.json({ error: 'Token de acceso requerido' }, { status: 401 });

    if (action === 'get') {
      let rev;
      try {
        rev = await base44.asServiceRole.entities.ReviewRequest.get(id);
      } catch {
        return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      }
      if (!rev) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      if (!rev.token || rev.token !== token) {
        return Response.json({ error: 'Token de acceso inválido' }, { status: 401 });
      }
      if (rev.disabled) return Response.json({ error: 'Solicitud no disponible' }, { status: 404 });

      let practice_name = '';
      let page_color = '#0f172a';
      let google_review_link = '';
      try {
        // rev.created_by_id NO sirve cuando la solicitud la creó el cron automático
        // (autoCompleteAppointments corre asServiceRole, que deja un id sintético tipo
        // "service_..." ahí en vez del dueño real). rev.professional_id sí queda bien en
        // ese caso, así que se prueba primero y created_by_id queda de respaldo para
        // solicitudes creadas a mano desde el manager (esas sí tienen created_by_id
        // correcto, pero no professional_id).
        const ownerId = rev.professional_id || rev.created_by_id;
        const settings = await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: ownerId });
        const s = settings?.[0];
        practice_name = s?.practice_name || '';
        page_color = s?.page_color || '#0f172a';
        google_review_link = s?.google_review_link || '';
      } catch {}

      return Response.json({
        practice_name,
        page_color,
        google_review_link,
        patient_name: rev.patient_name,
        service_name: rev.service_name,
        appointment_date: rev.appointment_date,
        status: rev.status,
        rating: rev.rating || null
      });
    }

    if (action === 'submit') {
      const rating = Number(body?.rating);
      const review_text = (body?.review_text || '').toString().slice(0, 2000);
      if (!rating || rating < 1 || rating > 5) {
        return Response.json({ error: 'Calificación inválida' }, { status: 400 });
      }
      let rev;
      try {
        rev = await base44.asServiceRole.entities.ReviewRequest.get(id);
      } catch {
        return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      }
      if (!rev) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      if (!rev.token || rev.token !== token) {
        return Response.json({ error: 'Token de acceso inválido' }, { status: 401 });
      }
      if (rev.disabled) return Response.json({ error: 'Solicitud no disponible' }, { status: 404 });
      if (rev.status === 'received') return Response.json({ error: 'Ya respondida' }, { status: 400 });

      await base44.asServiceRole.entities.ReviewRequest.update(id, {
        rating,
        review_text,
        status: 'received',
        received_at: new Date().toISOString()
      });
      return Response.json({ ok: true });
    }

    if (action === 'trackGoogleClick') {
      let rev;
      try {
        rev = await base44.asServiceRole.entities.ReviewRequest.get(id);
      } catch {
        return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      }
      if (!rev) return Response.json({ error: 'Solicitud no encontrada' }, { status: 404 });
      if (!rev.token || rev.token !== token) {
        return Response.json({ error: 'Token de acceso inválido' }, { status: 401 });
      }
      // Solo señal de intención (click), no confirma que se haya publicado la reseña en
      // Google — eso pasa fuera de la plataforma.
      await base44.asServiceRole.entities.ReviewRequest.update(id, {
        google_review_clicked: true,
        google_review_clicked_at: new Date().toISOString()
      });
      return Response.json({ ok: true });
    }

    return Response.json({ error: 'Acción inválida' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}