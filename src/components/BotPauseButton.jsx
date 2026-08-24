import React, { useState } from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Pause, Play, Clock, Infinity as InfinityIcon, Loader2 } from "lucide-react";
import { getBotPauseStatus } from "@/lib/bot-status";

const DURATIONS = [
  { label: "Pausar 1 hora", minutes: 60 },
  { label: "Pausar 8 horas", minutes: 480 },
  { label: "Pausar 24 horas", minutes: 1440 },
];

// Botón que reemplaza al switch simple: activo → abre un menú con las duraciones;
// pausado → un solo click reactiva directo, sin menú de por medio.
export default function BotPauseButton({ settings, save, size = "sm" }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const status = getBotPauseStatus(settings);

  async function handlePause(minutes) {
    setOpen(false);
    setSaving(true);
    try {
      const until = minutes ? new Date(Date.now() + minutes * 60000).toISOString() : null;
      await save({ bot_enabled: false, bot_paused_until: until });
    } finally {
      setSaving(false);
    }
  }

  async function handleResume() {
    setSaving(true);
    try {
      await save({ bot_enabled: true, bot_paused_until: null });
    } finally {
      setSaving(false);
    }
  }

  if (status.paused) {
    return (
      <Button variant="outline" size={size} onClick={handleResume} disabled={saving} className="gap-1.5 text-xs h-7 px-2">
        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
        Reactivar
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size={size} disabled={saving} className="gap-1.5 text-xs h-7 px-2">
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Pause className="w-3 h-3" />}
          Pausar
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1">
        {DURATIONS.map((d) => (
          <button
            key={d.minutes}
            onClick={() => handlePause(d.minutes)}
            className="w-full text-left px-2.5 py-2 text-sm rounded-md hover:bg-accent transition-colors flex items-center justify-between"
          >
            {d.label} <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        ))}
        <div className="h-px bg-border my-1" />
        <button
          onClick={() => handlePause(0)}
          className="w-full text-left px-2.5 py-2 text-sm rounded-md hover:bg-accent transition-colors flex items-center justify-between"
        >
          Pausar indefinido <InfinityIcon className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </PopoverContent>
    </Popover>
  );
}
