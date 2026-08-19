import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getPreset, getTypeLabel } from "@/lib/professional-presets";

export function usePracticeSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      const list = await base44.entities.PracticeSettings.filter(
        { created_by_id: me.id },
        "-created_date",
        1
      );
      setSettings(list?.[0] || null);
    } catch (e) {
      setSettings(null);
    } finally {
      setLoading(false);
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

  async function save(data) {
    // PracticeSettings.update/create ya no se puede llamar directo desde el cliente (RLS
    // restringida a admins) — esta función de backend filtra qué campos se pueden tocar.
    const res = await base44.functions.invoke("savePracticeSettings", { data });
    const updated = res?.data?.settings;
    setSettings(updated);
    return updated;
  }

  return { settings, loading, preset, typeLabel, reload: load, save };
}