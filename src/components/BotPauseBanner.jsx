import React, { useEffect, useState } from "react";
import { PauseOctagon } from "lucide-react";
import { getBotPauseStatus, formatRemaining, formatClockTime } from "@/lib/bot-status";

// Mensaje que avisa "el bot está pausado hasta X / indefinidamente" — se actualiza solo
// cada 30s mientras la pantalla sigue abierta, y desaparece solo (sin recargar nada) en
// cuanto el tiempo vence, porque getBotPauseStatus recalcula contra la hora actual.
export default function BotPauseBanner({ settings, className = "" }) {
  const [, forceTick] = useState(0);
  const status = getBotPauseStatus(settings);

  useEffect(() => {
    if (!status.paused || status.indefinite) return;
    const id = setInterval(() => forceTick((t) => t + 1), 30000);
    return () => clearInterval(id);
  }, [status.paused, status.indefinite]);

  if (!status.paused) return null;

  return (
    <div className={`flex items-center gap-2.5 rounded-lg bg-amber-500/10 px-3 py-2.5 ${className}`}>
      <PauseOctagon className="w-4 h-4 text-amber-600 shrink-0" />
      <p className="text-sm text-amber-700">
        {status.indefinite ? (
          "Bot pausado indefinidamente, hasta que lo reactivés."
        ) : (
          <>
            Bot pausado hasta las {formatClockTime(status.until)}
            {formatRemaining(status.until) && <> (quedan {formatRemaining(status.until)})</>}.
          </>
        )}{" "}
        Los mensajes que lleguen se siguen guardando en Chats para atenderlos a mano.
      </p>
    </div>
  );
}
