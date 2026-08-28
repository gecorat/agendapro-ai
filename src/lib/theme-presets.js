// Sistema de temas de la página pública de reservas (/u/:handle) y su editor.
// 8 presets full-width cerrados (reemplaza el sistema anterior de 6 temas + "Personalizado"
// con opacidad/blur/patrones de fondo). Cada preset trae su propio color de acento,
// tipografía y radio de botones por defecto; el color de acento y la tipografía se pueden
// afinar desde "Personalización fina" (page_color / heading_font_override), y el radio de
// botones desde custom_border_radius. Todo lo demás (opacidad de tarjetas, blur manual,
// marcos de foto, generador de patrones) se eliminó: cada preset ya viene resuelto.
export const THEME_PRESETS = {
  botanical_wave: {
    label: "Botanical Wave",
    description: "Verde salvia claro, cabecera curva. Nutrición, psicología, spas.",
    bg: "#F4F6F0",
    cardBg: "#FFFFFF",
    cardBorder: "#E2E7DC",
    text: "#1C2A23",
    muted: "#5A6B60",
    chipBg: "#2D4A3E14",
    accent: "#2D4A3E",
    glass: false,
    neon: false,
    curved: true,
    cardClass: "shadow-sm",
    forceRadius: "full",
    defaultFont: "modern_sans",
    swatches: ["#2D4A3E", "#6B8F71", "#A8C3A0", "#C5A059", "#8C6D62"],
  },
  oled_obsidian: {
    label: "OLED Obsidian",
    description: "Negro puro, líneas finas. Tech, barberías, DJs.",
    bg: "#000000",
    cardBg: "#0A0A0A",
    cardBorder: "#27272A",
    text: "#FFFFFF",
    muted: "#A1A1AA",
    chipBg: "#FFFFFF0D",
    accent: "#10B981",
    glass: false,
    neon: true,
    curved: false,
    cardClass: "shadow-lg shadow-black/40",
    forceRadius: "none",
    defaultFont: "geometric",
    swatches: ["#10B981", "#3B82F6", "#A78BFA", "#F472B6", "#F4F4F5"],
  },
  editorial_luxe: {
    label: "Editorial Luxe",
    description: "Serif de alto impacto, marfil cálido. Médicos estéticos, boutique.",
    bg: "#FAF8F5",
    cardBg: "#FFFFFF",
    cardBorder: "#EFECE6",
    text: "#1A1817",
    muted: "#706C68",
    chipBg: "#C5A05914",
    accent: "#C5A059",
    accentText: "#1A1817",
    glass: false,
    neon: false,
    curved: false,
    cardClass: "shadow-sm",
    forceRadius: "none",
    defaultFont: "serif_elegant",
    swatches: ["#C5A059", "#1A1817", "#706C68", "#8C7A5B", "#EFECE6"],
  },
  warm_terracotta: {
    label: "Warm Terracotta",
    description: "Cálido y humano. Fotógrafos, diseñadores, coaches.",
    bg: "#FDF6F0",
    cardBg: "#FFFFFF",
    cardBorder: "#F3E2D4",
    text: "#3D261D",
    muted: "#8C6D62",
    chipBg: "#D96B4314",
    accent: "#D96B43",
    glass: false,
    neon: false,
    curved: false,
    cardClass: "shadow-sm",
    forceRadius: "soft",
    defaultFont: "modern_sans",
    swatches: ["#D96B43", "#3D261D", "#E8A87C", "#8C6D62", "#F3E2D4"],
  },
  corporate_glass: {
    label: "Corporate Glass",
    description: "Degradé azul marino, tarjetas de vidrio. Contadores, consultoras.",
    bg: "linear-gradient(180deg, #0F172A 0%, #1E293B 100%)",
    cardBg: "rgba(30,41,59,0.7)",
    cardBorder: "rgba(255,255,255,0.1)",
    text: "#F8FAFC",
    muted: "#94A3B8",
    chipBg: "#FFFFFF14",
    accent: "#38BDF8",
    glass: true,
    neon: false,
    curved: false,
    cardClass: "backdrop-blur-xl shadow-xl shadow-black/30",
    forceRadius: "soft",
    defaultFont: "geometric_dm",
    swatches: ["#38BDF8", "#818CF8", "#F8FAFC", "#94A3B8", "#0EA5E9"],
  },
  minimal_high_fashion: {
    label: "Minimal High-Fashion",
    description: "Alto contraste, blanco absoluto. Modelos, arquitectos, trainers.",
    bg: "#FFFFFF",
    cardBg: "#FAFAFA",
    cardBorder: "#E5E5E5",
    text: "#000000",
    muted: "#666666",
    chipBg: "#0000000D",
    accent: "#000000",
    glass: false,
    neon: false,
    curved: false,
    cardClass: "",
    noShadow: true,
    forceRadius: "none",
    defaultFont: "display_syne",
    swatches: ["#000000", "#666666", "#E5E5E5", "#FAFAFA", "#999999"],
  },
  nordic_slate: {
    label: "Nordic Slate",
    description: "Gris pizarra frío, pulcro. Odontología, fisioterapia, salud.",
    bg: "#EBEEF1",
    cardBg: "#FFFFFF",
    cardBorder: "#CBD5E1",
    text: "#1E293B",
    muted: "#64748B",
    chipBg: "#0EA5E914",
    accent: "#0EA5E9",
    glass: false,
    neon: false,
    curved: false,
    cardClass: "shadow-sm",
    forceRadius: "soft",
    defaultFont: "modern_sans_inter",
    swatches: ["#0EA5E9", "#1E293B", "#64748B", "#CBD5E1", "#7DD3FC"],
  },
  executive_gold: {
    label: "Executive Gold",
    description: "Azul marino profundo, dorado metálico. Finanzas, real estate VIP.",
    bg: "#0A111E",
    cardBg: "#111C2E",
    cardBorder: "#1E2D4A",
    text: "#F8FAFC",
    muted: "#94A3B8",
    chipBg: "#FFFFFF0D",
    accent: "#E2C044",
    accentGradient: "linear-gradient(135deg, #E2C044 0%, #B8860B 100%)",
    glass: false,
    neon: false,
    curved: false,
    cardClass: "shadow-lg shadow-black/40",
    forceRadius: "none",
    defaultFont: "editorial",
    swatches: ["#E2C044", "#B8860B", "#F8FAFC", "#94A3B8", "#1E2D4A"],
  },
};

// Mapa de compatibilidad: los 7 valores viejos (temas anteriores al rediseño de 8 presets)
// se resuelven al preset nuevo más parecido, así ninguna página existente rompe.
const LEGACY_THEME_MAP = {
  luxury_gold: "executive_gold",
  glassmorphism_premium: "corporate_glass",
  warm_botanical: "botanical_wave",
  clean_dark_tech: "oled_obsidian",
  minimal_light: "minimal_high_fashion",
  photo_focus: "warm_terracotta",
  custom: "nordic_slate",
};

// Tipografías premium seleccionables globalmente (anulan la fuente por defecto del tema).
export const FONT_OPTIONS = {
  serif_elegant: { label: "Serif Elegante", family: "'Playfair Display', serif", googleFont: "Playfair+Display:wght@500;600;700" },
  modern_sans: { label: "Sans Moderna", family: "'Plus Jakarta Sans', sans-serif", googleFont: "Plus+Jakarta+Sans:wght@400;500;700" },
  geometric: { label: "Geométrica", family: "'Space Grotesk', sans-serif", googleFont: "Space+Grotesk:wght@500;600;700" },
  editorial: { label: "Editorial", family: "'Cinzel', serif", googleFont: "Cinzel:wght@500;600;700" },
  // Fuentes "internas" de ciertos presets (no aparecen como opción manual en el selector,
  // solo se usan como defaultFont de su tema, pero viven acá para que loadThemeFont las cargue).
  geometric_dm: { label: "DM Sans", family: "'DM Sans', sans-serif", googleFont: "DM+Sans:wght@400;500;700" },
  display_syne: { label: "Syne", family: "'Syne', sans-serif", googleFont: "Syne:wght@600;700" },
  modern_sans_inter: { label: "Inter", family: "'Inter', sans-serif", googleFont: "Inter:wght@400;500;600" },
};

// Las 4 opciones que ve el usuario en "Tipografía de encabezado" (Personalización fina).
export const HEADING_FONT_CHOICES = ["serif_elegant", "modern_sans", "geometric", "editorial"];

export const BORDER_RADIUS_CLASS = {
  none: "rounded-none",
  soft: "rounded-xl",
  full: "rounded-full",
};
export const BORDER_RADIUS_PX = { none: 0, soft: 12, full: 999 };

// Estima si conviene texto claro u oscuro arriba de un color de fondo.
function isLightColor(hex) {
  if (!hex || hex.length < 7 || !hex.startsWith("#")) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function resolvePresetKey(key) {
  if (key && THEME_PRESETS[key]) return key;
  if (key && LEGACY_THEME_MAP[key]) return LEGACY_THEME_MAP[key];
  return "nordic_slate";
}

// Resuelve el tema final: preset (con su acento/tipografía/radio propios) + los overrides
// opcionales de "Personalización fina": color de acento (pageColor), tipografía de
// encabezado (fontOverride), radio de BOTONES (custom.borderRadius) y radio del AVATAR
// (custom.avatarBorderRadius) — dos controles independientes: antes un único radio
// gobernaba tanto los botones como la forma del avatar. "auto" en cualquiera de los dos
// = heredar el radio propio del preset.
export function resolveTheme(presetKey, pageColor, options = {}) {
  const { fontOverride, custom = {} } = options;
  const key = resolvePresetKey(presetKey);
  const preset = THEME_PRESETS[key];

  const hasCustomAccent = !!pageColor;
  const accent = pageColor || preset.accent;
  // El degradé propio del preset (ej. dorado de Executive Gold) solo se usa si el usuario
  // no eligió un color de acento manual — un hex simple siempre gana.
  const accentCss = !hasCustomAccent && preset.accentGradient ? preset.accentGradient : accent;

  const fontKey = fontOverride && fontOverride !== "default" ? fontOverride : preset.defaultFont;
  const font = FONT_OPTIONS[fontKey];

  let radiusKey = preset.forceRadius || "soft";
  if (custom.borderRadius && custom.borderRadius !== "auto") {
    radiusKey = custom.borderRadius;
  }
  const radiusClass = BORDER_RADIUS_CLASS[radiusKey] || BORDER_RADIUS_CLASS.soft;
  const radiusPx = BORDER_RADIUS_PX[radiusKey] ?? 12;

  let avatarRadiusKey = preset.forceRadius || "soft";
  if (custom.avatarBorderRadius && custom.avatarBorderRadius !== "auto") {
    avatarRadiusKey = custom.avatarBorderRadius;
  }
  const avatarRadiusClass = BORDER_RADIUS_CLASS[avatarRadiusKey] || BORDER_RADIUS_CLASS.soft;
  const avatarRadiusPx = BORDER_RADIUS_PX[avatarRadiusKey] ?? 12;

  const isDark = isLightColor(preset.text);

  return {
    key,
    label: preset.label,
    bg: preset.bg,
    cardBg: preset.cardBg,
    cardBorder: preset.cardBorder,
    text: preset.text,
    muted: preset.muted,
    chipBg: preset.chipBg,
    glass: preset.glass,
    neon: preset.neon,
    curved: preset.curved,
    noShadow: preset.noShadow,
    cardClass: preset.cardClass || "",
    secondary: accent,
    accent,
    accentCss,
    accentText: preset.accentText || (isLightColor(accent) ? "#0F172A" : "#FFFFFF"),
    cardBorderNeon: preset.neon ? `${accent}55` : preset.cardBorder,
    neonGlow: preset.neon ? `0 0 0 1px ${accent}55, 0 0 18px ${accent}80, 0 0 40px ${accent}30` : undefined,
    headingFont: font?.family || null,
    googleFont: font?.googleFont || null,
    radiusClass,
    radiusPx,
    avatarRadiusClass,
    avatarRadiusPx,
    isDark,
  };
}

// Forma del avatar. Recibe theme.avatarRadiusClass (radio independiente del de los
// botones desde el rediseño de Personalización fina — antes reemplazaba el viejo
// selector manual de "marco" reusando el radio de los botones).
export function avatarShapeClass(radiusClass) {
  if (radiusClass === "rounded-full") return "rounded-full";
  if (radiusClass === "rounded-none") return "rounded-none";
  return "rounded-2xl";
}

// Carga dinámicamente la fuente de Google que haga falta (una sola vez por fuente).
const loadedFonts = new Set();
export function loadThemeFont(googleFont) {
  if (!googleFont || typeof document === "undefined" || loadedFonts.has(googleFont)) return;
  loadedFonts.add(googleFont);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?family=${googleFont}&display=swap`;
  document.head.appendChild(link);
}

// Datos como "Gecorat" (sin protocolo, cargados como handle suelto) son comunes porque el
// campo históricamente se llenaba a mano. Esto arma un link real usable sin romper lo que
// la gente ya cargó.
export function normalizeSocialUrl(value, platform) {
  if (!value) return "";
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const handle = trimmed.replace(/^@/, "");
  if (platform === "instagram") return `https://instagram.com/${handle}`;
  if (platform === "facebook") return `https://facebook.com/${handle}`;
  return `https://${trimmed}`;
}

export function whatsappUrl(phone, message) {
  const digits = (phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return `https://wa.me/${digits}${message ? `?text=${encodeURIComponent(message)}` : ""}`;
}

export function googleMapsUrl(address, city, province) {
  const full = [address, city, province].filter(Boolean).join(", ");
  if (!full) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(full)}`;
}

// Para el iframe embebido sin API Key. Combinar localidad/provincia mejora muchísimo la
// precisión cuando no hay lat/lng exactas (una calle sola puede existir en varias
// ciudades y Google termina adivinando cualquier lugar).
export function googleMapsEmbedSrc({ address, city, province, lat, lng }) {
  if (lat && lng) return `https://maps.google.com/maps?q=${lat},${lng}&z=16&output=embed`;
  const full = [address, city, province].filter(Boolean).join(", ");
  if (!full) return "";
  return `https://maps.google.com/maps?q=${encodeURIComponent(full)}&z=15&output=embed`;
}
