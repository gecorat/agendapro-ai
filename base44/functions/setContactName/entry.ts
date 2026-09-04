import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';
import { rememberWhatsAppContact } from '../../shared/whatsapp-contacts.ts';
import { canonicalPhone } from '../../shared/phone-utils.ts';
import { findPracticeRowsByOwner, ownerIdOf } from "../../shared/ownership.ts";

// Renombrar un contacto de la bandeja de Chats a mano.
//
// POR QUE UNA FUNCION Y NO ESCRIBIR LA ENTIDAD DESDE EL FRONT: la fila de WhatsAppContact
// se guarda con `professional_id` = el dueno del consultorio, y la regla de creacion de la
// entidad solo permite crear filas propias. Un profesional invitado no podria crear la fila
// la primera vez que renombra un contacto. Aca se resuelve el alcance igual que en el resto
// de la app y se escribe con permisos de servicio.
//
// El nombre se guarda con origen "manual", que es el mas fuerte: ninguna sincronizacion de
// contactos ni ningun mensaje entrante lo pisa despues (ver shared/whatsapp-contacts.ts).
// Mandar el nombre vacio borra el nombre manual y deja que vuelva a mandar el de WhatsApp.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const phone = String(body?.phone || '');
    const name = String(body?.name || '').trim().slice(0, 120);
    const key = canonicalPhone(phone);
    if (!key) return Response.json({ error: 'phone requerido' }, { status: 400 });

    // Dueno primero, invitado despues: mismo criterio que getMyPractice.
    let practice = (await findPracticeRowsByOwner(base44, user.id))?.[0] || null;
    if (!practice) {
      const scope = await resolveScope(base44, user);
      if (scope?.practiceOwnerId) {
        practice = (await findPracticeRowsByOwner(base44, scope.practiceOwnerId))?.[0] || null;
      }
    }
    if (!practice) return Response.json({ error: 'no_practice' }, { status: 404 });

    const professionalId = ownerIdOf(practice);

    if (!name) {
      // Borrar el nombre manual: se baja a "profile" para que el proximo mensaje entrante o
      // la proxima sincronizacion vuelvan a poner el nombre real de WhatsApp. No se elimina
      // la fila porque la plataforma no expone borrado y dejarla vacia seria peor.
      const rows = await base44.asServiceRole.entities.WhatsAppContact.filter({ professional_id: professionalId, phone: key });
      if (rows?.[0]) {
        await base44.asServiceRole.entities.WhatsAppContact.update(rows[0].id, { source: 'profile', synced_at: new Date().toISOString() });
      }
      return Response.json({ ok: true, cleared: true });
    }

    await rememberWhatsAppContact(base44, { professionalId, phone, name, source: 'manual' });
    return Response.json({ ok: true, name });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
