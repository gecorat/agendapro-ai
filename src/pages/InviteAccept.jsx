import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, CheckCircle2, Calendar } from "lucide-react";

const COMMON_SPECIALTIES = [
  "Odontólogo/a", "Psicólogo/a", "Nutricionista", "Kinesiólogo/a", "Dermatólogo/a",
  "Peluquero/a", "Barbero/a", "Esteticista", "Entrenador/a personal", "Abogado/a", "Contador/a",
];

// Pantalla que abre un profesional invitado por un consultorio con plan Clinic. Si no
// tiene cuenta, lo mandamos a crear una (Base44 nativo) y vuelve acá solo. Si ya tiene
// sesión, completa acá mismo su perfil acotado y su horario — eso es TODO lo que puede
// cargar como invitado (no ve Ajustes, Chats, ni nada del resto del consultorio).
export default function InviteAccept() {
  const { token } = useParams();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [user, setUser] = useState(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState(null);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [specialty, setSpecialty] = useState("");
  const [customSpecialty, setCustomSpecialty] = useState("");
  const [workStart, setWorkStart] = useState("09:00");
  const [workEnd, setWorkEnd] = useState("18:00");
  const [hasBreak, setHasBreak] = useState(true);
  const [breakStart, setBreakStart] = useState("13:00");
  const [breakEnd, setBreakEnd] = useState("14:00");

  useEffect(() => {
    base44.auth.me()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => setCheckingAuth(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const finalSpecialty = specialty === "__other__" ? customSpecialty : specialty;
    if (!firstName.trim()) { setError("Falta tu nombre."); return; }
    setError(null);
    setSaving(true);
    try {
      await base44.functions.invoke("claimInvite", {
        token,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        specialty: finalSpecialty,
        work_start: workStart,
        work_end: workEnd,
        break_start: hasBreak ? breakStart : null,
        break_end: hasBreak ? breakEnd : null,
      });
      setDone(true);
      setTimeout(() => { window.location.href = "/"; }, 1800);
    } catch (err) {
      setError(err?.response?.data?.error || err.message || "No se pudo completar la invitación.");
    } finally {
      setSaving(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-border p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-heading font-semibold text-lg">Te invitaron a un equipo</h1>
            <p className="text-sm text-muted-foreground mt-1">Creá tu cuenta para completar tu perfil y empezar a recibir turnos.</p>
          </div>
          <Button className="w-full" onClick={() => base44.auth.redirectToLogin(window.location.href)}>
            Crear mi cuenta
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-sm w-full bg-white rounded-2xl border border-border p-6 text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
          <p className="font-heading font-semibold">¡Listo! Ya formás parte del equipo.</p>
          <p className="text-sm text-muted-foreground">Te llevamos a tu panel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-10 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="max-w-md w-full bg-white rounded-2xl border border-border p-6 space-y-4">
        <div>
          <p className="text-xs text-primary font-medium">Invitación de equipo</p>
          <h1 className="font-heading font-semibold text-lg">Completá tu perfil</h1>
          <p className="text-sm text-muted-foreground mt-1">Esto es todo lo que necesitamos para que el bot te asigne turnos.</p>
        </div>

        {error && <div className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm p-3">{error}</div>}

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div className="space-y-1.5">
            <Label>Apellido</Label>
            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Profesión / rol</Label>
          <select value={specialty} onChange={(e) => setSpecialty(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
            <option value="">Elegí una opción...</option>
            {COMMON_SPECIALTIES.map((s) => <option key={s} value={s}>{s}</option>)}
            <option value="__other__">Otra (escribir)</option>
          </select>
          {specialty === "__other__" && (
            <Input value={customSpecialty} onChange={(e) => setCustomSpecialty(e.target.value)} placeholder="Escribí tu profesión" className="mt-1.5" />
          )}
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <p className="text-sm font-medium">Horario de trabajo (lunes a viernes)</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Desde</Label><Input type="time" value={workStart} onChange={(e) => setWorkStart(e.target.value)} /></div>
            <div className="space-y-1"><Label className="text-xs text-muted-foreground">Hasta</Label><Input type="time" value={workEnd} onChange={(e) => setWorkEnd(e.target.value)} /></div>
          </div>
          <label className="flex items-center gap-2 text-sm pt-1">
            <input type="checkbox" checked={hasBreak} onChange={(e) => setHasBreak(e.target.checked)} />
            Tengo pausa laboral
          </label>
          {hasBreak && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Pausa desde</Label><Input type="time" value={breakStart} onChange={(e) => setBreakStart(e.target.value)} /></div>
              <div className="space-y-1"><Label className="text-xs text-muted-foreground">Pausa hasta</Label><Input type="time" value={breakEnd} onChange={(e) => setBreakEnd(e.target.value)} /></div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">Después vas a poder cambiar esto desde tu panel.</p>
        </div>

        <Button type="submit" className="w-full" disabled={saving}>
          {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} Guardar y entrar
        </Button>
      </form>
    </div>
  );
}
