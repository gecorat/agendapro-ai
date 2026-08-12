import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Plus, Pencil, Trash2, Clock, Calendar, MessageCircle, Mail, CheckCircle2, XCircle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import PracticeProfileSection from "@/components/PracticeProfileSection";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import PlanGate from "@/components/PlanGate";
import { getPlanStatus, PLAN_PRICES, PLAN_LABELS } from "@/lib/plan-utils";
import { Link } from "react-router-dom";

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
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="profile">Perfil</TabsTrigger>
          <TabsTrigger value="services">Servicios</TabsTrigger>
          <TabsTrigger value="hours">Horarios</TabsTrigger>
          <TabsTrigger value="integrations">Integraciones</TabsTrigger>
          <TabsTrigger value="plan">Plan</TabsTrigger>
        </TabsList>

        {/* Perfil */}
        <TabsContent value="profile" className="mt-4">
          <Card className="p-6">
            <PracticeProfileSection />
          </Card>
        </TabsContent>

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

          <PublicLinkCard />

          <IntegrationCard
            icon={Calendar}
            name="Google Calendar"
            description="Sincronización bidireccional de citas"
            connected={false}
          />
          <WhatsAppCard />
          <IntegrationCard
            icon={Mail}
            name="Email"
            description="Recordatorios y confirmaciones por correo"
            connected={true}
          />
        </TabsContent>

        {/* Plan */}
        <TabsContent value="plan" className="mt-4">
          <PlanSection />
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

function WhatsAppCard() {
  const { settings } = usePracticeSettings();
  const status = getPlanStatus(settings);
  if (status.hasPaidPlan) {
    return <IntegrationCard icon={MessageCircle} name="WhatsApp" description="Asistente de reservas y recordatorios" connected={false} />;
  }
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-lg bg-accent flex items-center justify-center">
          <MessageCircle className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium">WhatsApp</p>
          <p className="text-sm text-muted-foreground">Asistente de reservas y recordatorios</p>
        </div>
      </div>
      <PlanGate
        feature="Bot de WhatsApp"
        requiredPlan="pro"
        description="El bot responde, agenda y recuerda citas a tus pacientes por WhatsApp. Disponible desde el plan Pro."
      />
    </Card>
  );
}

function PlanSection() {
  const { settings } = usePracticeSettings();
  const status = getPlanStatus(settings);
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-semibold">Tu plan</h2>
        <p className="text-sm text-muted-foreground">Gestión de suscripción</p>
      </div>
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Plan actual</p>
            <p className="font-heading font-semibold text-lg">{PLAN_LABELS[status.plan] || "—"}</p>
          </div>
          {status.isTrial && (
            <span className={`text-sm font-medium px-3 py-1 rounded-full ${status.trialExpired ? "bg-destructive/10 text-destructive" : "bg-amber-100 text-amber-700"}`}>
              {status.trialExpired ? "Prueba expirada" : `${status.daysLeft} días restantes`}
            </span>
          )}
        </div>
        {status.isTrial && !status.trialExpired && (
          <p className="text-xs text-muted-foreground mt-2">Estás en período de prueba. Elegí tu plan antes de que termine.</p>
        )}
        {status.trialExpired && (
          <p className="text-xs text-destructive mt-2">Tu prueba terminó. Contactanos para activar tu plan.</p>
        )}
      </Card>
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className={`p-5 ${status.plan === "pro" ? "border-2 border-primary" : ""}`}>
          <p className="font-heading font-semibold">Pro</p>
          <p className="text-2xl font-heading font-bold mt-1">{PLAN_PRICES.pro}<span className="text-sm font-normal text-muted-foreground"> ARS/mes</span></p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>· Bot de WhatsApp con IA</li>
            <li>· Agenda y reservas online</li>
            <li>· Recordatorios automáticos</li>
            <li>· Hasta 200 citas mensuales</li>
          </ul>
        </Card>
        <Card className={`p-5 ${status.plan === "premium" ? "border-2 border-primary" : ""}`}>
          <p className="font-heading font-semibold">Premium</p>
          <p className="text-2xl font-heading font-bold mt-1">{PLAN_PRICES.premium}<span className="text-sm font-normal text-muted-foreground"> ARS/mes</span></p>
          <ul className="text-sm text-muted-foreground mt-2 space-y-1">
            <li>· Todo lo de Pro</li>
            <li>· Citas ilimitadas</li>
            <li>· Bandeja de chats con toma de control</li>
            <li>· Soporte prioritario</li>
          </ul>
        </Card>
      </div>
      <Card className="p-4 bg-accent/40">
        <p className="text-sm">Para activar o cambiar tu plan, contactanos. La recurrencia automática con Mercado Pago se habilita próximamente.</p>
      </Card>
    </div>
  );
}

function PublicLinkCard() {
  const { settings } = usePracticeSettings();
  const [copied, setCopied] = useState(false);
  const handle = (settings?.handle || "").replace(/^@/, "");
  const url = (typeof window !== "undefined" ? window.location.origin : "") + (handle ? `/u/${handle}` : "");

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card className="p-4">
      <p className="font-medium mb-1">Enlace público de reservas</p>
      <p className="text-sm text-muted-foreground mb-3">
        Compartí este link con tus {("pacientes")}. Reservan solos, sin escribirte.
      </p>
      {handle ? (
        <div className="flex gap-2">
          <Input value={url} readOnly className="font-mono text-xs" />
          <Button variant="outline" size="sm" onClick={copy} className="shrink-0">
            {copied ? <Check className="w-4 h-4" /> : "Copiar"}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Elegí tu @usuario en la pestaña <strong>Perfil</strong> para activar tu enlace.</p>
      )}
    </Card>
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