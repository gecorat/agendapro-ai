import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Check, Upload } from "lucide-react";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { PROFESSIONAL_TYPES, getTypeLabel } from "@/lib/professional-presets";
import { useToast } from "@/components/ui/use-toast";

export default function PracticeProfileSection() {
  const { settings, save, reload } = usePracticeSettings();
  const { toast } = useToast();
  const [form, setForm] = useState({
    professional_type: "dentist",
    practice_name: "",
    specialty: "",
    address: "",
    phone: "",
    professional_email: "",
    handle: "",
    photo_url: "",
    page_color: "#0f172a",
    description: "",
    published: true,
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (settings) {
      setForm({
        professional_type: settings.professional_type || "dentist",
        practice_name: settings.practice_name || "",
        specialty: settings.specialty || "",
        address: settings.address || "",
        phone: settings.phone || "",
        professional_email: settings.professional_email || "",
        handle: settings.handle || "",
        photo_url: settings.photo_url || "",
        page_color: settings.page_color || "#0f172a",
        description: settings.description || "",
        published: settings.published !== false,
      });
    }
  }, [settings]);

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm((f) => ({ ...f, photo_url: file_url }));
    } catch {
      toast({ title: "Error al subir la foto", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const cleanHandle = form.handle.trim().replace(/^@/, "").replace(/\s+/g, "");
    setSaving(true);
    try {
      await save({ ...form, handle: cleanHandle });
      await reload();
      toast({ title: "Perfil actualizado", description: "Tu página pública y términos se actualizaron." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="font-heading font-semibold">Perfil del profesional</h2>
        <p className="text-sm text-muted-foreground">Tu especialidad define los términos y servicios sugeridos.</p>
      </div>

      <div className="space-y-2">
        <Label>Especialidad</Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {PROFESSIONAL_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setForm({ ...form, professional_type: t.value })}
              className={`text-left p-3 rounded-lg border-2 transition-colors ${
                form.professional_type === t.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{t.label}</span>
                {form.professional_type === t.value && <Check className="w-3.5 h-3.5 text-primary" />}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="practice_name">Nombre del consultorio / profesional</Label>
        <Input id="practice_name" value={form.practice_name} onChange={(e) => setForm({ ...form, practice_name: e.target.value })} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="handle">Usuario público (@) para tu enlace de reservas</Label>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground text-sm">@</span>
          <Input
            id="handle"
            value={form.handle}
            onChange={(e) => setForm({ ...form, handle: e.target.value })}
            placeholder="drmartinez"
            className="flex-1"
          />
        </div>
        <p className="text-xs text-muted-foreground">Sin espacios ni @. Tu enlace será /u/{form.handle ? form.handle.replace(/^@/, "").replace(/\s+/g, "") : "tuusuario"}</p>
      </div>

      <div className="space-y-2">
        <Label>Foto de perfil</Label>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border bg-accent flex items-center justify-center shrink-0">
            {form.photo_url ? (
              <img src={form.photo_url} alt="perfil" className="w-full h-full object-cover" />
            ) : (
              <Upload className="w-5 h-5 text-muted-foreground" />
            )}
          </div>
          <label className="cursor-pointer">
            <span className="inline-flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-md border border-input hover:bg-accent transition-colors">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {form.photo_url ? "Cambiar foto" : "Subir foto"}
            </span>
            <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploading} />
          </label>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción / presentación</Label>
        <Textarea
          id="description"
          rows={3}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Contá brevemente quién sos y qué ofrecés. Esto verán tus pacientes en la página de reservas."
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="specialty">Especialidad</Label>
          <Input id="specialty" value={form.specialty} onChange={(e) => setForm({ ...form, specialty: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="page_color">Color de la página</Label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              id="page_color"
              value={form.page_color}
              onChange={(e) => setForm({ ...form, page_color: e.target.value })}
              className="w-10 h-9 rounded border border-input p-1 cursor-pointer"
            />
            <Input value={form.page_color} onChange={(e) => setForm({ ...form, page_color: e.target.value })} className="flex-1 font-mono text-xs" />
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="address">Dirección</Label>
        <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="phone">Teléfono</Label>
          <Input id="phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email de contacto</Label>
          <Input id="email" type="email" value={form.professional_email} onChange={(e) => setForm({ ...form, professional_email: e.target.value })} />
        </div>
      </div>

      <div className="flex items-center justify-between p-3 rounded-lg border border-border">
        <div>
          <p className="text-sm font-medium">Página pública publicada</p>
          <p className="text-xs text-muted-foreground">Si la desactivás, nadie podrá reservar por tu enlace.</p>
        </div>
        <Switch checked={form.published} onCheckedChange={(v) => setForm({ ...form, published: v })} />
      </div>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Guardar perfil
      </Button>
      <p className="text-xs text-muted-foreground">
        Al cambiar la especialidad, los términos de la interfaz se adaptan. Los servicios sugeridos para {getTypeLabel(form.professional_type).toLowerCase()} podés crearlos desde la pestaña Servicios.
      </p>
    </form>
  );
}