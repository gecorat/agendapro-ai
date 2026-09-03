import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarClock, Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { PROFESSIONAL_TYPES, getPreset, getTypeLabel } from "@/lib/professional-presets";

// Configuración inicial, en UNA sola pantalla.
//
// Antes era un asistente de dos pasos donde el primero eran 22 casillas grandes (una por
// especialidad) que no entraban en pantalla — y como AppLayout bloquea el scroll del
// documento, no había forma de llegar al botón salvo achicando el zoom del navegador. El
// segundo paso además volvía a preguntar la especialidad en texto libre, después de
// haberla elegido en el primero.
//
// Ahora: un desplegable compacto para el tipo de profesional, el resto de los datos
// debajo, y un solo botón. Entra en pantalla sin scroll en un monitor normal, y en mobile
// scrollea como cualquier formulario.
export default function Onboarding({ onConfigured }) {
  const [type, setType] = useState("dentist");
  const [form, setForm] = useState({
    practice_name: "",
    // La especialidad viene sugerida desde el tipo elegido — no se pregunta dos veces.
    // Queda editable porque "Odontólogo" no es lo mismo que "Odontología infantil".
    specialty: getTypeLabel("dentist"),
    address: "",
    phone: "",
    professional_email: "",
  });
  // Mientras el profesional no toque la especialidad a mano, sigue al tipo elegido.
  const [specialtyTouched, setSpecialtyTouched] = useState(false);
  const [applyServices, setApplyServices] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const preset = getPreset(type);

  function selectType(value) {
    setType(value);
    if (!specialtyTouched) setForm((f) => ({ ...f, specialty: getTypeLabel(value) }));
  }

  async function handleFinish() {
    if (!form.practice_name.trim()) {
      toast({ title: "Falta el nombre", description: "Es el nombre que van a ver tus pacientes.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const trialEnd = new Date();
      trialEnd.setDate(trialEnd.getDate() + 14);

      const inviteCode = (typeof localStorage !== "undefined" && localStorage.getItem("agendapro_invite_code")) || null;
      const trialOrigin = inviteCode ? "invitation" : "landing";

      const baseData = {
        practice_name: form.practice_name.trim() || undefined,
        specialty: form.specialty.trim() || undefined,
        address: form.address || undefined,
        phone: form.phone || undefined,
        professional_email: form.professional_email || undefined,
        professional_type: type,
        plan: "trial",
        trial_ends_at: trialEnd.toISOString(),
        trial_origin: trialOrigin,
        invitation_code: inviteCode || undefined,
      };

      await base44.functions.invoke("completeOnboarding", {
        practiceData: baseData,
        services: applyServices ? preset.services : [],
      });

      // Antes de recargar, confirmamos que el consultorio quedó REALMENTE asociado a esta
      // cuenta. Sin este chequeo, si la asociación fallaba la app volvía a mostrar el
      // onboarding y quedaba en un bucle infinito sin decir nunca qué pasó — que es
      // exactamente lo que se vivió cuando Base44 empezó a pisar el dueño de los registros
      // (ver base44/shared/ownership.ts).
      const check = await base44.functions.invoke("getMyPractice", {});
      if (!check?.data?.practice) {
        throw new Error(
          "Se guardó la configuración pero la cuenta no quedó vinculada. Escribinos así lo resolvemos, no hace falta que cargues todo de nuevo.",
        );
      }

      if (inviteCode && typeof localStorage !== "undefined") {
        localStorage.removeItem("agendapro_invite_code");
      }

      await onConfigured?.();
      window.location.href = "/";
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || "No se pudo guardar";
      toast({ title: "Error al guardar", description: msg, variant: "destructive" });
      setSaving(false);
    }
  }

  return (
    // min-h-screen + my-auto en el hijo: centra vertical cuando entra, y cuando no entra
    // scrollea desde arriba en vez de recortar la parte de arriba (que es lo que hace
    // items-center con contenido más alto que la pantalla).
    <div className="min-h-screen bg-background flex justify-center p-4">
      <div className="w-full max-w-lg my-auto py-4">
        <div className="flex items-center gap-2 justify-center mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="text-left">
            <p className="font-heading font-semibold">Kame Agenda</p>
            <p className="text-xs text-muted-foreground">Configuración inicial</p>
          </div>
        </div>

        <Card className="p-6 space-y-4">
          <div>
            <h2 className="font-heading font-semibold text-lg">Contanos de tu consultorio</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Son 30 segundos. Después podés cambiar todo desde Configuración.
            </p>
          </div>

          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="professional_type">Tipo de profesional</Label>
              <Select value={type} onValueChange={selectType}>
                <SelectTrigger id="professional_type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PROFESSIONAL_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Adaptamos los términos de la app: a los tuyos los vamos a llamar{" "}
                <span className="font-medium text-foreground">{preset.patientLabel.toLowerCase()}</span>.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="practice_name">Nombre del consultorio / profesional</Label>
              <Input
                id="practice_name"
                value={form.practice_name}
                onChange={(e) => setForm({ ...form, practice_name: e.target.value })}
                placeholder="Ej. Dr. Juan Pérez"
              />
              <p className="text-xs text-muted-foreground">Es el nombre que van a ver tus pacientes.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="specialty">Especialidad</Label>
              <Input
                id="specialty"
                value={form.specialty}
                onChange={(e) => { setSpecialtyTouched(true); setForm({ ...form, specialty: e.target.value }); }}
                placeholder="Ej. Odontología general"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="address">Dirección <span className="text-muted-foreground font-normal">(opcional)</span></Label>
              <Input
                id="address"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
                placeholder="Calle, número, ciudad"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="phone">Teléfono <span className="text-muted-foreground font-normal">(opcional)</span></Label>
                <Input
                  id="phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email de contacto <span className="text-muted-foreground font-normal">(opcional)</span></Label>
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
              <div className="min-w-0">
                <p className="text-sm font-medium">
                  Crear servicios sugeridos para {getTypeLabel(type).toLowerCase()}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {preset.services.map((s) => s.name).join(" · ")}
                </p>
              </div>
            </label>
          </div>

          <Button className="w-full" onClick={handleFinish} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Finalizar configuración
          </Button>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Disfrutás 14 días de prueba con todas las funciones. Sin tarjeta.
        </p>
      </div>
    </div>
  );
}
