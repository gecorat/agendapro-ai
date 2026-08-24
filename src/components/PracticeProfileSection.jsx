import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, KeyRound, ExternalLink, Upload } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { PROFESSIONAL_TYPES, getTypeLabel } from "@/lib/professional-presets";
import { useToast } from "@/components/ui/use-toast";
import { base44 } from "@/api/base44Client";
import { convertImageToWebP } from "@/lib/image-utils";
import AddressAutocompleteInput from "@/components/AddressAutocompleteInput";

function Section({ title, description, children }) {
  return (
    <div className="space-y-3 pb-5 border-b border-border last:border-b-0 last:pb-0">
      <div>
        <p className="text-sm font-heading font-semibold">{title}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      {children}
    </div>
  );
}

// "Mi perfil" separa dos cosas que antes estaban mezcladas en un solo campo
// ("practice_name"), lo cual generaba confusión real: ¿ahí pongo mi nombre, o el del
// consultorio? Ahora son DOS campos distintos:
// - owner_display_name: tu nombre de pila, SOLO para que el panel te salude a vos (menú
//   lateral). Nunca lo ve un paciente.
// - practice_name (dentro de "Datos del negocio"): lo que ve el PACIENTE — en tu página
//   pública, en los mensajes del bot de WhatsApp, en los recordatorios. Puede ser el
//   nombre de tu consultorio O tu propio nombre y apellido si atenés de forma particular
//   — las dos opciones son válidas, por eso quedó aclarado en el propio formulario.
// "Página pública" (estética, tema, enlace) lee la dirección de acá mismo y la muestra de
// solo lectura con un link de vuelta.
// La foto de acá (avatar_url) es DISTINTA de la de Página pública (photo_url) — esta es
// solo para el menú lateral mientras usás la app, no para tus pacientes.
export default function PracticeProfileSection() {
  const { settings, save, reload } = usePracticeSettings();
  const { toast } = useToast();
  const [user, setUser] = useState(null);
  const [form, setForm] = useState({
    owner_display_name: "",
    professional_type: "dentist",
    practice_name: "",
    phone: "",
    professional_email: "",
    avatar_url: "",
    address: "",
    address_city: "",
    address_province: "",
    address_lat: null,
    address_lng: null,
  });
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    if (settings) {
      setForm({
        // Si todavía no cargaste tu nombre de pila acá, sugerimos el de tu cuenta como
        // punto de partida (no se guarda hasta que apretes Guardar).
        owner_display_name: settings.owner_display_name || user?.full_name || "",
        professional_type: settings.professional_type || "dentist",
        practice_name: settings.practice_name || "",
        phone: settings.phone || "",
        professional_email: settings.professional_email || "",
        avatar_url: settings.avatar_url || "",
        address: settings.address || "",
        address_city: settings.address_city || "",
        address_province: settings.address_province || "",
        address_lat: settings.address_lat ?? null,
        address_lng: settings.address_lng ?? null,
      });
    }
  }, [settings, user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await save(form);
      await reload();
      toast({ title: "Perfil actualizado" });
    } finally {
      setSaving(false);
    }
  }

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function handleAvatarUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      // Se convierte a WebP y se achica a 512px del lado del navegador antes de subir —
      // no hace falta más resolución para un avatar, y pesa bastante menos así.
      const optimized = await convertImageToWebP(file, { maxDimension: 512 });
      const { file_url } = await base44.integrations.Core.UploadFile({ file: optimized });
      set("avatar_url", file_url);
    } catch (err) {
      toast({ title: "Error al subir la foto", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-heading font-semibold">Mi perfil</h2>
        <p className="text-sm text-muted-foreground">Tus datos personales y de cuenta. Para la estética de tu página de reservas, andá a "Página pública" en el menú.</p>
      </div>

      <Section title="Foto de perfil" description="Se muestra en el menú lateral mientras usás la app — no en tu página pública de reservas.">
        <div className="flex items-center gap-3">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border bg-accent flex items-center justify-center shrink-0">
            {form.avatar_url ? <img src={form.avatar_url} alt="Mi perfil" className="w-full h-full object-cover" /> : <Upload className="w-5 h-5 text-muted-foreground" />}
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-md border border-input hover:bg-accent transition-colors">
              {uploadingAvatar ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              {form.avatar_url ? "Cambiar" : "Subir foto"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
          </label>
        </div>
      </Section>

      <Section title="Identidad">
        <div className="space-y-1.5">
          <Label htmlFor="practice_name">Nombre</Label>
          <Input id="practice_name" value={form.practice_name} onChange={(e) => set("practice_name", e.target.value)} placeholder="Ej. Dr. Juan Pérez" />
        </div>
        <Select value={form.professional_type} onValueChange={(v) => set("professional_type", v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROFESSIONAL_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground -mt-1">Define los términos y servicios sugeridos en toda la app.</p>
      </Section>

      <Section title="Contacto">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Teléfono</Label>
            <Input id="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.professional_email} onChange={(e) => set("professional_email", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section title="Ubicación" description="Se muestra en tu página pública y en los mensajes de confirmación del bot de WhatsApp (con link a Google Maps).">
        <AddressAutocompleteInput
          value={form.address}
          onChange={(v) => set("address", v)}
          onPlaceSelect={({ address, lat, lng }) => setForm((f) => ({ ...f, address, address_lat: lat, address_lng: lng }))}
        />
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Input value={form.address_city} onChange={(e) => set("address_city", e.target.value)} placeholder="Localidad" />
          <Input value={form.address_province} onChange={(e) => set("address_province", e.target.value)} placeholder="Provincia" />
        </div>
      </Section>

      <Section title="Cuenta" description="Login y seguridad.">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Email de acceso</Label>
          <Input value={user?.email || ""} disabled className="bg-muted/50" />
        </div>
        <Button
          type="button"
          variant="outline"
          className="gap-1.5"
          onClick={() => window.open("https://base44.com/account/security", "_blank")}
        >
          <KeyRound className="w-4 h-4" /> Cambiar contraseña <ExternalLink className="w-3.5 h-3.5" />
        </Button>
      </Section>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Guardar
      </Button>
      <p className="text-xs text-muted-foreground">
        Servicios sugeridos para {getTypeLabel(form.professional_type).toLowerCase()} disponibles en la pestaña Servicios.
      </p>
    </form>
  );
}
