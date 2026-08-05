import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Check } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { PROFESSIONAL_TYPES, getTypeLabel } from "@/lib/professional-presets";
import { useToast } from "@/components/ui/use-toast";

export default function PracticeProfileSection() {
  const { settings, save, reload } = usePracticeSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({
    professional_type: "dentist",
    practice_name: "",
    specialty: "",
    address: "",
    phone: "",
    professional_email: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        professional_type: settings.professional_type || "dentist",
        practice_name: settings.practice_name || "",
        specialty: settings.specialty || "",
        address: settings.address || "",
        phone: settings.phone || "",
        professional_email: settings.professional_email || "",
      });
    }
  }, [settings]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await save(form);
      await reload();
      toast({ title: "Perfil actualizado", description: "Los términos de la app se actualizaron." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-heading font-semibold">Perfil del profesional</h2>
        <p className="text-sm text-muted-foreground">Tu especialidad define los términos y servicios sugeridos.</p>
      </div>

      <div className="space-y-2">
        <Label>Especialidad</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROFESSIONAL_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm({ ...form, professional_type: t.value })}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                form.professional_type === t.value
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t.label}</span>
                {form.professional_type === t.value && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="practice_name">Nombre del consultorio / profesional</Label>
        <Input
          id="practice_name"
          value={form.practice_name}
          onChange={(e) => setForm({ ...form, practice_name: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="specialty">Especialidad</Label>
        <Input
          id="specialty"
          value={form.specialty}
          onChange={(e) => setForm({ ...form, specialty: e.target.value })}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Input
          id="address"
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email de contacto</Label>
          <Input
            id="email"
            type="email"
            value={form.professional_email}
            onChange={(e) => setForm({ ...form, professional_email: e.target.value })}
          />
        </div>
      </div>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Guardar perfil
      </Button>
      <p className="text-xs text-muted-foreground">
        Al cambiar la especialidad, los términos de la interfaz se adaptan. Los servicios
        sugeridos para {getTypeLabel(form.professional_type).toLowerCase()} podés crearlos desde la pestaña Servicios.
      </p>
    </form>
  );
}