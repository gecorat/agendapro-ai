import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';
import { resolveScope } from '../../shared/team-scope.ts';

// Trae SOLO los horarios del consultorio del usuario actual. Antes el editor de horarios
// llamaba Availability.filter({}) directo -- sin ningun campo que diga a que consultorio
// pertenece cada franja, esto traia los horarios de TODA la app mezclados entre si.
// Confirmado en vivo: una cuenta de prueba mostraba horarios duplicados e inconsistentes
// acumulados de sesiones de prueba anteriores, de otras cuentas.
//
// ADOPCION DE FRANJAS HUERFANAS
// El campo practice_owner_id se agrego DESPUES de que ya habia horarios cargados, y esas
// filas viejas nunca se migraron. Como todas las lecturas filtran por ese campo, quedaron
// invisibles: el bot y la pagina publica no las ven, y scheduling.ts cae a su horario por
// defecto (lunes a viernes 09:00-18:00 corrido, sin almuerzo). Confirmado en vivo el
// 31/08: un consultorio con 12 franjas cargadas (martes a viernes, con pausa de almuerzo)
// estaba recibiendo turnos los lunes y en pleno mediodia.
//
// Peor todavia: AvailabilityEditor siembra el horario estandar cuando esta funcion no
// devuelve nada ("primera vez"), asi que abrir la pantalla de Horarios le creaba encima un
// L-V 09:00-18:00 nuevo, tapando el horario real que seguia invisible abajo.
//
// Por eso, antes de responder, adoptamos las franjas huerfanas del propio consultorio:
// filas sin practice_owner_id cuyo created_by_id es el dueno de esta cuenta. Es
// determinista (no adivina nada: solo completa el dato que falta con quien la creo), no
// borra nada, y ademas corta el sembrado automatico, porque la lista ya deja de venir
// vacia.
async function adoptOrphanRows(base44, practiceOwnerId) {
  try {
    const mine = await base44.asServiceRole.entities.Availability.filter({ created_by_id: practiceOwnerId });
    const orphans = (mine || []).filter((row) => !row.practice_owner_id);
    if (orphans.length === 0) return [];
    const adopted = [];
    for (const row of orphans) {
      try {
        adopted.push(await base44.asServiceRole.entities.Availability.update(row.id, { practice_owner_id: practiceOwnerId }));
      } catch (e) {
        console.error('adoptOrphanRows update error:', row.id, e?.message || e);
      }
    }
    return adopted;
  } catch (e) {
    // Si la adopcion falla, seguimos con lo que ya estaba etiquetado: nunca puede romper
    // la lectura de horarios.
    console.error('adoptOrphanRows error:', e?.message || e);
    return [];
  }
}

export default async function (req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const scope = await resolveScope(base44, user);
    if (!scope) return Response.json({ availability: [] });

    await adoptOrphanRows(base44, scope.practiceOwnerId);

    const all = await base44.asServiceRole.entities.Availability.filter({ practice_owner_id: scope.practiceOwnerId });
    return Response.json({ availability: all || [] });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
