import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Upload, Check, Copy, ExternalLink, Share2, Monitor, Smartphone,
  AlignLeft, AlignCenter, AlignRight, Circle, Square, Ban,
} from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { THEME_PRESETS, resolveTheme, PHOTO_FRAME_CLASS } from "@/lib/theme-presets";
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

function SegButton({ active, onClick, children, title }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium border transition-colors ${
        active ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-accent"
      }`}
    >
      {children}
    </button>
  );
}

// Simulador de la página pública en tiempo real: se recalcula en cada render a partir del
// form actual, así nunca puede quedar "pegado" mostrando un estado viejo.
function LivePreview({ form, viewport }) {
  const theme = resolveTheme(form.theme_preset, form.page_color);
  const frameClass = PHOTO_FRAME_CLASS[form.photo_frame] || PHOTO_FRAME_CLASS.circle;
  const photoJustify = form.photo_align === "left" ? "justify-start" : form.photo_align === "right" ? "justify-end" : "justify-center";
  const glassStyle = theme.glass ? { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } : {};

  return (
    <div
      className={`mx-auto rounded-2xl overflow-hidden border border-border shadow-sm transition-all duration-300 ${viewport === "mobile" ? "max-w-[300px]" : "max-w-full"}`}
    >
      <div style={{ background: theme.bg }}>
        <div
          className="h-24 relative overflow-hidden"
          style={{
            background: form.cover_image_url
              ? `url(${form.cover_image_url}) center ${form.cover_align || "center"}/cover`
              : `linear-gradient(135deg, ${theme.accent}, ${theme.accent}66)`,
          }}
        >
          {form.cover_image_url && <div className="absolute inset-0 bg-black/25" />}
        </div>
        <div className="px-5 pb-5">
          <div className={`flex ${photoJustify} -mt-9`}>
            {form.photo_url ? (
              <img
                src={form.photo_url}
                alt=""
                className={`w-16 h-16 object-cover ${frameClass} block`}
                style={{ boxShadow: `0 0 0 3px ${theme.bg}`, ...(theme.neon ? { boxShadow: `0 0 0 3px ${theme.bg}, 0 0 14px ${theme.accent}80` } : {}) }}
              />
            ) : (
              <div
                className={`w-16 h-16 flex items-center justify-center font-heading font-bold ${frameClass}`}
                style={{ background: theme.accent, color: theme.accentText, boxShadow: `0 0 0 3px ${theme.bg}` }}
              >
                {(form.practice_name || "?")[0]?.toUpperCase()}
              </div>
            )}
          </div>
          <div className={`mt-2 ${form.photo_align === "left" ? "text-left" : form.photo_align === "right" ? "text-right" : "text-center"}`}>
            <p className="text-sm font-heading font-semibold" style={{ color: theme.text }}>{form.practice_name || "Tu consultorio"}</p>
            {form.specialty && <p className="text-xs mt-0.5" style={{ color: theme.muted }}>{form.specialty}</p>}
          </div>
          <div className="flex items-center justify-center mt-3">
            <div className="inline-flex items-center gap-1 p-1 rounded-full" style={{ background: theme.chipBg }}>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: theme.accent, color: theme.accentText }}>Agendar</span>
              <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ color: theme.muted }}>Información</span>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            <div className="rounded-xl border p-3" style={{ background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
              <p className="text-xs font-medium" style={{ color: theme.text }}>Consulta</p>
              <p className="text-[10px] mt-0.5" style={{ color: theme.muted }}>30 min · $50.000</p>
            </div>
            <div className="rounded-xl border p-3" style={{ background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
              <p className="text-xs font-medium" style={{ color: theme.text }}>Primera consulta</p>
              <p className="text-[10px] mt-0.5" style={{ color: theme.muted }}>45 min</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PublicPageEditor() {
  const { settings, save, reload } = usePracticeSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({
    practice_name: "", specialty: "", description: "",
    address: "", address_city: "", address_province: "",
    address_lat: null, address_lng: null,
    instagram_url: "", facebook_url: "", website_url: "",
    handle: "", photo_url: "", cover_image_url: "",
    photo_align: "center", photo_frame: "circle", cover_align: "center",
    page_color: "#3B82F6", theme_preset: "clean_dark", published: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [viewport, setViewport] = useState("desktop");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const cleanHandle = (form.handle || "").trim().replace(/^@/, "").replace(/\s+/g, "");
  const publicLink = cleanHandle ? (typeof window !== "undefined" ? window.location.origin : "") + `/u/${cleanHandle}` : "";

  useEffect(() => {
    if (settings) {
      setForm({
        practice_name: settings.practice_name || "",
        specialty: settings.specialty || "",
        description: settings.description || "",
        address: settings.address || "",
        address_city: settings.address_city || "",
        address_province: settings.address_province || "",
        address_lat: settings.address_lat ?? null,
        address_lng: settings.address_lng ?? null,
        instagram_url: settings.instagram_url || "",
        facebook_url: settings.facebook_url || "",
        website_url: settings.website_url || "",
        handle: settings.handle || "",
        photo_url: settings.photo_url || "",
        cover_image_url: settings.cover_image_url || "",
        photo_align: settings.photo_align || "center",
        photo_frame: settings.photo_frame || "circle",
        cover_align: settings.cover_align || "center",
        page_color: settings.page_color || "#3B82F6",
        theme_preset: settings.theme_preset || "clean_dark",
        published: settings.published !== false,
      });
    }
  }, [settings]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleUpload(e, field, setLoading) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set(field, file_url);
    } catch {
      toast({ title: "Error al subir la imagen", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await save({ ...form, handle: cleanHandle });
      await reload();
      toast({ title: "Página pública actualizada" });
    } finally {
      setSaving(false);
    }
  }

  const copyLink = async () => {
    if (!publicLink) return;
    try {
      await navigator.clipboard.writeText(publicLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const shareLink = async () => {
    if (!publicLink) return;
    if (navigator.share) {
      try { await navigator.share({ title: form.practice_name || "Reservá tu turno", url: publicLink }); } catch { /* cancelado */ }
      return;
    }
    try {
      await navigator.clipboard.writeText(publicLink);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    } catch { /* noop */ }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 md:p-6 max-w-6xl mx-auto space-y-5">
      {/* Header con enlace destacado */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-heading font-semibold">Página pública</h1>
          <p className="text-sm text-muted-foreground">Personalizá cómo se ve tu página de reservas (/u/{cleanHandle || "tuusuario"})</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={copyLink} disabled={!publicLink} className="gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copiado" : "Copiar mi enlace"}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={shareLink} disabled={!publicLink} className="gap-1.5">
            <Share2 className="w-3.5 h-3.5" /> {shared ? "Copiado" : "Compartir"}
          </Button>
          <Button type="button" variant="outline" size="sm" disabled={!publicLink} className="gap-1.5" asChild>
            <a href={publicLink} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-3.5 h-3.5" /> Ver página
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Panel de control */}
        <div className="space-y-5 order-2 lg:order-1">
          <Section title="Enlace">
            <div className="space-y-1.5">
              <Label htmlFor="handle">Usuario público (@)</Label>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">@</span>
                <Input id="handle" value={form.handle} onChange={(e) => set("handle", e.target.value)} placeholder="drmartinez" className="flex-1" />
              </div>
            </div>
          </Section>

          <Section title="Tema visual">
            <div className="grid grid-cols-2 gap-2.5">
              {Object.entries(THEME_PRESETS).map(([key, preset]) => {
                const theme = resolveTheme(key, form.page_color);
                const selected = form.theme_preset === key;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set("theme_preset", key)}
                    className={`text-left rounded-xl border-2 overflow-hidden transition-all ${selected ? "border-primary shadow-sm" : "border-border hover:border-primary/40"}`}
                  >
                    <div className="h-12 flex items-center justify-center gap-1.5" style={{ background: theme.bg }}>
                      <div className="w-4 h-4 rounded-full" style={{ background: theme.accent }} />
                      <div className="w-6 h-2 rounded-full" style={{ background: theme.cardBg, border: `1px solid ${theme.cardBorder}` }} />
                    </div>
                    <div className="px-2 py-1.5 bg-card flex items-center gap-1">
                      <p className="text-[11px] font-medium">{preset.label}</p>
                      {selected && <Check className="w-3 h-3 text-primary ml-auto" />}
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="space-y-1.5 pt-1">
              <Label className="text-xs text-muted-foreground">Color primario de marca</Label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.page_color} onChange={(e) => set("page_color", e.target.value)} className="w-10 h-9 rounded border border-input p-1 cursor-pointer" />
                <Input value={form.page_color} onChange={(e) => set("page_color", e.target.value)} className="flex-1 font-mono text-xs" placeholder="#3B82F6" />
              </div>
              <p className="text-xs text-muted-foreground">Se aplica como acento en cualquier tema que elijas arriba.</p>
            </div>
          </Section>

          <Section title="Foto de perfil">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 overflow-hidden border-2 border-border bg-accent flex items-center justify-center shrink-0 ${PHOTO_FRAME_CLASS[form.photo_frame]}`}>
                {form.photo_url ? <img src={form.photo_url} alt="perfil" className="w-full h-full object-cover" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-input hover:bg-accent transition-colors">
                  {uploadingPhoto ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {form.photo_url ? "Cambiar" : "Subir"}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "photo_url", setUploadingPhoto)} disabled={uploadingPhoto} />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Alineación</Label>
                <div className="flex gap-1.5">
                  <SegButton active={form.photo_align === "left"} onClick={() => set("photo_align", "left")} title="Izquierda"><AlignLeft className="w-3.5 h-3.5" /></SegButton>
                  <SegButton active={form.photo_align === "center"} onClick={() => set("photo_align", "center")} title="Centro"><AlignCenter className="w-3.5 h-3.5" /></SegButton>
                  <SegButton active={form.photo_align === "right"} onClick={() => set("photo_align", "right")} title="Derecha"><AlignRight className="w-3.5 h-3.5" /></SegButton>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Marco</Label>
                <div className="flex gap-1.5">
                  <SegButton active={form.photo_frame === "circle"} onClick={() => set("photo_frame", "circle")} title="Círculo"><Circle className="w-3.5 h-3.5" /></SegButton>
                  <SegButton active={form.photo_frame === "rounded"} onClick={() => set("photo_frame", "rounded")} title="Cuadrado redondeado"><Square className="w-3.5 h-3.5" /></SegButton>
                  <SegButton active={form.photo_frame === "none"} onClick={() => set("photo_frame", "none")} title="Sin marco"><Ban className="w-3.5 h-3.5" /></SegButton>
                </div>
              </div>
            </div>
          </Section>

          <Section title="Portada" description="Fondo del header. Si no cargás una, se usa el degradé del tema.">
            <div className="flex items-center gap-3">
              <div className="w-20 h-12 rounded-lg overflow-hidden border-2 border-border bg-accent flex items-center justify-center shrink-0">
                {form.cover_image_url ? <img src={form.cover_image_url} alt="portada" className="w-full h-full object-cover" /> : <Upload className="w-4 h-4 text-muted-foreground" />}
              </div>
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-input hover:bg-accent transition-colors">
                  {uploadingCover ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                  {form.cover_image_url ? "Cambiar" : "Subir"}
                </span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => handleUpload(e, "cover_image_url", setUploadingCover)} disabled={uploadingCover} />
              </label>
              {form.cover_image_url && (
                <button type="button" onClick={() => set("cover_image_url", "")} className="text-xs text-muted-foreground hover:text-destructive underline">Quitar</button>
              )}
            </div>
            {form.cover_image_url && (
              <div className="space-y-1.5 pt-1">
                <Label className="text-xs text-muted-foreground">Alineación del recorte</Label>
                <div className="flex gap-1.5 max-w-[240px]">
                  <SegButton active={form.cover_align === "top"} onClick={() => set("cover_align", "top")}>Arriba</SegButton>
                  <SegButton active={form.cover_align === "center"} onClick={() => set("cover_align", "center")}>Centro</SegButton>
                  <SegButton active={form.cover_align === "bottom"} onClick={() => set("cover_align", "bottom")}>Abajo</SegButton>
                </div>
              </div>
            )}
          </Section>

          <Section title="Descripción">
            <Textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Contá brevemente quién sos y qué ofrecés." />
          </Section>

          <Section title="Dirección">
            <AddressAutocompleteInput
              value={form.address}
              onChange={(v) => set("address", v)}
              onPlaceSelect={({ address, lat, lng }) => setForm((f) => ({ ...f, address, address_lat: lat, address_lng: lng }))}
            />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Input value={form.address_city} onChange={(e) => set("address_city", e.target.value)} placeholder="Localidad" />
              <Input value={form.address_province} onChange={(e) => set("address_province", e.target.value)} placeholder="Provincia" />
            </div>
          </Section>

          <Section title="Redes y sitio web">
            <div className="grid grid-cols-2 gap-3">
              <Input value={form.instagram_url} onChange={(e) => set("instagram_url", e.target.value)} placeholder="Instagram" />
              <Input value={form.facebook_url} onChange={(e) => set("facebook_url", e.target.value)} placeholder="Facebook" />
            </div>
            <Input value={form.website_url} onChange={(e) => set("website_url", e.target.value)} placeholder="https://tusitio.com" />
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
            Guardar cambios
          </Button>
        </div>

        {/* Live preview */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-4 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Vista previa en vivo</p>
            <div className="flex items-center gap-1 p-0.5 rounded-lg bg-accent">
              <button type="button" onClick={() => setViewport("mobile")} className={`p-1.5 rounded-md ${viewport === "mobile" ? "bg-card shadow-sm" : ""}`}>
                <Smartphone className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setViewport("desktop")} className={`p-1.5 rounded-md ${viewport === "desktop" ? "bg-card shadow-sm" : ""}`}>
                <Monitor className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <LivePreview form={form} viewport={viewport} />
        </div>
      </div>
    </form>
  );
}
