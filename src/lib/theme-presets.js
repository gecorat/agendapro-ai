// Presets de tema visual para la página pública de reservas (/u/:handle) y el editor de
// personalización. El color de marca (page_color) es un acento UNIVERSAL: se aplica arriba
// de cualquiera de los temas — esa es la "variedad de tono" dentro de cada estilo. Cada
// tema además trae su propia tipografía de encabezado (headingFont) para que se sientan
// realmente distintos entre sí, no solo un cambio de color.
export const THEME_PRESETS = {
  clean_dark: {
    label: "Clean Dark",
    description: "Azul marino prolijo, tarjetas planas con borde sutil.",
    bg: "#0B132B",
    cardBg: "#1C2541",
    cardBorder: "rgba(255,255,255,0.10)",
    text: "#F4F6FA",
    muted: "#9AA5C9",
    chipBg: "rgba(255,255,255,0.08)",
    glass: false,
    neon: false,
    cardClass: "shadow-lg shadow-black/20",
    headingFont: null, // tipografía por defecto de la app
    googleFont: null,
  },
  glassmorphism: {
    label: "Glassmorphism",
    description: "Vidrio esmerilado real (backdrop-blur), tipografía geométrica moderna.",
    bg: "#0B132B",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.15)",
    text: "#FFFFFF",
    muted: "#C3CBEA",
    chipBg: "rgba(255,255,255,0.10)",
    glass: true,
    neon: false,
    cardClass: "backdrop-blur-md border-white/10 shadow-xl shadow-black/30",
    headingFont: "'Outfit', sans-serif",
    googleFont: "Outfit:wght@600;700",
  },
  minimal_light: {
    label: "Minimal Light",
    description: "Blanco impoluto, tipografía oscura de alto contraste.",
    bg: "#F8FAFC",
    cardBg: "#FFFFFF",
    cardBorder: "#E2E8F0",
    text: "#0F172A",
    muted: "#64748B",
    chipBg: "#0F172A0D",
    glass: false,
    neon: false,
    cardClass: "shadow-sm",
    headingFont: null,
    googleFont: null,
  },
  neon_accent: {
    label: "Neon Accent",
    description: "Oscuro profundo, brillos neón y tipografía técnica.",
    bg: "#0B0F1A",
    cardBg: "#141B2E",
    cardBorder: "rgba(255,255,255,0.08)",
    text: "#F0FFFC",
    muted: "#8BA3A0",
    chipBg: "rgba(255,255,255,0.06)",
    glass: false,
    neon: true,
    cardClass: "",
    headingFont: "'Space Grotesk', sans-serif",
    googleFont: "Space+Grotesk:wght@600;700",
  },
  sage_botanical: {
    label: "Sage Botanical",
    description: "Verde salvia y crema, cálido y orgánico. Serif suave en el nombre.",
    bg: "#EEF1E7",
    cardBg: "#FFFFFF",
    cardBorder: "#DCE3D3",
    text: "#33402E",
    muted: "#748268",
    chipBg: "#8FA77C1a",
    glass: false,
    neon: false,
    cardClass: "shadow-sm",
    headingFont: "'Fraunces', serif",
    googleFont: "Fraunces:opsz,wght@9..144,500;9..144,600",
  },
  luxury_gold: {
    label: "Luxury Gold",
    description: "Negro y dorado, elegante. Serif editorial en el nombre.",
    bg: "#0E0E0E",
    cardBg: "#1A1712",
    cardBorder: "rgba(212,175,55,0.25)",
    text: "#F5EFE0",
    muted: "#B8A98A",
    chipBg: "rgba(212,175,55,0.08)",
    glass: false,
    neon: false,
    cardClass: "shadow-lg shadow-black/40",
    headingFont: "'Playfair Display', serif",
    googleFont: "Playfair+Display:wght@600;700",
  },
  photo_backdrop: {
    label: "Photo Backdrop",
    description: "Tu portada como fondo de toda la página, panel de vidrio encima.",
    bg: "#111318",
    cardBg: "rgba(17,19,24,0.55)",
    cardBorder: "rgba(255,255,255,0.18)",
    text: "#FFFFFF",
    muted: "#E2E4EA",
    chipBg: "rgba(255,255,255,0.12)",
    glass: true,
    neon: false,
    photoBackdrop: true, // si hay portada cargada, cubre TODA la página (no solo el header)
    cardClass: "backdrop-blur-lg border-white/15 shadow-2xl shadow-black/50",
    headingFont: "'Cormorant Garamond', serif",
    googleFont: "Cormorant+Garamond:wght@600;700",
  },
};

// Estima si conviene texto claro u oscuro arriba de un color de fondo, para accentText.
function isLightColor(hex) {
  if (!hex || hex.length < 7) return false;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 150;
}

export function resolveTheme(presetKey, pageColor) {
  const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.clean_dark;
  const accent = pageColor || "#3B82F6";
  return {
    ...preset,
    accent,
    accentText: isLightColor(accent) ? "#0F172A" : "#FFFFFF",
    cardBorderNeon: preset.neon ? `${accent}55` : preset.cardBorder,
    // Sombra de brillo real para Neon Accent (botones primarios y tarjeta seleccionada).
    neonGlow: preset.neon ? `0 0 0 1px ${accent}55, 0 0 18px ${accent}80, 0 0 40px ${accent}30` : undefined,
  };
}

// Carga dinámicamente la fuente de Google que necesite el tema activo (una sola vez por
// fuente). Evita cargar las 7 fuentes siempre — solo la que realmente se está usando.
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
