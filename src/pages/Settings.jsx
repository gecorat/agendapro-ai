import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Clock, Calendar, MessageCircle, Mail, CheckCircle2, XCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

export default function Settings() {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    try {
      const servs = await base44.entities.Service.filter({});
      setServices(servs || []);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(s) {
    if (!confirm(`¿Eliminar el servicio "${s.name}"?`)) return;
    await base44.entities.Service.delete(s.id);
    load();
  }

  function openNew() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(s) {
    setEditing(s);
    setFormOpen(true);
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-semibold">Configuración</h1>
        <p className="text-muted-foreground text-sm">Gestioná tu consultorio</p>
      </div>

      <Tabs defaultValue="services">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="hours">Horarios</TabsTrigger>
          <TabsTrigger value="integrations">Integraciones</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        {/* Servicios */}
        <TabsContent value="services" className="space-y-4 mt-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading font-semibold">Servicios</h2>
              <p className="text-sm text-muted-foreground">Tipos de consulta que ofrecés</p>
            </div>
            <Button onClick={openNew}>
              <Plus className="w-4 h-4 mr-1" />
              Nuevo servicio
            </Button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
            </div>
          ) : services.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground">No hay servicios. Creá el primero.</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {services.map((s) => (
                <Card key={s.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ background: s.color || "#3b82f6" }} />
                    <div>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.duration_minutes} min{s.margin_minutes ? ` · margen ${s.margin_minutes} min` : ""}
                        {s.follow_up_days ? ` · seguimiento ${s.follow_up_days} días` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(s)} className="p-1.5 rounded-md hover:bg-accent text-muted-foreground">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(s)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Horarios */}
        <TabsContent value="hours" className="space-y-4 mt-4">
          <div>
            <h2 className="font-heading font-semibold flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Horarios laborales
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              Próximamente: configuración de horarios, descansos y feriados.
            </p>
          </div>
          <Card className="p-6 space-y-3">
            {days.map((d) => (
              <div key={d} className="flex items-center justify-between">
                <span className="text-sm font-medium w-28">{d}</span>
                <span className="text-sm text-muted-foreground">09:00 - 18:00 (por defecto)</span>
              </div>
            ))}
          </Card>
        </TabsContent>

        {/* Integraciones */}
        <TabsContent value="integrations" className="space-y-4 mt-4">
          <div>
            <h2 className="font-heading font-semibold">Integraciones</h2>
            <p className="text-sm text-muted-foreground">Conectá tus cuentas para automatizar</p>
          </div>

          <IntegrationCard
            icon={Calendar}
            name="Google Calendar"
            description="Sincronización bidireccional de citas"
            connected={false}
          />
          <IntegrationCard
            icon={MessageCircle}
            name="WhatsApp"
            description="Asistente de reservas y recordatorios"
            connected={false}
          />
          <IntegrationCard
            icon={Mail}
            name="Email"
            description="Recordatorios y confirmaciones por correo"
            connected={true}
          />
        </TabsContent>

        {/* Plan */}
        <TabsContent value="plan" className="space-y-4 mt-4">
          <div>
            <h2 className="font-heading font-semibold">Tu plan</h2>
            <p className="text-sm text-muted-foreground">Gestión de suscripción</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="p-5 border-2 border-primary">
              <p className="font-heading font-semibold">Base</p>
              <p className="text-2xl font-heading font-bold mt-1">USD 59<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
              <p className="text-sm text-muted-foreground mt-1">Hasta 100 citas mensuales</p>
            </Card>
            <Card className="p-5">
              <p className="font-heading font-semibold">Pro</p>
              <p className="text-2xl font-heading font-bold mt-1">USD 79<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
              <p className="text-sm text-muted-foreground mt-1">Citas ilimitadas</p>
            </Card>
          </div>
          <Card className="p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800">
              Estás en período de prueba (14 días). Elegí tu plan antes de que termine.
            </p>
          </Card>
        </TabsContent>
      </Tabs>

      <ServiceForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onSaved={load}
        service={editing}
      />
    </div>
  );
}

function IntegrationCard({ icon: Icon, name, description, connected }) {
  return (
    <Card className="p-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">{name}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {connected ? (
          <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
            <CheckCircle2 className="w-4 h-4" />
            Conectado
          </span>
        ) : (
          <>
            <XCircle className="w-4 h-4 text-muted-foreground" />
            <Button variant="outline" size="sm">
              Conectar
            </Button>
          </>
        )}
      </div>
    </Card>
  );
}

function ServiceForm({ open, onClose, onSaved, service }) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    description: "",
    duration_minutes: 30,
    margin_minutes: 0,
    color: "#3b82f6",
    follow_up_days: 0,
    active: true,
  });

  useEffect(() => {
    if (open) {
      if (service) {
        setForm({
          name: service.name || "",
          description: service.description || "",
          duration_minutes: service.duration_minutes || 30,
          margin_minutes: service.margin_minutes || 0,
          color: service.color || "#3b82f6",
          follow_up_days: service.follow_up_days || 0,
          active: service.active !== false,
        });
      } else {
        setForm({ name: "", description: "", duration_minutes: 30, margin_minutes: 0, color: "#3b82f6", follow_up_days: 0, active: true });
      }
    }
  }, [open, service]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      if (service) {
        await base44.entities.Service.update(service.id, form);
      } else {
        await base44.entities.Service.create(form);
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{service ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre *</Label>
            <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input id="description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="duration">Duración (min)</Label>
              <Input
                id="duration"
                type="number"
                value={form.duration_minutes}
                onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="margin">Margen (min)</Label>
              <Input
                id="margin"
                type="number"
                value={form.margin_minutes}
                onChange={(e) => setForm({ ...form, margin_minutes: Number(e.target.value) })}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="followup">Seguimiento (días)</Label>
              <Input
                id="followup"
                type="number"
                value={form.follow_up_days}
                onChange={(e) => setForm({ ...form, follow_up_days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Input
                id="color"
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 p-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{service ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}