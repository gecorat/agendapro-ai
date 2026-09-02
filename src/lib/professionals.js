import { base44 } from "@/api/base44Client";

// Profesionales del consultorio del usuario logueado.
//
// NO usar `base44.entities.Professional.filter(...)` desde el cliente para esto. La entidad
// Professional tiene lectura publica (rls read: {}), asi que un filter sin scope devuelve
// los profesionales de TODOS los consultorios de la plataforma, no los propios.
//
// Confirmado en vivo el 02/09: en la Agenda de una cuenta aparecia un profesional llamado
// "Juan Carlos Chupapi" que pertenecia a OTRO consultorio. El mismo problema estaba en el
// formulario de turnos, en los chips de Servicios y de Horarios, y en el contador de
// "profesionales incluidos" del plan (que contaba los de toda la plataforma).
//
// getScopedProfessionals resuelve el consultorio del usuario con resolveScope y devuelve
// solo los suyos.
export async function fetchScopedProfessionals({ activeOnly = true } = {}) {
  const res = await base44.functions.invoke("getScopedProfessionals", {});
  const list = res?.data?.professionals || [];
  // activeOnly replica el `filter({ active: true })` que hacian estas pantallas: los
  // inactivos y las invitaciones pendientes (que nacen con active: false) no se ofrecen
  // como opcion para agendar.
  //
  // Para CONTAR profesionales del plan va activeOnly: false, porque inviteProfessional
  // decide el adicional pago con el total de fichas del consultorio, sin mirar active.
  return activeOnly ? list.filter((p) => p.active !== false) : list;
}
