import React from "react";
import { Zap } from "lucide-react";

const SITE = "https://kameagenda.com";

// Marca de Kame Agenda en las pantallas que ve el PACIENTE: página pública de reservas,
// confirmar / cancelar / reprogramar turno, y dejar reseña. Se muestra siempre, sin
// importar el plan del profesional.
//
// Cada lugar pasa su propio `utm` para poder medir en Google Analytics / el panel de
// kameagenda.com desde qué pantalla llega la gente (?utm_medium=booking_footer, etc.).
//
// - variant="footer" → pie discreto, para el final de una pantalla.
// - variant="card"   → bloque un poco más visible, para los dos momentos de máxima
//                      atención del paciente (turno confirmado, reseña enviada).
//
// `color` / `mutedColor` existen porque la página pública se pinta con el tema que eligió
// el profesional (puede ser oscuro): sin eso, el pie quedaría ilegible. Las pantallas de
// token y reseña usan el slate por defecto.
export default function PoweredByKame({ variant = "footer", utm = "public", color, className = "" }) {
  const href = `${SITE}?utm_source=kame_app&utm_medium=${utm}`;

  if (variant === "card") {
    return (
      <div className={`rounded-2xl border border-slate-200 bg-white/70 p-4 text-center ${className}`}>
        <p className="text-sm text-slate-600">
          ¿Atendés pacientes? <span className="font-semibold text-slate-900">Kame Agenda</span> te agenda los turnos
          y te contesta el WhatsApp sola.
        </p>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 mt-2 text-sm font-semibold text-slate-900 hover:underline"
        >
          <Zap className="w-3.5 h-3.5" /> Probala 14 días gratis
        </a>
      </div>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={`block text-center text-xs py-4 hover:opacity-80 transition-opacity ${color ? "" : "text-slate-400"} ${className}`}
      style={color ? { color, opacity: 0.7 } : undefined}
    >
      ⚡ Powered by <span className="font-semibold">kameagenda.com</span>
    </a>
  );
}
