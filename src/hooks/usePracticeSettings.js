import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { getPreset, getTypeLabel } from "@/lib/professional-presets";

export function usePracticeSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const me = await base44.auth.me();
      const list = await base44.entities.PracticeSettings.list();
      setSettings(list?.find((r) => r.created_by_id === me.id) || null);
    } catch {
      setSettings(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const preset = settings ? getPreset(settings.professional_type) : getPreset("other");
  const typeLabel = settings ? getTypeLabel(settings.professional_type) : "";

  async function save(data) {
    if (settings) {
      const updated = await base44.entities.PracticeSettings.update(settings.id, data);
      setSettings(updated);
      return updated;
    }
    const created = await base44.entities.PracticeSettings.create(data);
    setSettings(created);
    return created;
  }

  return { settings, loading, preset, typeLabel, reload: load, save };
}