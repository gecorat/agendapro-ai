import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Copy, Check, Plus, Mail, Trash2, UserCheck, Clock, Send } from "lucide-react";

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}

export default function AdminInvitations() {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [label, setLabel] = useState("");
  const [sendEmailToo, setSendEmailToo] = useState(true);
  const [copied, setCopied] = useState(null);
  const [sendingId, setSendingId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setInvitations((await base44.entities.Invitation.list("-created_date")) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // Al crear, si hay email cargado y está tildado "mandar por email", se manda de una el
  // correo con la marca de Kame Agenda usando el código recién generado — así queda
  // vinculado desde el arranque y su estado pasa solo de "Pendiente" a "Registrado"
  // cuando esa persona complete el registro (ya lo hace completeOnboarding).
  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const code = randomCode();
      await base44.entities.Invitation.create({
        code,
        email: email || undefined,
        label: label || (email ? email : "Invitación"),
        status: "pending",
      });
      if (email && sendEmailToo) {
        try {
          await base44.functions.invoke("sendInviteEmail", { email, name: name.trim(), code });
          toast({ title: "Invitación creada y email enviado" });
        } catch (err) {
          toast({ title: "Invitación creada, pero el email falló", description: err?.response?.data?.error || err.message, variant: "destructive" });
        }
      } else {
        toast({ title: "Invitación creada" });
      }
      setEmail(""); setName(""); setLabel("");
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  // Reenviar el email para una invitación que ya existe (ej. si al crearla no se mandó,
  // o si querés insistir con alguien que no la abrió).
  const handleSendEmail = async (inv) => {
    if (!inv.email) return;
    setSendingId(inv.id);
    try {
      await base44.functions.invoke("sendInviteEmail", { email: inv.email, name: "", code: inv.code });
      toast({ title: "Email enviado" });
    } catch (err) {
      toast({ title: "No se pudo enviar", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setSendingId(null);
    }
  };

  const handleDelete = async (inv) => {
    if (!window.confirm(`¿Eliminar la invitación ${inv.code}?${inv.status === "used" ? " Ya fue usada." : ""}`)) return;
    try {
      await base44.entities.Invitation.delete(inv.id);
      toast({ title: "Invitación eliminada" });
      load();
    } catch (err) {
      toast({ title: "Error al eliminar", description: err.message, variant: "destructive" });
    }
  };

  const copyLink = async (code) => {
    const url = `${window.location.origin}/register?invite=${code}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(code);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast({ title: "No se pudo copiar", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4">
        <h2 className="font-heading font-semibold mb-3 flex items-center gap-2"><Plus className="w-4 h-4" /> Generar invitación</h2>
        <form onSubmit={handleCreate} className="space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="iname">Nombre (opcional)</Label>
              <Input id="iname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan Pérez" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="iemail">Email del invitado</Label>
              <Input id="iemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prospecto@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ilabel">Etiqueta</Label>
              <Input id="ilabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Clínica Norte" />
            </div>
          </div>
          {email && (
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendEmailToo} onChange={(e) => setSendEmailToo(e.target.checked)} />
              Mandar por email ahora, con la marca de Kame Agenda
            </label>
          )}
          <Button type="submit" disabled={creating}>
            {creating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} {email && sendEmailToo ? "Generar y enviar" : "Generar enlace"}
          </Button>
        </form>
      </Card>

      <Card className="p-4">
        <h2 className="font-heading font-semibold mb-3">Invitaciones ({invitations.length})</h2>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Aún no generaste invitaciones.</p>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => (
              <div key={inv.id} className="p-3 rounded-lg border border-border flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {inv.email ? <><Mail className="w-3.5 h-3.5 inline mr-1" />{inv.email}</> : inv.label || "Invitación"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">Código: {inv.code}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${inv.status === "used" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {inv.status === "used" ? <><UserCheck className="w-3 h-3" /> Registrado</> : <><Clock className="w-3 h-3" /> Pendiente</>}
                  </span>
                  {inv.email && inv.status !== "used" && (
                    <Button size="sm" variant="outline" onClick={() => handleSendEmail(inv)} disabled={sendingId === inv.id} title="Mandar / reenviar el email de invitación">
                      {sendingId === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  )}
                  <Button size="sm" variant="outline" onClick={() => copyLink(inv.code)} title="Copiar enlace">
                    {copied === inv.code ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(inv)} title="Eliminar invitación">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
