// Presets de tema visual para la página pública de reservas (/u/:handle) y el editor de
// personalización. El color de marca (page_color) ahora es un acento UNIVERSAL: se aplica
// arriba de cualquiera de los 4 temas (antes, el color solo se usaba en un tema específico
// llamado "brand_accent" — ahora todo tema respeta tu color elegido).
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
  },
  glassmorphism: {
    label: "Glassmorphism",
    description: "Vidrio esmerilado real (backdrop-blur), bordes translucidos.",
    bg: "#0B132B",
    cardBg: "rgba(255,255,255,0.06)",
    cardBorder: "rgba(255,255,255,0.15)",
    text: "#FFFFFF",
    muted: "#C3CBEA",
    chipBg: "rgba(255,255,255,0.10)",
    glass: true,
    neon: false,
    cardClass: "backdrop-blur-md border-white/10 shadow-xl shadow-black/30",
  },
  minimal_light: {
    label: "Minimal Light",
    description: "Blanco impoluto, tipografia oscura de alto contraste.",
    bg: "#F8FAFC",
    cardBg: "#FFFFFF",
    cardBorder: "#E2E8F0",
    text: "#0F172A",
    muted: "#64748B",
    chipBg: "#0F172A0D",
    glass: false,
    neon: false,
    cardClass: "shadow-sm",
  },
  neon_accent: {
    label: "Neon Accent",
    description: "Oscuro profundo, brillos neon en botones y tarjeta activa.",
    bg: "#0B0F1A",
    cardBg: "#141B2E",
    cardBorder: "rgba(255,255,255,0.08)",
    text: "#F0FFFC",
    muted: "#8BA3A0",
    chipBg: "rgba(255,255,255,0.06)",
    glass: false,
    neon: true,
    cardClass: "",
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
  none: "rounded-none",
};

export const PHOTO_ALIGN_CLASS = {
  left: "mr-auto ml-0 items-start text-left",
  center: "mx-auto items-center text-center",
  right: "ml-auto mr-0 items-end text-right",
};
