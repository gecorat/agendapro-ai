import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, ChevronDown, ChevronRight, CalendarOff, Coffee } from "lucide-react";

const DAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function AvailabilityEditor() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openDay, setOpenDay] = useState(1);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const list = await base44.entities.Availability.filter({});
      setItems(list || []);
    } finally {
      setLoading(false);
    }
  }

  const weekly = items.filter((a) => a.type === "work" || a.type === "break");
  const holidays = items.filter((a) => a.type === "holiday" || a.type === "block");

  async function addRange(day, type) {
    const def = type === "break" ? { start_time: "13:00", end_time: "14:00", label: "Pausa" } : { start_time: "09:00", end_time: "13:00", label: "" };
    await base44.entities.Availability.create({ day_of_week: day, ...def, type });
    load();
  }

  async function updateItem(id, data) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...data } : it)));
    await base44.entities.Availability.update(id, data);
  }

  async function deleteItem(id) {
    setItems((prev) => prev.filter((it) => it.id !== id));
    await base44.entities.Availability.delete(id);
  }

  async function addHoliday() {
    const today = new Date().toISOString().slice(0, 10);
    await base44.entities.Availability.create({ day_of_week: 0, start_time: "00:00", end_time: "23:59", type: "holiday", date: today, label: "Feriado" });
    load();
  }

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading font-semibold flex items-center gap-2">
          <CalendarOff className="w-5 h-5" /> Horarios laborales
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Definí tus franjas de atención. Podés cargar varios rangos por día (horarios cortados) y pausas.
        </p>
      </div>

      <div className="space-y-2">
        {DAYS.map((dName, day) => {
          const dayItems = weekly.filter((a) => a.day_of_week === day).sort((a, b) => a.start_time.localeCompare(b.start_time));
          const work = dayItems.filter((a) => a.type === "work");
          const breaks = dayItems.filter((a) => a.type === "break");
          const isOpen = openDay === day;
          const summary = work.length ? work.map((w) => `${w.start_time}-${w.end_time}`).join(", ") : "Sin atención";
          return (
            <Card key={day} className="overflow-hidden">
              <button
                onClick={() => setOpenDay(isOpen ? -1 : day)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent/50 transition-colors"
              >
                <div className="text-left">
                  <p className="font-medium text-sm">{dName}</p>
                  <p className="text-xs text-muted-foreground">{summary}</p>
                </div>
                {isOpen ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
                  {dayItems.length === 0 && (
                    <p className="text-xs text-muted-foreground py-2">Día libre. Agregá una franja para atender.</p>
                  )}
                  {dayItems.map((it) => (
                    <div key={it.id} className={`rounded-lg border p-2 space-y-2 ${it.type === "break" ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
                      <div className="flex items-center gap-2">
                        {it.type === "break" ? <Coffee className="w-3.5 h-3.5 text-amber-600" /> : null}
                        <span className="text-xs font-medium">{it.type === "break" ? "Pausa" : "Atención"}</span>
                        <button onClick={() => deleteItem(it.id)} className="ml-auto p-1 rounded hover:bg-black/5 text-muted-foreground hover:text-destructive">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="time" value={it.start_time} onChange={(e) => updateItem(it.id, { start_time: e.target.value })} className="h-8 text-sm" />
                        <span className="text-xs text-muted-foreground">→</span>
                        <Input type="time" value={it.end_time} onChange={(e) => updateItem(it.id, { end_time: e.target.value })} className="h-8 text-sm" />
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <Button type="button" size="sm" variant="outline" onClick={() => addRange(day, "work")}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Franja
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => addRange(day, "break")}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Pausa
                    </Button>
                  </div>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      <div className="pt-2 border-t border-border">
        <h3 className="font-heading font-semibold text-sm mb-1">Feriados y días no laborables</h3>
        <p className="text-xs text-muted-foreground mb-3">Bloqueá fechas específicas para que no se ofrezcan turnos.</p>
        <div className="space-y-2">
          {holidays.length === 0 && (
            <p className="text-xs text-muted-foreground py-2">No hay fechas bloqueadas.</p>
          )}
          {holidays.map((h) => (
            <Card key={h.id} className="p-3 flex items-center gap-2">
              <CalendarOff className="w-4 h-4 text-muted-foreground shrink-0" />
              <Input type="date" value={h.date || ""} onChange={(e) => updateItem(h.id, { date: e.target.value })} className="h-8 text-sm max-w-[180px]" />
              <Input value={h.label || ""} placeholder="Etiqueta" onChange={(e) => updateItem(h.id, { label: e.target.value })} className="h-8 text-sm" />
              <button onClick={() => deleteItem(h.id)} className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </Card>
          ))}
          <Button type="button" size="sm" variant="outline" onClick={addHoliday}>
            <Plus className="w-3.5 h-3.5 mr-1" /> Bloquear fecha
          </Button>
        </div>
      </div>
    </div>
  );
}