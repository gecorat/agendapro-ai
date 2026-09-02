import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

// Datos de un consultorio para su PAGINA PUBLICA de reservas, por handle. Sin sesion.
//
// Existe para poder cerrar la lectura de PracticeSettings. Hoy esa entidad tiene
// rls read: {} (lectura publica sin condiciones) porque la pagina de reservas la consulta
// como visitante anonimo. El problema es que eso no expone "el consultorio que estas
// mirando": expone la entidad ENTERA, con sus 68 campos, para TODOS los consultorios de la
// plataforma. Un GET sin cuenta devolvia la lista completa de clientes del SaaS con
// professional_email, phone, plan, trial_ends_at, suspended, mercadopago_subscription_id,
// evolution_instance_name, zernio_account_id y los prompts del bot.
//
// Aca se devuelve solo lo que la pagina realmente pinta, y solo de un consultorio
// publicado. Los datos de contacto que si van (phone, professional_email, zernio_phone)
// son los que el profesional eligio mostrar en su propia pagina.

// Lista cerrada. Sacada de recorrer todos los usos de `settings` en
// src/pages/PublicBooking.jsx (incluidos ProfileHeader, DescriptionBlock y ContactBlock,
// que viven en ese mismo archivo) mas los que se leen sueltos al resolver el handle.
const PUBLIC_FIELDS = [
  'id',
  'created_by_id',
  'handle',
  'published',
  'plan',
  // Identidad y presentacion
  'practice_name',
  'specialty',
  'description',
  'photo_url',
  'photo_align',
  'cover_image_url',
  'cover_align',
  'avatar_border_radius',
  'custom_border_radius',
  'theme_preset',
  'page_color',
  'heading_font_override',
  // Contacto que el profesional elige publicar en su pagina
  'phone',
  'professional_email',
  'zernio_phone',
  'website_url',
  'instagram_url',
  'facebook_url',
  // Direccion y mapa
  'address',
  'address_city',
  'address_province',
  'address_lat',
  'address_lng',
  // Resenas
  'show_reviews_public',
];

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json().catch(() => ({}));
    const handle = String(body?.handle || '').trim().replace(/^@/, '');
    if (!handle) return Response.json({ error: 'handle requerido' }, { status: 400 });

    const rows = await base44.asServiceRole.entities.PracticeSettings.filter({ handle });
    const practice = rows?.[0];
    // Mismo criterio que tenia la pagina: si no existe o no esta publicado, es un 404 para
    // el visitante. No se distingue entre "no existe" y "existe pero despublicado", para no
    // convertir esto en una forma de enumerar handles.
    if (!practice || practice.published === false) {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }

    const profile: Record<string, unknown> = {};
    for (const field of PUBLIC_FIELDS) {
      if (practice[field] !== undefined) profile[field] = practice[field];
    }

    return Response.json({ profile });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
