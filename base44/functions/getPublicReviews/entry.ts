import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { findPracticeRowsByOwner } from "../../shared/ownership.ts";

// Endpoint público (visitante anónimo) para la sección "Reseñas de pacientes" de la
// página de reservas (/u/:handle). ReviewRequest tiene lectura restringida por RLS al
// dueño/profesional/admin (ver base44/entities/ReviewRequest.jsonc) porque guarda datos
// sensibles del paciente (teléfono, email, token) — así que esta función usa
// asServiceRole y devuelve SOLO los campos seguros de mostrar en público, de las
// reseñas ya recibidas y con calificación cargada.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const { professional_id } = body;

    if (!professional_id) {
      return Response.json({ error: 'professional_id required' }, { status: 400 });
    }

    const settingsList = await findPracticeRowsByOwner(base44, professional_id);
    const settings = settingsList?.[0];
    // Si el profesional desactivó la sección, no exponemos nada (ni aunque nos pidan
    // el endpoint directo con su professional_id).
    if (settings && settings.show_reviews_public === false) {
      return Response.json({ reviews: [] });
    }

    const received = await base44.asServiceRole.entities.ReviewRequest.filter({
      professional_id,
      status: 'received',
    });

    const reviews = (received || [])
      .filter((r) => r.rating != null)
      .sort((a, b) => new Date(b.received_at || 0).getTime() - new Date(a.received_at || 0).getTime())
      .slice(0, 24)
      .map((r) => ({
        id: r.id,
        name: r.patient_name || 'Paciente',
        rating: r.rating,
        comment: r.review_text || '',
        service_name: r.service_name || '',
      }));

    return Response.json({ reviews });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
