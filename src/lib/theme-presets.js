// Presets de tema visual para la página pública de reservas (/u/:handle).
// "brand_accent" es el único que usa el color elegido por el profesional (page_color);
// los otros tres tienen paleta fija, pensada para verse bien sin que el usuario tenga
// que elegir ningún color.
export const THEME_PRESETS = {
  minimal_dark: {
    label: "Minimal Dark",
    description: "Fondo negro, acentos dorados. Elegante y nocturno.",
    bg: "#0d1117",
    cardBg: "#161b22",
    cardBorder: "#30363d",
    text: "#f0f6fc",
    muted: "#9198a1",
    accent: "#d4af37",
    accentText: "#0d1117",
    chipBg: "#ffffff14",
  },
  clean_light: {
    label: "Clean Light",
    description: "Blanco y gris claro, sombras suaves. Pulido y neutro.",
    bg: "#f8fafc",
    cardBg: "#ffffff",
    cardBorder: "#e2e8f0",
    text: "#0f172a",
    muted: "#64748b",
    accent: "#0f172a",
    accentText: "#ffffff",
    chipBg: "#0f172a0d",
  },
  pastel_soft: {
    label: "Pastel Soft",
    description: "Sage green y lavanda. Cálido y relajante.",
    bg: "#f3f4ee",
    cardBg: "#ffffff",
    cardBorder: "#e5e1ee",
    text: "#3f3b52",
    muted: "#8b8598",
    accent: "#8fa77c",
    accentText: "#ffffff",
    chipBg: "#8fa77c1a",
  },
  brand_accent: {
    label: "Color de marca",
    description: "Fondo claro, usa tu color elegido como acento.",
    bg: "#f8fafc",
    cardBg: "#ffffff",
    cardBorder: "#e2e8f0",
    text: "#0f172a",
    muted: "#64748b",
    accent: null, // se resuelve con resolveTheme() usando page_color
    accentText: "#ffffff",
    chipBg: null,
  },
};

export function resolveTheme(presetKey, pageColor) {
  const preset = THEME_PRESETS[presetKey] || THEME_PRESETS.clean_light;
  if (preset === THEME_PRESETS.brand_accent) {
    const accent = pageColor || "#0f172a";
    return { ...preset, accent, chipBg: `${accent}14` };
  }
  return preset;
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
