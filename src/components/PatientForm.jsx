import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";

// `defaults` precarga campos al CREAR (no al editar). Se usa desde la bandeja de Chats para
// abrir el formulario ya con el nombre y el teléfono del contacto, en vez de obligar al
// profesional a retipearlos. No se pasa como `patient` a propósito: ese prop significa
// "estoy editando esta ficha" y dispara un update por id.
export default function PatientForm({ open, onClose, onSaved, patient, defaults }) {
  const { toast } = useToast();
  const { isOwner, professional: myProfessional } = usePracticeSettings();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    phone: "",
    email: "",
    dni: "",
    notes: "",
    contact_preference: "whatsapp",
    consent_reminders: true,
    no_show_count: 0,
    cancellation_count: 0,
  });

  useEffect(() => {
    if (open) {
      if (patient) {
        setForm({
          first_name: patient.first_name || "",
          last_name: patient.last_name || "",
          phone: patient.phone || "",
          email: patient.email || "",
          dni: patient.dni || "",
          notes: patient.notes || "",
          contact_preference: patient.contact_preference || "whatsapp",
          consent_reminders: patient.consent_reminders !== false,
          no_show_count: patient.no_show_count || 0,
          cancellation_count: patient.cancellation_count || 0,
        });
      } else {
        setForm({
          first_name: "",
          last_name: "",
          phone: "",
          email: "",
          dni: "",
          notes: "",
          contact_preference: "whatsapp",
          consent_reminders: true,
          no_show_count: 0,
          cancellation_count: 0,
          ...(defaults || {}),
        });
      }
    }
    // `defaults` queda fuera de las dependencias a propósito: se pasa como objeto literal
    // desde el llamador, o sea que cambia de identidad en cada render y volvería a pisar lo
    // que el usuario esté tipeando. Solo importa su valor al abrir el formulario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, patient]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      let saved;
      if (patient) {
        await base44.entities.Patient.update(patient.id, form);
        saved = { ...patient, ...form };
      } else {
        const me = await base44.auth.me();
        const practiceOwnerId = isOwner ? me.id : (myProfessional?.practice_owner_id || me.id);
        saved = await base44.entities.Patient.create({ ...form, professional_id: practiceOwnerId });
      }
      if (onSaved) await onSaved(saved);
      onClose();
    } catch (err) {
      toast({
        title: patient ? "No se pudo guardar" : "No se pudo crear el paciente",
        description: err?.message || "Intentá nuevamente.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{patient ? "Editar paciente" : "Nuevo paciente"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre *</Label>
              <Input
                id="first_name"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido</Label>
              <Input
                id="last_name"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Teléfono (WhatsApp) *</Label>
            <Input
              id="phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+54 9 11 1234 5678"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dni">DNI</Label>
            <Input
              id="dni"
              value={form.dni}
              onChange={(e) => setForm({ ...form, dni: e.target.value })}
              placeholder="Opcional"
            />
          </div>
          <div className="space-y-2">
            <Label>Preferencia de contacto</Label>
            <Select
              value={form.contact_preference}
              onValueChange={(v) => setForm({ ...form, contact_preference: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="both">Ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="consent"
              type="checkbox"
              checked={form.consent_reminders}
              onChange={(e) => setForm({ ...form, consent_reminders: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="consent" className="text-sm font-normal cursor-pointer">
              Consiente recibir recordatorios
            </Label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="no_show_count">Ausencias</Label>
              <Input
                id="no_show_count"
                type="number"
                min="0"
                value={form.no_show_count}
                onChange={(e) => setForm({ ...form, no_show_count: parseInt(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cancellation_count">Cancelaciones</Label>
              <Input
                id="cancellation_count"
                type="number"
                min="0"
                value={form.cancellation_count}
                onChange={(e) => setForm({ ...form, cancellation_count: parseInt(e.target.value) || 0 })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notas internas</Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
            />
          </div>
          <DialogFooter className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
            <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" className="w-full sm:w-auto" disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {patient ? "Guardar" : "Crear paciente"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}