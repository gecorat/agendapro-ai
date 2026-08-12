import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { CalendarClock, ArrowRight, Check, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PROFESSIONAL_TYPES, getPreset, getTypeLabel } from "@/lib/professional-presets";

export default function Onboarding({ onConfigured }) {
  const [step, setStep] = useState(1);
  const [type, setType] = useState("dentist");
  const [form, setForm] = useState({
    practice_name: "",
    specialty: "",
    address: "",
    phone: "",
    professional_email: "",
  });
  const [applyServices, setApplyServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const preset = getPreset(type);

  async function handleFinish() {
    setSaving(true);
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      const inviteCode = (typeof localStorage !== "undefined" && localStorage.getItem("agendapro_invite_code")) || null;
      const trialOrigin = inviteCode ? "invitation" : "landing";

      const me = await base44.auth.me();
      const existing = await base44.entities.PracticeSettings.filter({ created_by_id: me.id });
      const mine = existing?.find((r) => r.created_by_id === me.id);
      let record;
      const baseData = {
        ...form,
        professional_type: type,
        plan: "trial",
        trial_ends_at: trialEnd.toISOString(),
        trial_origin: trialOrigin,
        invitation_code: inviteCode || undefined,
      };
      if (mine) {
        record = await base44.entities.PracticeSettings.update(mine.id, baseData);
      } else {
        record = await base44.entities.PracticeSettings.create(baseData);
      }

      if (inviteCode && typeof localStorage !== "undefined") {
        localStorage.removeItem("agendapro_invite_code");
      }

      if (applyServices) {
        const current = await base44.entities.Service.filter({});
        const newOnes = preset.services.filter(
          (s) => !current.some((c) => c.name === s.name)
        );
        if (newOnes.length) {
          await base44.entities.Service.bulkCreate(
            newOnes.map((s) => ({ ...s, active: true }))
          );
        }
      }

      onConfigured?.();
    } catch (err) {
      toast({ title: "Error al guardar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="text-left">
            <p className="font-heading font-semibold">AgendaPro</p>
            <p className="text-xs text-muted-foreground">Configuración inicial</p>
          </div>
        </div>

        <Card className="p-6">
          {/* Progress */}
          <div className="flex items-center gap-2 mb-6">
            <div className={`flex items-center gap-2 text-sm ${step >= 1 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 1 ? "bg-primary text-primary-foreground" : "bg-accent"}`}>1</span>
              Especialidad
            </div>
            <div className="flex-1 h-px bg-border" />
            <div className={`flex items-center gap-2 text-sm ${step >= 2 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
              <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs ${step >= 2 ? "bg-primary text-primary-foreground" : "bg-accent"}`}>2</span>
              Datos del consultorio
            </div>
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading font-semibold text-lg">¿Qué tipo de profesional sos?</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Adaptamos los términos y servicios según tu especialidad.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {PROFESSIONAL_TYPES.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setType(t.value)}
                    className={`text-left p-4 rounded-lg border-2 transition-colors ${
                      type === t.value
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{t.label}</span>
                      {type === t.value && <Check className="w-4 h-4 text-primary" />}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 capitalize">
                      {getPreset(t.value).patientLabel.toLowerCase()}
                    </p>
                  </button>
                ))}
              </div>
              <Button className="w-full" onClick={() => setStep(2)}>
                Continuar
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div>
                <h2 className="font-heading font-semibold text-lg">Datos del consultorio</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Estos datos aparecerán en confirmaciones y recordatorios.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="practice_name">Nombre del consultorio / profesional</Label>
                  <Input
                    id="practice_name"
                    value={form.practice_name}
                    onChange={(e) => setForm({ ...form, practice_name: e.target.value })}
                    placeholder="Ej. Dr. Juan Pérez"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="specialty">Especialidad</Label>
                  <Input
                    id="specialty"
                    value={form.specialty}
                    onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                    placeholder="Ej. Odontología general"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Input
                    id="address"
                    value={form.address}
                    onChange={(e) => setForm({ ...form, address: e.target.value })}
                    placeholder="Calle, número, ciudad"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone">Teléfono</Label>
                    <Input
                      id="phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email de contacto</Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.professional_email}
                      onChange={(e) => setForm({ ...form, professional_email: e.target.value })}
                    />
                  </div>
                </div>
                <label className="flex items-start gap-3 p-3 rounded-lg border border-border cursor-pointer hover:bg-accent/50">
                  <input
                    type="checkbox"
                    checked={applyServices}
                    onChange={(e) => setApplyServices(e.target.checked)}
                    className="mt-0.5"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      Crear servicios sugeridos para {getTypeLabel(type).toLowerCase()}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {preset.services.map((s) => s.name).join(" · ")}
                    </p>
                  </div>
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  Atrás
                </Button>
                <Button className="flex-1" disabled={saving} onClick={handleFinish}>
                  {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Finalizar configuración
                </Button>
              </div>
            </div>
          )}
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          Disfrutás 14 días de prueba con todas las funciones. Sin tarjeta.
        </p>
      </div>
    </div>
  );
}