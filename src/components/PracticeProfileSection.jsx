import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, KeyRound, ExternalLink } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { PROFESSIONAL_TYPES, getTypeLabel } from "@/lib/professional-presets";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";

function Section({ title, description, children }) {
  return (
    <div className="space-y-3 pb-5 border-b border-border last:border-b-0 last:pb-0">
      <div>
        <p className="text-sm font-heading font-semibold">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// "Mi perfil" es exclusivamente cuenta/identidad del profesional (nombre, contacto,
// contraseña, rubro del negocio). Todo lo que tiene que ver con CÓMO se ve tu página
// pública (foto, portada, tema, colores, enlace, dirección mostrada, redes) se movió a
// "Página pública" — antes vivía todo mezclado acá mismo.
export default function PracticeProfileSection() {
  const { settings, save, reload } = usePracticeSettings();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    professional_type: "dentist",
    practice_name: "",
    phone: "",
    professional_email: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (settings) {
      setForm({
        professional_type: settings.professional_type || "dentist",
        practice_name: settings.practice_name || "",
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
      toast({ title: "Perfil actualizado" });
    } finally {
      setSaving(false);
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-heading font-semibold">Mi perfil</h2>
        <p className="text-sm text-muted-foreground">Tus datos personales y de cuenta. Para la estética de tu página de reservas, andá a "Página pública" en el menú.</p>
      </div>

      <Section title="Identidad">
        <div className="space-y-1.5">
          <Label htmlFor="practice_name">Nombre</Label>
          <Input id="practice_name" value={form.practice_name} onChange={(e) => set("practice_name", e.target.value)} placeholder="Ej. Dr. Juan Pérez" />
        </div>
        <Select value={form.professional_type} onValueChange={(v) => set("professional_type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROFESSIONAL_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground -mt-1">Define los términos y servicios sugeridos en toda la app.</p>
      </Section>

      <Section title="Contacto">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.professional_email} onChange={(e) => set("professional_email", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Cuenta" description="Login y seguridad.">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Email de acceso</Label>
          <Input value={user?.email || ""} disabled className="bg-muted/50" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() => window.open("https://base44.com/account/security", "_blank")}
        >
          <KeyRound className="w-4 h-4" /> Cambiar contraseña <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </Section>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Guardar
      </Button>
      <p className="text-xs text-muted-foreground">
        Servicios sugeridos para {getTypeLabel(form.professional_type).toLowerCase()} disponibles en la pestaña Servicios.
      </p>
    </form>
  );
}
