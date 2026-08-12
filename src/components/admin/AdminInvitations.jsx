import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, Copy, Check, Plus, Mail, Trash2 } from "lucide-react";

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase() + Date.now().toString(36).slice(-4).toUpperCase();
}

export default function AdminInvitations() {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState("");
  const [label, setLabel] = useState("");
  const [copied, setCopied] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      setInvitations((await base44.entities.Invitation.list("-created_date")) || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

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
      setEmail("");
      setLabel("");
      toast({ title: "Invitación creada" });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
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
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="iemail">Email del invitado (opcional)</Label>
              <Input id="iemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prospecto@email.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ilabel">Etiqueta</Label>
              <Input id="ilabel" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ej. Clínica Norte" />
            </div>
          </div>
          <Button type="submit" disabled={creating}>
            {creating && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Generar enlace
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
              <div key={inv.id} className="p-3 rounded-lg border border-border flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">
                    {inv.email ? <><Mail className="w-3.5 h-3.5 inline mr-1" />{inv.email}</> : inv.label || "Invitación"}
                  </p>
                  <p className="text-xs text-muted-foreground font-mono">Código: {inv.code}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${inv.status === "used" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                    {inv.status === "used" ? "Usada" : "Pendiente"}
                  </span>
                  <Button size="sm" variant="outline" onClick={() => copyLink(inv.code)}>
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