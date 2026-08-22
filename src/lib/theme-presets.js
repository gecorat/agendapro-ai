// Sistema de temas de la página pública de reservas (/u/:handle) y su editor. 6 presets
// premium + 1 tema "custom" totalmente controlable. El color primario y secundario, y la
// tipografía, son universales: se aplican arriba de CUALQUIER tema (predefinido o custom).
export const THEME_PRESETS = {
  luxury_gold: {
    label: "Luxury Gold",
    description: "Negro profundo, bordes finos metalizados, sombras marcadas.",
    bg: "#0D0D0D",
    cardBg: "#1A1712",
    cardBorder: "rgba(212,175,55,0.28)",
    text: "#F5EFE0",
    muted: "#B8A98A",
    chipBg: "rgba(212,175,55,0.08)",
    glass: false,
    neon: false,
    cardClass: "shadow-2xl shadow-black/50",
    defaultFont: "serif_elegant",
  },
  glassmorphism_premium: {
    label: "Glassmorphism Premium",
    description: "Vidrio esmerilado intenso (blur-xl), tarjetas semitransparentes.",
    bg: "#0B132B",
    cardBg: "rgba(255,255,255,0.10)",
    cardBorder: "rgba(255,255,255,0.18)",
    text: "#FFFFFF",
    muted: "#C3CBEA",
    chipBg: "rgba(255,255,255,0.12)",
    glass: true,
    neon: false,
    cardClass: "backdrop-blur-xl border-white/10 shadow-xl shadow-black/30",
    defaultFont: "geometric",
  },
  warm_botanical: {
    label: "Warm Botanical",
    description: "Crema/lino cálido, tarjetas blancas bien redondeadas.",
    bg: "#F4F1EA",
    cardBg: "#FFFFFF",
    cardBorder: "#E6E0D2",
    text: "#3A362C",
    muted: "#8A8270",
    chipBg: "#8FA77C1a",
    glass: false,
    neon: false,
    cardClass: "shadow-sm rounded-3xl",
    forceRadius: "rounded-3xl",
    defaultFont: "modern_sans",
  },
  clean_dark_tech: {
    label: "Clean Dark Tech",
    description: "Grafito estilo Vercel/Linear, bordes micro-brillantes, botones neón.",
    bg: "#090D16",
    cardBg: "#12161F",
    cardBorder: "rgba(255,255,255,0.09)",
    text: "#F1F3F7",
    muted: "#8890A0",
    chipBg: "rgba(255,255,255,0.06)",
    glass: false,
    neon: true,
    cardClass: "shadow-lg shadow-black/30",
    defaultFont: "geometric",
  },
  minimal_light: {
    label: "Minimal Light",
    description: "Editorial pulcro, blanco impoluto, bordes sólidos sin sombra.",
    bg: "#FFFFFF",
    cardBg: "#FFFFFF",
    cardBorder: "#111111",
    text: "#0F172A",
    muted: "#64748B",
    chipBg: "#0F172A0D",
    glass: false,
    neon: false,
    cardClass: "",
    noShadow: true,
    defaultFont: "modern_sans",
  },
  photo_focus: {
    label: "Photo Focus",
    description: "Tu portada domina el header, con degradé que se funde con el contenido.",
    bg: "#111318",
    cardBg: "#1A1D24",
    cardBorder: "rgba(255,255,255,0.10)",
    text: "#FFFFFF",
    muted: "#C7CAD1",
    chipBg: "rgba(255,255,255,0.08)",
    glass: false,
    neon: false,
    photoFocus: true, // el header (portada) es más grande y funde con degradé hacia bg
    cardClass: "shadow-lg shadow-black/30",
    defaultFont: "editorial",
  },
  custom: {
    label: "Personalizado",
    description: "Definís vos cada cosa: fondo, redondeado, opacidad, blur.",
    bg: "#121212",
    cardBg: "#1C1C1C",
    cardBorder: "rgba(255,255,255,0.12)",
    text: "#F5F5F5",
    muted: "#A0A0A0",
    chipBg: "rgba(255,255,255,0.08)",
    glass: false,
    neon: false,
    cardClass: "",
    defaultFont: "modern_sans",
  },
};

// Tipografías premium seleccionables globalmente (anulan la fuente por defecto del tema).
export const FONT_OPTIONS = {
  serif_elegant: { label: "Serif Elegante", family: "'Playfair Display', serif", googleFont: "Playfair+Display:wght@500;600;700" },
  modern_sans: { label: "Modern Sans", family: "'Plus Jakarta Sans', sans-serif", googleFont: "Plus+Jakarta+Sans:wght@500;600;700" },
  geometric: { label: "Geométrica", family: "'Outfit', sans-serif", googleFont: "Outfit:wght@600;700" },
  editorial: { label: "Editorial", family: "'Cinzel', serif", googleFont: "Cinzel:wght@600;700" },
};

export const BORDER_RADIUS_CLASS = {
  none: "rounded-none",
  soft: "rounded-2xl",
  full: "rounded-3xl",
};

// Estima si conviene texto claro u oscuro arriba de un color de fondo.
function isLightColor(hex) {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

// Resuelve el tema final: mezcla el preset elegido con color primario/secundario
// universales, la tipografía elegida (o la default del tema), y — si es "custom" — todos
// los controles del Generador de Fondos / tarjetas.
export function resolveTheme(presetKey, pageColor, options = {}) {
  const { secondaryColor, fontOverride, custom = {} } = options;
  const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.clean_dark_tech;
  const accent = pageColor || "#3B82F6";
  const secondary = secondaryColor || accent;

  const fontKey = fontOverride && fontOverride !== "default" ? fontOverride : preset.defaultFont;
  const font = FONT_OPTIONS[fontKey];

  let cardBg = preset.cardBg;
  let cardBorder = preset.cardBorder;
  let radiusClass = preset.forceRadius || null;
  let cardClass = preset.cardClass || "";
  let glass = preset.glass;

  if (presetKey === "custom") {
    radiusClass = BORDER_RADIUS_CLASS[custom.borderRadius || "soft"];
    glass = !!custom.blurEnabled;
    const opacity = custom.cardOpacity ?? 100;
    cardBg = hexToRgba(preset.cardBg, opacity / 100);
    cardClass = glass ? "backdrop-blur-md border-white/10 shadow-lg" : "shadow-md";
  }

  return {
    ...preset,
    accent,
    secondary,
    accentText: isLightColor(accent) ? "#0F172A" : "#FFFFFF",
    cardBorderNeon: preset.neon ? `${accent}55` : cardBorder,
    neonGlow: preset.neon ? `0 0 0 1px ${accent}55, 0 0 18px ${accent}80, 0 0 40px ${accent}30` : undefined,
    headingFont: font?.family || null,
    googleFont: font?.googleFont || null,
    cardBg,
    cardBorder,
    radiusClass,
    cardClass,
    glass,
  };
}

function hexToRgba(hex, alpha) {
  if (!hex || hex.startsWith("rgba") || hex.startsWith("rgb(")) return hex;
  if (hex.startsWith("rgba(") || hex.length < 7) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return hex;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Patrones de fondo del Generador de Fondos (tema Personalizado), 100% CSS, sin assets
// externos. "nature" usa tonos verdes fijos (motivo orgánico); el resto sigue el color
// primario/secundario elegido para integrarse con la marca.
export function getBackgroundPatternStyle(pattern, primary, secondary) {
  const sec = secondary || primary;
  switch (pattern) {
    case "nature":
      return {
        backgroundColor: "#1b2318",
        backgroundImage: `
          radial-gradient(circle at 12% 18%, #6b8e5a66 0%, transparent 32%),
          radial-gradient(circle at 88% 12%, #8fa77c55 0%, transparent 38%),
          radial-gradient(circle at 45% 78%, #4a5d3a66 0%, transparent 42%),
          radial-gradient(circle at 92% 88%, #a3b58955 0%, transparent 34%)`,
      };
    case "waves":
      return {
        backgroundColor: "#0f1115",
        backgroundImage: `repeating-linear-gradient(135deg, ${primary}26 0px, ${primary}26 2px, transparent 2px, transparent 42px), repeating-linear-gradient(45deg, ${sec}1f 0px, ${sec}1f 2px, transparent 2px, transparent 42px)`,
      };
    case "mesh":
      return {
        backgroundColor: "#0d0f14",
        backgroundImage: `
          radial-gradient(at 20% 30%, ${primary}70 0px, transparent 50%),
          radial-gradient(at 80% 20%, ${sec}70 0px, transparent 50%),
          radial-gradient(at 40% 85%, ${primary}55 0px, transparent 50%),
          radial-gradient(at 92% 92%, ${sec}55 0px, transparent 50%)`,
      };
    case "gradient":
      return { backgroundImage: `linear-gradient(135deg, ${primary}, ${sec})` };
    default:
      return {};
  }
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

export const PHOTO_FRAME_CLASS = {
  circle: "rounded-full",
  rounded: "rounded-2xl",
};

export const PHOTO_ALIGN_CLASS = {
  left: "mr-auto ml-0 items-start text-left",
  center: "mx-auto items-center text-center",
  right: "ml-auto mr-0 items-end text-right",
};
