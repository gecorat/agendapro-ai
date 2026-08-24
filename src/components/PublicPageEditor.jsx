import React, { useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Upload, Check, Copy, ExternalLink, Share2, Monitor, Smartphone,
  AlignLeft, AlignCenter, PanelTop, Circle, Square, MapPin, PenLine,
} from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import {
  THEME_PRESETS, FONT_OPTIONS, HEADING_FONT_CHOICES, resolveTheme, avatarShapeClass,
  loadThemeFont,
} from "@/lib/theme-presets";
import { useToast } from "@/components/ui/use-toast";
import { Link } from "react-router-dom";

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

// Simulador en tiempo real: se recalcula en cada render a partir del form actual, así
// nunca puede quedar "pegado" mostrando un estado viejo. Foto con position:absolute +
// z-index alto (no se corta). La forma del avatar sale del radio del tema (ya no hay
// selector manual de "marco").
function LivePreview({ form, viewport }) {
  const theme = resolveTheme(form.theme_preset, form.page_color, {
    fontOverride: form.heading_font_override,
    custom: { borderRadius: form.custom_border_radius },
  });
  const frameClass = avatarShapeClass(theme.radiusClass);
  const isBanner = form.photo_align === "banner";
  const photoJustify = form.photo_align === "left" ? "justify-start" : "justify-center";
  const glassStyle = theme.glass ? { backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)" } : {};
  const cardClass = `${theme.cardClass || ""} ${theme.radiusClass || "rounded-xl"}`;
  const size = 64;
  const half = size / 2;
  const coverHeight = isBanner ? "h-32" : "h-24";
  const photoTop = isBanner ? 128 : 96;
  const headingFontStyle = theme.headingFont ? { fontFamily: theme.headingFont } : {};

  useEffect(() => {
    if (theme.googleFont) loadThemeFont(theme.googleFont);
  }, [theme.googleFont]);

  return (
    <div className={`mx-auto rounded-2xl overflow-hidden border border-border shadow-sm transition-all duration-300 relative ${viewport === "mobile" ? "max-w-[300px]" : "max-w-full"}`}>
      <div className="relative" style={{ background: theme.bg }}>
        <div className="relative">
          <div className="relative" style={{ overflow: "visible" }}>
            <div
              className={`overflow-hidden ${coverHeight}`}
              style={{
                background: form.cover_image_url
                  ? `url(${form.cover_image_url}) center ${form.cover_align || "center"}/cover`
                  : `linear-gradient(135deg, ${theme.accentCss}, ${theme.accent}66)`,
              }}
            >
              {form.cover_image_url && <div className="absolute inset-0" style={{ background: "rgba(0,0,0,0.25)" }} />}
            </div>
            <div className={`absolute left-0 right-0 px-5 flex z-20 ${photoJustify}`} style={{ top: `${photoTop - half}px` }}>
              {form.photo_url ? (
                <img
                  src={form.photo_url}
                  alt=""
                  className={`object-cover block ${frameClass}`}
                  style={{ width: size, height: size, boxShadow: theme.neon ? `0 0 0 3px ${theme.bg}, 0 0 14px ${theme.accent}80` : `0 0 0 3px ${theme.bg}` }}
                />
              ) : (
                <div
                  className={`flex items-center justify-center font-heading font-bold ${frameClass}`}
                  style={{ width: size, height: size, background: theme.accentCss, color: theme.accentText, boxShadow: `0 0 0 3px ${theme.bg}` }}
                >
                  {(form.practice_name || "?")[0]?.toUpperCase()}
                </div>
              )}
            </div>
          </div>
          <div className="px-5 pb-5" style={{ paddingTop: `${half + 8}px` }}>
            <div className={form.photo_align === "left" ? "text-left" : "text-center"}>
              <p className="text-base font-heading font-bold" style={{ color: theme.text, ...headingFontStyle }}>{form.practice_name || "Tu consultorio"}</p>
              {form.specialty && <p className="text-xs mt-0.5" style={{ color: theme.muted }}>{form.specialty}</p>}
            </div>
            <div className="flex items-center justify-center gap-1.5 mt-3">
              <span className={`px-3 py-1 text-xs font-semibold ${theme.radiusClass === "rounded-none" ? "rounded-none" : "rounded-full"}`} style={{ background: theme.accentCss, color: theme.accentText, boxShadow: theme.neon ? theme.neonGlow : undefined }}>Agendar cita</span>
              <span className={`px-3 py-1 text-xs font-medium border ${theme.radiusClass === "rounded-none" ? "rounded-none" : "rounded-full"}`} style={{ color: theme.muted, borderColor: theme.cardBorder }}>Información</span>
            </div>

            <div className="mt-4 space-y-2">
              <div className={`border p-3 ${cardClass}`} style={{ background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
                <p className="text-xs font-medium" style={{ color: theme.text }}>Consulta</p>
                <p className="text-[10px] mt-0.5" style={{ color: theme.muted }}>30 min · $50.000</p>
              </div>
              <div className={`border p-3 ${cardClass}`} style={{ background: theme.cardBg, borderColor: theme.cardBorder, ...glassStyle }}>
                <p className="text-xs font-medium" style={{ color: theme.text }}>Primera consulta</p>
                <p className="text-[10px] mt-0.5" style={{ color: theme.muted }}>45 min</p>
              </div>
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
    instagram_url: "", facebook_url: "", website_url: "",
    handle: "", photo_url: "", cover_image_url: "",
    photo_align: "center", photo_frame: "circle", cover_align: "center",
    page_color: "", theme_preset: "nordic_slate",
    heading_font_override: "default", published: true,
    custom_bg_pattern: "none", custom_bg_image_url: "", custom_bg_overlay_opacity: 40,
    custom_border_radius: "auto", custom_card_opacity: 100, custom_blur_enabled: false,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [viewport, setViewport] = useState("desktop");
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const cleanHandle = (form.handle || "").trim().replace(/^@/, "").replace(/\s+/g, "");
  const publicLink = cleanHandle ? (typeof window !== "undefined" ? window.location.origin : "") + `/u/${cleanHandle}` : "";

  // Se sincroniza el form desde `settings` UNA SOLA VEZ (la primera vez que llegan datos
  // reales). Antes se resincronizaba cada vez que `settings` cambiaba de referencia — y
  // como el hook de settings se refresca solo al volver a la pestaña (útil en general,
  // pero acá no), abrir el selector de archivos para subir una imagen (que le saca el foco
  // a la ventana y se lo devuelve al cerrar) disparaba ese refresh y te pisaba el tema
  // recién elegido sin guardar. Ahora un refresh de fondo nunca te borra ediciones en curso.
  const didInitialSync = useRef(false);
  useEffect(() => {
    if (settings && !didInitialSync.current) {
      didInitialSync.current = true;
      // Cuentas que se guardaron antes del rediseño de 8 presets quedaron con
      // theme_preset en una clave vieja y custom_border_radius="soft" escrito en
      // silencio (era el default oculto de la versión anterior, no una elección real).
      // Si detectamos esa combinación, la tratamos como "auto" (heredar el radio propio
      // del preset nuevo) en vez de forzar 12px sobre los 8 temas. Si el radio guardado
      // es "none"/"full", o el tema ya es una clave nueva, se respeta tal cual: ahí sí es
      // una elección explícita del usuario.
      const isLegacyThemeKey = settings.theme_preset && !THEME_PRESETS[settings.theme_preset];
      const rawRadius = settings.custom_border_radius;
      const resolvedRadius = !rawRadius || (isLegacyThemeKey && rawRadius === "soft") ? "auto" : rawRadius;

      setForm({
        practice_name: settings.practice_name || "",
        specialty: settings.specialty || "",
        description: settings.description || "",
        instagram_url: settings.instagram_url || "",
        facebook_url: settings.facebook_url || "",
        website_url: settings.website_url || "",
        handle: settings.handle || "",
        photo_url: settings.photo_url || "",
        cover_image_url: settings.cover_image_url || "",
        photo_align: settings.photo_align === "right" ? "center" : (settings.photo_align || "center"),
        photo_frame: settings.photo_frame || "circle",
        cover_align: settings.cover_align || "center",
        page_color: settings.page_color || "",
        theme_preset: settings.theme_preset || "nordic_slate",
        heading_font_override: settings.heading_font_override || "default",
        published: settings.published !== false,
        custom_bg_pattern: settings.custom_bg_pattern || "none",
        custom_bg_image_url: settings.custom_bg_image_url || "",
        custom_bg_overlay_opacity: settings.custom_bg_overlay_opacity ?? 40,
        custom_border_radius: resolvedRadius,
        custom_card_opacity: settings.custom_card_opacity ?? 100,
        custom_blur_enabled: !!settings.custom_blur_enabled,
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
    // Estructura de 2 columnas INDEPENDIENTES: el contenedor raíz no scrollea nunca
    // (h-full). Cada columna maneja su propio scroll por separado. El scroll fantasma de
    // toda la página (sidebar incluido) se resolvió aparte, en AppLayout.jsx.
    // Techo duro independiente de la cadena de ancestros: h-full/min-h-0 depende de que
    // CADA nivel de arriba (incluido TrialBanner, que es hermano en flujo normal, no
    // flex, dentro de <main>) esté perfectamente medido. maxHeight:100vh + overflow:hidden
    // acá directamente en el estilo es un tope físico: pase lo que pase arriba, esta
    // pantalla nunca puede superar un viewport de alto.
    <div className="h-full overflow-hidden flex flex-col" style={{ maxHeight: "100vh" }}>
      <div className="shrink-0 border-b border-border px-4 md:px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 bg-background">
        <div>
          <h1 className="text-lg font-heading font-semibold">Página pública</h1>
          <p className="text-xs text-muted-foreground">/u/{cleanHandle || "tuusuario"}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button type="button" variant="outline" size="sm" onClick={copyLink} disabled={!publicLink} className="gap-1.5">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copiado" : "Copiar enlace"}
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

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row">
        {/* Columna Izquierda: Panel de configuración — única que scrollea */}
        <div className="w-full lg:w-[55%] overflow-y-auto px-4 md:px-6 py-5 pb-16">
          <form onSubmit={handleSubmit} className="space-y-5 max-w-2xl">
            <Section title="Enlace">
              <div className="space-y-1.5">
                <Label htmlFor="handle">Usuario público (@)</Label>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground text-sm">@</span>
                  <Input id="handle" value={form.handle} onChange={(e) => set("handle", e.target.value)} placeholder="drmartinez" className="flex-1" />
                </div>
              </div>
            </Section>

            <Section title="Tema visual" description="8 presets full-width cerrados. Cada uno trae su propio color, tipografía y radio de botones — se pueden afinar abajo.">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(THEME_PRESETS).map(([key, preset]) => {
                  const theme = resolveTheme(key, null);
                  const selected = form.theme_preset === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => set("theme_preset", key)}
                      className={`text-left rounded-xl border-2 overflow-hidden transition-all ${selected ? "border-primary shadow-sm" : "border-border hover:border-primary/40"}`}
                      style={selected && theme.neon ? { boxShadow: theme.neonGlow } : undefined}
                    >
                      <div className="h-14 flex flex-col items-center justify-center gap-1.5 relative" style={{ background: theme.bg }}>
                        <div
                          className={theme.radiusClass === "rounded-full" ? "rounded-full" : theme.radiusClass === "rounded-none" ? "rounded-none" : "rounded-lg"}
                          style={{ width: 18, height: 18, background: theme.accentCss, boxShadow: theme.neon ? `0 0 8px ${theme.accent}` : undefined }}
                        />
                        <div className="w-10 h-1.5 rounded-full" style={{ background: theme.text, opacity: 0.7 }} />
                        {selected && (
                          <div className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                            <Check className="w-2.5 h-2.5 text-primary-foreground" strokeWidth={3} />
                          </div>
                        )}
                      </div>
                      <div className="px-2 py-1.5 bg-card">
                        <p className="text-[11px] font-semibold leading-tight">{preset.label}</p>
                        <p className="text-[9.5px] text-muted-foreground leading-tight mt-0.5">{preset.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>

            <Section title="Personalización fina" description="Opcional: afiná el color de acento, la tipografía de encabezado y el radio de los botones por arriba del preset elegido.">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Color de acento</Label>
                <div className="flex items-center gap-2">
                  <input type="color" value={form.page_color || THEME_PRESETS[form.theme_preset]?.accent || "#3B82F6"} onChange={(e) => set("page_color", e.target.value)} className="w-9 h-9 rounded border border-input p-1 cursor-pointer shrink-0" />
                  <Input value={form.page_color} onChange={(e) => set("page_color", e.target.value)} className="flex-1 font-mono text-xs" placeholder={THEME_PRESETS[form.theme_preset]?.accent || "Del tema"} />
                  {form.page_color && (
                    <button type="button" onClick={() => set("page_color", "")} className="text-xs text-muted-foreground hover:text-destructive underline shrink-0">Quitar</button>
                  )}
                </div>
                <div className="flex items-center gap-1.5 pt-0.5">
                  {(THEME_PRESETS[form.theme_preset]?.swatches || []).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("page_color", c)}
                      title={c}
                      className={`w-6 h-6 rounded-full border-2 transition-transform ${form.page_color === c ? "border-primary scale-110" : "border-border"}`}
                      style={{ background: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-muted-foreground">Estilo de botones</Label>
                <div className="flex gap-1.5">
                  <SegButton active={form.custom_border_radius === "auto"} onClick={() => set("custom_border_radius", "auto")}>Del tema</SegButton>
                  <SegButton active={form.custom_border_radius === "none"} onClick={() => set("custom_border_radius", "none")}><Square className="w-3.5 h-3.5" /> Recto</SegButton>
                  <SegButton active={form.custom_border_radius === "soft"} onClick={() => set("custom_border_radius", "soft")}><Square className="w-3.5 h-3.5 rounded" /> Suave</SegButton>
                  <SegButton active={form.custom_border_radius === "full"} onClick={() => set("custom_border_radius", "full")}><Circle className="w-3.5 h-3.5" /> Píldora</SegButton>
                </div>
              </div>

              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-muted-foreground">Tipografía de encabezado</Label>
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => set("heading_font_override", "default")} className={`text-xs py-2 rounded-lg border ${form.heading_font_override === "default" ? "border-primary bg-primary/5 font-medium" : "border-border text-muted-foreground"}`}>
                    Del tema
                  </button>
                  {HEADING_FONT_CHOICES.map((key) => {
                    const f = FONT_OPTIONS[key];
                    return (
                      <button key={key} type="button" onClick={() => set("heading_font_override", key)} className={`text-xs py-2 rounded-lg border ${form.heading_font_override === key ? "border-primary bg-primary/5 font-medium" : "border-border text-muted-foreground"}`} style={{ fontFamily: f.family }}>
                      {f.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </Section>

            <Section title="Foto de perfil">
              <div className="flex items-center gap-3">
                <div className={`w-14 h-14 overflow-hidden border-2 border-border bg-accent flex items-center justify-center shrink-0 ${avatarShapeClass(resolveTheme(form.theme_preset, form.page_color, { custom: { borderRadius: form.custom_border_radius } }).radiusClass)}`}>
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
              <p className="text-xs text-muted-foreground pt-1">Sin foto se muestra la inicial del nombre. La forma (círculo / cuadrado / recto) la define el tema elegido arriba.</p>
              <div className="space-y-1.5 pt-2">
                <Label className="text-xs text-muted-foreground">Alineación</Label>
                <div className="flex gap-1.5">
                  <SegButton active={form.photo_align === "left"} onClick={() => set("photo_align", "left")} title="Izquierda"><AlignLeft className="w-3.5 h-3.5" /> Izquierda</SegButton>
                  <SegButton active={form.photo_align === "center"} onClick={() => set("photo_align", "center")} title="Centrado"><AlignCenter className="w-3.5 h-3.5" /> Centrado</SegButton>
                  <SegButton active={form.photo_align === "banner"} onClick={() => set("photo_align", "banner")} title="Banner Top"><PanelTop className="w-3.5 h-3.5" /> Banner Top</SegButton>
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

            <Section title="Dirección" description="Se edita desde tu Perfil — acá solo la ves reflejada, para que esté siempre igual en la página pública y en los mensajes del bot.">
              {settings?.address || settings?.address_city ? (
                <div className="flex items-start gap-2.5 rounded-lg border border-border p-3">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm">{[settings.address, settings.address_city, settings.address_province].filter(Boolean).join(', ')}</p>
                  </div>
                  <Button type="button" variant="ghost" size="sm" className="ml-auto shrink-0 gap-1 h-7" asChild>
                    <Link to="/settings?tab=profile"><PenLine className="w-3.5 h-3.5" /> Editar</Link>
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-lg border border-dashed border-border p-3">
                  <MapPin className="w-4 h-4 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground flex-1">Todavía no cargaste una dirección.</p>
                  <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1 h-7" asChild>
                    <Link to="/settings?tab=profile"><PenLine className="w-3.5 h-3.5" /> Cargarla</Link>
                  </Button>
                </div>
              )}
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
          </form>
        </div>

        {/* Columna Derecha: Live Preview — fija, sin scroll propio, siempre 100% visible */}
        <div className="hidden lg:flex lg:w-[45%] flex-col items-center justify-center border-l border-border bg-muted/20 px-6 py-6 shrink-0">
          <div className="w-full max-w-sm space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted-foreground">Vista previa en vivo</p>
              <div className="flex items-center gap-1 p-0.5 rounded-lg bg-background">
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
      </div>
    </div>
  );
}
