import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Check } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { PROFESSIONAL_TYPES, getTypeLabel } from "@/lib/professional-presets";
import { THEME_PRESETS, resolveTheme } from "@/lib/theme-presets";
import { useToast } from "@/components/ui/use-toast";
import PublicLinkCard from "@/components/PublicLinkCard";

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
    instagram_url: "",
    facebook_url: "",
    website_url: "",
    handle: "",
    photo_url: "",
    page_color: "#0f172a",
    theme_preset: "clean_light",
    description: "",
    published: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const cleanHandle = (form.handle || "").trim().replace(/^@/, "").replace(/\s+/g, "");
  const publicLink = cleanHandle ? (typeof window !== "undefined" ? window.location.origin : "") + `/u/${cleanHandle}` : "";

  useEffect(() => {
    if (settings) {
      setForm({
        professional_type: settings.professional_type || "dentist",
        practice_name: settings.practice_name || "",
        specialty: settings.specialty || "",
        address: settings.address || "",
        phone: settings.phone || "",
        professional_email: settings.professional_email || "",
        instagram_url: settings.instagram_url || "",
        facebook_url: settings.facebook_url || "",
        website_url: settings.website_url || "",
        handle: settings.handle || "",
        photo_url: settings.photo_url || "",
        page_color: settings.page_color || "#0f172a",
        theme_preset: settings.theme_preset || "clean_light",
        description: settings.description || "",
        published: settings.published !== false,
      });
    }
  }, [settings]);

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, photo_url: file_url }));
    } catch {
      toast({ title: "Error al subir la foto", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ ...form, handle: cleanHandle });
      await reload();
      toast({ title: "Perfil actualizado", description: "Tu página pública y términos se actualizaron." });
    } finally {
      setSaving(false);
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-heading font-semibold">Perfil del profesional</h2>
        <p className="text-sm text-muted-foreground">Así te van a ver tus pacientes en tu página de reservas.</p>
      </div>

      <Section title="Rubro" description="Define los términos y servicios sugeridos en toda la app.">
        <Select value={form.professional_type} onValueChange={(v) => set("professional_type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROFESSIONAL_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="space-y-1.5">
          <Label htmlFor="specialty" className="text-xs text-muted-foreground">Especialidad específica (opcional)</Label>
          <Input id="specialty" value={form.specialty} onChange={(e) => set("specialty", e.target.value)} placeholder="Ej. Ortodoncia, Nutrición deportiva, Barbería clásica..." />
        </div>
      </Section>

      <Section title="Identidad">
        <div className="space-y-1.5">
          <Label htmlFor="practice_name">Nombre del consultorio / profesional</Label>
          <Input id="practice_name" value={form.practice_name} onChange={(e) => set("practice_name", e.target.value)} />
        </div>

        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border bg-accent flex items-center justify-center shrink-0">
            {form.photo_url ? (
              <img src={form.photo_url} alt="perfil" className="w-full h-full object-cover" />
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-input hover:bg-accent transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {form.photo_url ? "Cambiar foto" : "Subir foto"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
          </label>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="description">Descripción / presentación</Label>
          <Textarea
            id="description"
            rows={3}
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="Contá brevemente quién sos y qué ofrecés. Esto lo ven tus pacientes en la página de reservas."
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="page_color">Tema de tu página de reservas</Label>
          <p className="text-xs text-muted-foreground mb-2">Así se va a ver /u/{cleanHandle || "tuusuario"}. Elegí un estilo con un clic.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {Object.entries(THEME_PRESETS).map(([key, preset]) => {
              const theme = key === "brand_accent" ? resolveTheme(key, form.page_color) : preset;
              const selected = form.theme_preset === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => set("theme_preset", key)}
                  className={`text-left rounded-xl border-2 overflow-hidden transition-all ${selected ? "border-primary shadow-sm" : "border-border hover:border-primary/40"}`}
                >
                  <div className="h-14 flex items-center justify-center gap-1.5" style={{ background: theme.bg }}>
                    <div className="w-5 h-5 rounded-full" style={{ background: theme.accent }} />
                    <div className="w-8 h-2.5 rounded-full" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }} />
                  </div>
                  <div className="px-2.5 py-2 bg-card">
                    <div className="flex items-center gap-1">
                      <p className="text-xs font-medium">{preset.label}</p>
                      {selected && <Check className="w-3 h-3 text-primary ml-auto" />}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {form.theme_preset === "brand_accent" && (
            <div className="flex items-center gap-2 pt-1">
              <input
                type="color"
                id="page_color"
                value={form.page_color}
                onChange={(e) => set("page_color", e.target.value)}
                className="w-10 h-9 rounded border border-input p-1 cursor-pointer"
              />
              <Input value={form.page_color} onChange={(e) => set("page_color", e.target.value)} className="flex-1 font-mono text-xs" placeholder="#0f172a" />
            </div>
          )}
        </div>
      </Section>

      <Section title="Enlace de reservas">
        <div className="space-y-1.5">
          <Label htmlFor="handle">Usuario público (@)</Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">@</span>
            <Input id="handle" value={form.handle} onChange={(e) => set("handle", e.target.value)} placeholder="drmartinez" className="flex-1" />
          </div>
          <p className="text-xs text-muted-foreground">Sin espacios ni @. Tu enlace será /u/{cleanHandle || "tuusuario"}</p>
        </div>
        {publicLink && <PublicLinkCard url={publicLink} practiceName={form.practice_name} brand={form.page_color} />}
      </Section>

      <Section title="Contacto">
        <div className="space-y-1.5">
          <Label htmlFor="address">Dirección</Label>
          <Input id="address" value={form.address} onChange={(e) => set("address", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email de contacto</Label>
            <Input id="email" type="email" value={form.professional_email} onChange={(e) => set("professional_email", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Redes y sitio web">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="instagram_url">Instagram</Label>
            <Input id="instagram_url" value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} placeholder="https://instagram.com/..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="facebook_url">Facebook</Label>
            <Input id="facebook_url" value={form.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} placeholder="https://facebook.com/..." />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="website_url">Sitio web</Label>
          <Input id="website_url" value={form.website_url} onChange={(e) => set("website_url", e.target.value)} placeholder="https://tusitio.com" />
        </div>
      </Section>

      <Section title="Publicación">
        <div className="flex items-center justify-between p-3 rounded-lg border border-border">
          <div>
            <p className="text-sm font-medium">Página pública publicada</p>
            <p className="text-xs text-muted-foreground">Si la desactivás, nadie podrá reservar por tu enlace.</p>
          </div>
          <Switch checked={form.published} onCheckedChange={(v) => set("published", v)} />
        </div>
      </Section>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Guardar perfil
      </Button>
      <p className="text-xs text-muted-foreground">
        Los servicios sugeridos para {getTypeLabel(form.professional_type).toLowerCase()} podés crearlos desde la pestaña Servicios.
      </p>
    </form>
  );
}
