import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getPreset, getTypeLabel } from "@/lib/professional-presets";

export function usePracticeSettings() {
  const [settings, setSettings] = useState(null);
  const [professional, setProfessional] = useState(null); // no-null = soy un invitado, este es mi propio registro
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (attempt = 1) => {
    try {
      const me = await base44.auth.me();
      const list = await base44.entities.PracticeSettings.filter(
        { created_by_id: me.id },
        "-created_date",
        1
      );
      let resolved = list?.[0] || null;
      let myProfessional = null;

      // Si no soy dueño de ningún consultorio, puede ser que me hayan invitado a formar
      // parte del equipo de otro (plan Clinic) — en ese caso mi propio Professional.user_id
      // me asocia al consultorio del que soy invitado, y ESE es el que tengo que cargar.
      if (!resolved) {
        const profs = await base44.entities.Professional.filter({ user_id: me.id });
        myProfessional = profs?.[0] || null;
        if (myProfessional) {
          const ownerList = await base44.entities.PracticeSettings.filter(
            { created_by_id: myProfessional.practice_owner_id },
            "-created_date",
            1
          );
          resolved = ownerList?.[0] || null;
        }
      }

      setSettings(resolved);
      setProfessional(myProfessional);
      setLoading(false);
    } catch (e) {
      // Antes esto tragaba el error en silencio y dejaba "settings" en null para
      // siempre, sin loguear nada — confirmado en vivo con dos llamados independientes a
      // este mismo hook en la misma sesión (uno en AppLayout, otro en la página): uno
      // resolvió bien y el otro quedó pegado sin ninguna pista de por qué. Ahora se ve el
      // error real en consola, y se reintenta automáticamente una vez (con una pequeña
      // espera) antes de rendirse — cubre fallas transitorias de red/timing sin dejar a
      // nadie mirando una pantalla en blanco para siempre.
      console.error(`[usePracticeSettings] intento ${attempt} falló:`, e);
      if (attempt < 2) {
        setTimeout(() => load(attempt + 1), 1000);
      } else {
        setSettings(null);
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // El plan puede cambiar desde el panel de Admin mientras el profesional ya tiene la
  // sesión abierta (no hay una fuente de datos en tiempo real). Sin esto, alguien podía
  // quedar viendo "Trial" en pantalla durante horas después de que un admin lo pasara a
  // Pro, hasta que cerrara sesión o recargara a mano. Al volver a la pestaña, refrescamos.
  useEffect(() => {
    function onFocus() {
      if (document.visibilityState === "visible") load();
    }
    document.addEventListener("visibilitychange", onFocus);
    window.addEventListener("focus", onFocus);
    return () => {
      document.removeEventListener("visibilitychange", onFocus);
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const preset = settings ? getPreset(settings.professional_type) : getPreset("other");
  const typeLabel = settings ? getTypeLabel(settings.professional_type) : "";

  // isTeamAdmin: profesional invitado promovido a co-admin, ve y gestiona todo el
  // consultorio como el dueno, pero nunca toca facturacion/plan (eso es exclusivo del
  // dueno real, sin excepciones).
  const isTeamAdmin = !!professional?.is_team_admin;
  const isOwner = !professional;
  const canManageBilling = isOwner;

  async function save(data) {
    // PracticeSettings.update/create ya no se puede llamar directo desde el cliente (RLS
    // restringida a admins) — esta función de backend filtra qué campos se pueden tocar.
    // Un profesional invitado no puede llamar esto (no es dueño del consultorio).
    const res = await base44.functions.invoke("savePracticeSettings", { data });
    const updated = res?.data?.settings;
    setSettings(updated);
    return updated;
  }

  return {
    settings, loading, preset, typeLabel, reload: load, save, professional,
    isInvitedProfessional: !!professional,
    isTeamAdmin,
    isOwner,
    canManageBilling,
    // Un profesional invitado ve el menu restringido SALVO que sea co-admin, en cuyo
    // caso ve todo como el dueno (menos Plan/facturacion).
    hasFullAccess: isOwner || isTeamAdmin,
  };
}
