import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';
import { findContacts } from '../../shared/evolution-api.ts';
import { planContactWrite } from '../../shared/whatsapp-contacts.ts';
import { canonicalPhone } from '../../shared/phone-utils.ts';
import { findPracticeRowsByOwner } from "../../shared/ownership.ts";

// Trae los nombres de contacto que WhatsApp le sincronizo a Evolution al vincular el QR, y
// los guarda para que la bandeja de Chats muestre un nombre en vez de un numero pelado.
//
// TRES DECISIONES IMPORTANTES:
//
// 1. Solo se guardan los contactos que YA tienen conversacion en la app. Importar la agenda
//    entera seria traer miles de personas que no son pacientes y que nunca escribieron
//    (verificado el 03/09: la instancia devuelve entre 1700 y 2400 contactos). Seria ruido
//    y datos personales que la app no necesita tener.
//
// 2. Las filas existentes se leen UNA sola vez, no una consulta por contacto. Con el patron
//    de "consultar y despues escribir" por cada contacto, una agenda grande daba cientos de
//    idas y vueltas seguidas y la funcion se pasaba del tiempo limite; ademas dos clicks
//    seguidos podian crear filas duplicadas porque las dos corridas leian "no existe" antes
//    de que cualquiera escribiera.
//
// 3. Puede volver vacio y eso NO es un error. WhatsApp fue restringiendo la sincronizacion
//    de la agenda del celular; hay reportes de que Evolution devuelve el nombre vacio
//    (evolution-api issue #2004). En ese caso se responde con el conteo en cero y la
//    pantalla lo explica, en vez de fallar.
//
// Solo aplica a la conexion por QR (Evolution). La API oficial de Meta no expone una lista
// de contactos: ahi el unico nombre disponible es el de perfil, que ya se guarda solo con
// cada mensaje entrante.

// Tope de escrituras por corrida. Es una red de seguridad para no pasarse del tiempo limite
// de la funcion: en la practica los chats de un consultorio son decenas, no cientos.
const MAX_WRITES = 200;

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    // Mismo criterio de alcance que el resto: dueno primero, invitado despues.
    let practice = (await findPracticeRowsByOwner(base44, user.id))?.[0] || null;
    if (!practice) {
      const scope = await resolveScope(base44, user);
      if (scope?.practiceOwnerId) {
        practice = (await findPracticeRowsByOwner(base44, scope.practiceOwnerId))?.[0] || null;
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

    // Que numeros tienen conversacion en la app, y que nombres ya teniamos guardados. Las
    // dos listas se traen de una sola vez y despues se comparan en memoria.
    const [msgs, existingRows] = await Promise.all([
      base44.asServiceRole.entities.Conversation.filter({ professional_id: professionalId }, '-created_date', 2000),
      base44.asServiceRole.entities.WhatsAppContact.filter({ professional_id: professionalId }),
    ]);

    const chatKeys = new Set();
    for (const m of msgs || []) {
      const key = canonicalPhone(m.phone);
      if (key) chatKeys.add(key);
    }

    const existingByKey = new Map();
    for (const r of existingRows || []) {
      const key = canonicalPhone(r.phone);
      if (key && !existingByKey.has(key)) existingByKey.set(key, r);
    }

    let matched = 0;
    let written = 0;
    let capped = false;
    // Un mismo numero puede venir mas de una vez en la lista de Evolution (por ejemplo con
    // y sin el 9). Se procesa una sola vez por telefono canonico.
    const done = new Set();

    for (const c of contacts) {
      const key = canonicalPhone(c.phone);
      if (!key || done.has(key) || !chatKeys.has(key)) continue;
      done.add(key);
      matched++;

      // source 'agenda': este nombre le gana al de perfil, porque es el que el profesional
      // reconoce.
      const plan = planContactWrite(existingByKey.get(key), { phone: c.phone, name: c.name, source: 'agenda' });
      if (!plan) continue;

      if (written >= MAX_WRITES) { capped = true; break; }
      written++;

      const payload = { name: plan.name, source: plan.source, synced_at: new Date().toISOString() };
      try {
        if (plan.op === 'create') {
          await base44.asServiceRole.entities.WhatsAppContact.create({ phone: key, professional_id: professionalId, ...payload });
        } else {
          await base44.asServiceRole.entities.WhatsAppContact.update(plan.id, payload);
        }
      } catch (e) {
        console.error('sync contact write error:', e?.message || e);
      }
    }

    return Response.json({
      ok: true,
      contacts_found: contacts.length,
      chats_matched: matched,
      chats_written: written,
      chats_total: chatKeys.size,
      capped,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
