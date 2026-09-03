import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';
import { findContacts } from '../../shared/evolution-api.ts';
import { rememberWhatsAppContact } from '../../shared/whatsapp-contacts.ts';

// Trae los nombres de contacto que WhatsApp le sincronizo a Evolution al vincular el QR, y
// los guarda para que la bandeja de Chats muestre un nombre en vez de un numero pelado.
//
// DOS DECISIONES IMPORTANTES:
//
// 1. Solo se guardan los contactos que YA tienen conversacion en la app. Importar la agenda
//    entera seria traer cientos de personas que no son pacientes y que nunca escribieron —
//    ruido y datos personales que la app no necesita tener.
//
// 2. Puede volver vacio y eso NO es un error. WhatsApp fue restringiendo la sincronizacion
//    de la agenda del celular; hay reportes de que Evolution devuelve el nombre vacio
//    (evolution-api issue #2004). En ese caso se responde con el conteo en cero y la
//    pantalla lo explica, en vez de fallar.
//
// Solo aplica a la conexion por QR (Evolution). La API oficial de Meta no expone una lista
// de contactos: ahi el unico nombre disponible es el de perfil, que ya se guarda solo con
// cada mensaje entrante.
export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Mismo criterio de alcance que el resto: dueno primero, invitado despues.
    let practice = (await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: user.id }))?.[0] || null;
    if (!practice) {
      const scope = await resolveScope(base44, user);
      if (scope?.practiceOwnerId) {
        practice = (await base44.asServiceRole.entities.PracticeSettings.filter({ created_by_id: scope.practiceOwnerId }))?.[0] || null;
      }
    }
    if (!practice) return Response.json({ error: 'no_practice' }, { status: 404 });

    if (practice.whatsapp_connection_type !== 'qr' || !practice.evolution_instance_name) {
      return Response.json(
        { error: 'no_disponible', message: 'La sincronización de contactos solo funciona con WhatsApp conectado por QR.' },
        { status: 400 }
      );
    }
    if (!practice.whatsapp_connected) {
      return Response.json(
        { error: 'desconectado', message: 'Conectá WhatsApp antes de sincronizar los contactos.' },
        { status: 400 }
      );
    }

    const cfg = (await base44.asServiceRole.entities.PlatformConfig.filter({}))?.[0];
    const baseUrl = (cfg?.evolution_base_url || '').replace(/\/$/, '');
    const apiKey = cfg?.evolution_api_key;
    if (!baseUrl || !apiKey) return Response.json({ error: 'Evolution API no está configurada.' }, { status: 500 });

    const professionalId = practice.created_by_id;

    let contacts = [];
    try {
      contacts = await findContacts(baseUrl, apiKey, practice.evolution_instance_name);
    } catch (e) {
      console.error('findContacts error:', e?.message || e);
      return Response.json(
        { error: 'evolution_error', message: 'No se pudo consultar los contactos de WhatsApp. Probá de nuevo en un rato.' },
        { status: 502 }
      );
    }

    // Que numeros tienen conversacion en la app. Se comparan por los ultimos 10 digitos,
    // igual que en el resto de la app, porque el mismo numero puede estar guardado con o
    // sin el 54 y el 9 segun de donde haya salido la fila.
    const canonical = (p) => {
      const d = String(p || '').replace(/[^0-9]/g, '');
      return d.length <= 10 ? d : d.slice(-10);
    };
    const msgs = await base44.asServiceRole.entities.Conversation.filter({ professional_id: professionalId }, '-created_date', 2000);
    const known = new Map();
    for (const m of msgs || []) {
      const key = canonical(m.phone);
      if (key && !known.has(key)) known.set(key, m.phone);
    }

    let matched = 0;
    for (const c of contacts) {
      const key = canonical(c.phone);
      if (!key || !known.has(key)) continue;
      matched++;
      // source 'agenda': este nombre le gana al de perfil, porque es el que el profesional
      // reconoce. rememberWhatsAppContact se encarga de no duplicar filas.
      await rememberWhatsAppContact(base44, { professionalId, phone: c.phone, name: c.name, source: 'agenda' });
    }

    return Response.json({
      ok: true,
      contacts_found: contacts.length,
      chats_matched: matched,
      chats_total: known.size,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
