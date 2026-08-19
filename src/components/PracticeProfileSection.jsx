import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Upload, Check, Copy, ExternalLink, Share2 } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { PROFESSIONAL_TYPES, getTypeLabel } from "@/lib/professional-presets";
import { THEME_PRESETS, resolveTheme } from "@/lib/theme-presets";
import { useToast } from "@/components/ui/use-toast";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";

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

// Preview real del header de la página pública, calculado en cada render a partir del
// estado actual del formulario — por eso nunca puede "quedarse pegado" en un tema viejo.
function HeaderPreview({ form }) {
  const theme = resolveTheme(form.theme_preset, form.page_color);
  return (
    <div className="rounded-2xl overflow-hidden border border-border">
      <div
        className="h-20 relative flex items-end justify-center pb-0"
        style={{
          background: form.cover_image_url ? `url(${form.cover_image_url}) center/cover` : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}99)`,
        }}
      >
        {form.cover_image_url && <div className="absolute inset-0 bg-black/20" />}
      </div>
      <div className="px-4 pb-4 text-center -mt-8" style={{ background: theme.bg }}>
        {form.photo_url ? (
          <img src={form.photo_url} alt="" className="w-16 h-16 rounded-full object-cover mx-auto block" style={{ boxShadow: `0 0 0 3px ${theme.bg}` }} />
        ) : (
          <div className="w-16 h-16 rounded-full mx-auto flex items-center justify-center font-heading font-bold" style={{ background: theme.accent, color: theme.accentText, boxShadow: `0 0 0 3px ${theme.bg}` }}>
            {(form.practice_name || "?")[0]?.toUpperCase()}
          </div>
        )}
        <p className="text-sm font-heading font-semibold mt-2" style={{ color: theme.text }}>{form.practice_name || "Tu consultorio"}</p>
        {form.specialty && <p className="text-xs mt-0.5" style={{ color: theme.muted }}>{form.specialty}</p>}
        <div className="inline-flex items-center gap-1 mt-2.5 p-1 rounded-full" style={{ background: theme.chipBg || `${theme.text}0d` }}>
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: theme.accent, color: theme.accentText }}>Agendar</span>
          <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ color: theme.muted }}>Información</span>
        </div>
      </div>
    </div>
  );
}

// Tarjeta neutra (no usa el color/tema elegido, para no confundirse con la vista previa
// de arriba): usuario público + link + acciones, todo en un mismo bloque.
function BookingLinkCard({ handle, onChangeHandle, url, practiceName }) {
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const share = async () => {
    if (!url) return;
    if (navigator.share) {
      try { await navigator.share({ title: practiceName || "Reservá tu turno", text: "Reservá tu turno online:", url }); } catch { /* cancelado */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="p-4 space-y-1.5">
        <Label htmlFor="handle">Usuario público (@)</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">@</span>
          <Input id="handle" value={handle} onChange={(e) => onChangeHandle(e.target.value)} placeholder="drmartinez" className="flex-1" />
        </div>
        <p className="text-xs text-muted-foreground">Sin espacios ni @. Este es tu link para compartir con pacientes.</p>
      </div>
      {url && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border">
          <div className="bg-muted/60 rounded-xl px-3 py-2.5 overflow-x-auto">
            <p className="font-mono text-xs whitespace-nowrap text-foreground/80">{url}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <Button type="button" variant="outline" size="sm" onClick={copy} className="rounded-xl gap-1.5">
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copiado" : "Copiar"}
            </Button>
            <Button type="button" variant="outline" size="sm" className="rounded-xl gap-1.5" asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3.5 h-3.5" /> Ver
              </a>
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={share} className="rounded-xl gap-1.5">
              <Share2 className="w-3.5 h-3.5" /> {shared ? "Copiado" : "Compartir"}
            </Button>
          </div>
        </div>
      )}
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
    address_city: "",
    address_province: "",
    address_lat: null,
    address_lng: null,
    phone: "",
    professional_email: "",
    instagram_url: "",
    facebook_url: "",
    website_url: "",
    handle: "",
    photo_url: "",
    cover_image_url: "",
    page_color: "#0f172a",
    theme_preset: "clean_light",
    description: "",
    published: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);

  const cleanHandle = (form.handle || "").trim().replace(/^@/, "").replace(/\s+/g, "");
  const publicLink = cleanHandle ? (typeof window !== "undefined" ? window.location.origin : "") + `/u/${cleanHandle}` : "";

  useEffect(() => {
    if (settings) {
      setForm({
        professional_type: settings.professional_type || "dentist",
        practice_name: settings.practice_name || "",
        specialty: settings.specialty || "",
        address: settings.address || "",
        address_city: settings.address_city || "",
        address_province: settings.address_province || "",
        address_lat: settings.address_lat ?? null,
        address_lng: settings.address_lng ?? null,
        phone: settings.phone || "",
        professional_email: settings.professional_email || "",
        instagram_url: settings.instagram_url || "",
        facebook_url: settings.facebook_url || "",
        website_url: settings.website_url || "",
        handle: settings.handle || "",
        photo_url: settings.photo_url || "",
        cover_image_url: settings.cover_image_url || "",
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

  async function handleCover(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, cover_image_url: file_url }));
    } catch {
      toast({ title: "Error al subir la portada", variant: "destructive" });
    } finally {
      setUploadingCover(false);
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

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Foto de perfil</Label>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-border bg-accent flex items-center justify-center shrink-0">
              {form.photo_url ? <img src={form.photo_url} alt="perfil" className="w-full h-full object-cover" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-input hover:bg-accent transition-colors">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {form.photo_url ? "Cambiar foto" : "Subir foto"}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
            </label>
          </div>
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
      </Section>

      <Section title="Tema de tu página de reservas" description="Elegí un estilo con un clic — así se va a ver /u/tuusuario.">
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
            <input type="color" value={form.page_color} onChange={(e) => set("page_color", e.target.value)} className="w-10 h-9 rounded border border-input p-1 cursor-pointer" />
            <Input value={form.page_color} onChange={(e) => set("page_color", e.target.value)} className="flex-1 font-mono text-xs" placeholder="#0f172a" />
          </div>
        )}

        <div className="space-y-1.5 pt-1">
          <Label className="text-xs text-muted-foreground">Portada personalizada (opcional)</Label>
          <p className="text-xs text-muted-foreground">Reemplaza el color de fondo del header en cualquier tema que elijas arriba.</p>
          <div className="flex items-center gap-3 pt-1">
            <div className="w-20 h-12 rounded-lg overflow-hidden border-2 border-border bg-accent flex items-center justify-center shrink-0">
              {form.cover_image_url ? <img src={form.cover_image_url} alt="portada" className="w-full h-full object-cover" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
            </div>
            <label className="cursor-pointer">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-input hover:bg-accent transition-colors">
                {uploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {form.cover_image_url ? "Cambiar portada" : "Subir portada"}
              </span>
              <input type="file" accept="image/*" className="hidden" onChange={handleCover} disabled={uploadingCover} />
            </label>
            {form.cover_image_url && (
              <button type="button" onClick={() => set("cover_image_url", "")} className="text-xs text-muted-foreground hover:text-destructive underline">
                Quitar
              </button>
            )}
          </div>
        </div>

        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-1.5">Así se ve ahora mismo:</p>
          <HeaderPreview form={form} />
        </div>
      </Section>

      <Section title="Enlace de reservas">
        <BookingLinkCard
          handle={form.handle}
          onChangeHandle={(v) => set("handle", v)}
          url={publicLink}
          practiceName={form.practice_name}
        />
      </Section>

      <Section title="Contacto">
        <div className="space-y-1.5">
          <Label htmlFor="address">Dirección</Label>
          <AddressAutocompleteInput
            id="address"
            value={form.address}
            onChange={(v) => set("address", v)}
            onPlaceSelect={({ address, lat, lng }) => setForm((f) => ({ ...f, address, address_lat: lat, address_lng: lng }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="address_city">Localidad</Label>
            <Input id="address_city" value={form.address_city} onChange={(e) => set("address_city", e.target.value)} placeholder="Ej. Villa Carlos Paz" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="address_province">Provincia</Label>
            <Input id="address_province" value={form.address_province} onChange={(e) => set("address_province", e.target.value)} placeholder="Ej. Córdoba" />
          </div>
        </div>
        <p className="text-xs text-muted-foreground -mt-1">Ayuda a que el mapa de tu página pública ubique el lugar correcto, sobre todo si todavía no cargaste la búsqueda automática de dirección.</p>
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
