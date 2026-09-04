import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Todo lo que necesita la bandeja de Chats, resuelto por EQUIPO y no por usuario.
//
// POR QUE EXISTE: la pantalla consultaba las cinco entidades con
// `filter({ professional_id: user.id })`, pero el webhook de WhatsApp guarda todo con
// `professional_id` = el DUENO del consultorio. Un profesional invitado nunca matcheaba, asi
// que veia "No hay conversaciones todavia" para siempre, sin ningun error. Es el mismo
// patron que ya resolvieron getScopedPatients / getScopedAppointments / getScopedServices;
// la bandeja fue la unica que quedo afuera.
//
// TODO EL EQUIPO VE LA MISMA BANDEJA, a proposito. El WhatsApp es UNO SOLO por consultorio:
// un mensaje entrante no tiene forma de saber a que profesional del equipo va dirigido (no
// existe professional_ref_id en Conversation, y no podria existir: el paciente escribe al
// numero del consultorio, no al de una persona). Repartir los chats seria inventar una
// atribucion que el dato no tiene. Por eso aca NO se filtra por professional_ref_id, a
// diferencia de getScopedAppointments.
//
// Se devuelve todo junto en una sola llamada para no multiplicar los viajes al servidor: la
// pantalla se recarga entera con cada mensaje que entra (Conversation.subscribe).
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope?.practiceOwnerId) {
      // Usuario sin consultorio propio ni invitacion aceptada. No es un error.
      return Response.json({ conversations: [], pauses: [], templates: [], contacts: [] });
    }
    const ownerId = scope.practiceOwnerId;

    // El limite de mensajes se mantiene igual al que tenia la pantalla (800), para no
    // cambiar el comportamiento ni el peso de la respuesta.
    const [conversations, pauses, templates, ownTemplates, contacts] = await Promise.all([
      base44.asServiceRole.entities.Conversation.filter({ professional_id: ownerId }, '-created_date', 800),
      base44.asServiceRole.entities.ChatPause.filter({ professional_id: ownerId }),
      // Las plantillas se piden por el dueno Y por el propio usuario: la RLS de
      // MessageTemplate obliga a crearlas con professional_id = quien las crea, asi que un
      // profesional invitado guardaba plantillas con SU id y despues no le aparecian nunca
      // en el selector de respuestas rapidas (se buscaban solo por el id del dueno).
      base44.asServiceRole.entities.MessageTemplate.filter({ professional_id: ownerId }),
      ownerId === user.id
        ? Promise.resolve([])
        : base44.asServiceRole.entities.MessageTemplate.filter({ professional_id: user.id }),
      base44.asServiceRole.entities.WhatsAppContact.filter({ professional_id: ownerId }),
    ]);

    // Union sin duplicados por id (el dueno matchea las dos consultas cuando ownerId = user.id).
    const templatesById = new Map();
    for (const t of [...(templates || []), ...(ownTemplates || [])]) {
      if (t?.id && !templatesById.has(t.id)) templatesById.set(t.id, t);
    }

    return Response.json({
      conversations: conversations || [],
      pauses: pauses || [],
      templates: [...templatesById.values()],
      contacts: contacts || [],
      isOwner: scope.isOwner,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
