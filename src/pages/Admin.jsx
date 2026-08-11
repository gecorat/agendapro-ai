import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/use-toast";
import { UserPlus, Shield, Bot, Loader2 } from "lucide-react";

const MODELS = [
  { value: "automatic", label: "Automático (recomendado)" },
  { value: "gemini_3_flash", label: "Gemini 3 Flash — rápido, con búsqueda web" },
  { value: "gpt_5_mini", label: "GPT-5 Mini" },
  { value: "gpt_5_4", label: "GPT-5.4" },
  { value: "claude_sonnet_4_6", label: "Claude Sonnet 4.6 — avanzado" },
];

export default function Admin() {
  const { toast } = useToast();
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);

  const [botConfig, setBotConfig] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("automatic");
  const [loadingBot, setLoadingBot] = useState(true);
  const [savingBot, setSavingBot] = useState(false);

  const loadUsers = async () => {
    try {
      setUsers((await base44.entities.User.list()) || []);
    } finally {
      setLoadingUsers(false);
    }
  };

  const loadBot = async () => {
    try {
      const list = await base44.entities.BotConfig.filter({});
      const cfg = list?.[0] || null;
      setBotConfig(cfg);
      setPrompt(cfg?.system_prompt || "");
      setModel(cfg?.model || "automatic");
    } finally {
      setLoadingBot(false);
    }
  };

  useEffect(() => { loadUsers(); loadBot(); }, []);

  const handleInvite = async (e) => {
    e.preventDefault();
    if (!inviteEmail) return;
    setInviting(true);
    try {
      await base44.users.inviteUser(inviteEmail, inviteRole);
      toast({ title: "Invitación enviada", description: `Se envió a ${inviteEmail}` });
      setInviteEmail("");
      loadUsers();
    } catch (err) {
      toast({ title: "Error al invitar", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await base44.entities.User.update(userId, { role: newRole });
      toast({ title: "Rol actualizado" });
      loadUsers();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  const handleSaveBot = async () => {
    setSavingBot(true);
    try {
      if (botConfig) {
        await base44.entities.BotConfig.update(botConfig.id, { system_prompt: prompt, model });
      } else {
        const created = await base44.entities.BotConfig.create({ system_prompt: prompt, model, active: true });
        setBotConfig(created);
      }
      toast({ title: "Configuración del bot guardada" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingBot(false);
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-semibold flex items-center gap-2">
          <Shield className="w-6 h-6" /> Administración
        </h1>
        <p className="text-sm text-muted-foreground">Gestión de usuarios y configuración del bot de IA</p>
      </div>

      <Tabs defaultValue="users">
        <TabsList className="w-full">
          <TabsTrigger value="users" className="flex-1"><UserPlus className="w-4 h-4 mr-1" /> Usuarios</TabsTrigger>
          <TabsTrigger value="bot" className="flex-1"><Bot className="w-4 h-4 mr-1" /> Bot</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4 mt-4">
          <Card className="p-4">
            <h2 className="font-heading font-semibold mb-3">Invitar usuario</h2>
            <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-2">
              <Input type="email" placeholder="email@ejemplo.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} required />
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Profesional</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
              <Button type="submit" disabled={inviting}>
                {inviting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Invitar
              </Button>
            </form>
          </Card>

          <Card className="p-4">
            <h2 className="font-heading font-semibold mb-3">Usuarios ({users.length})</h2>
            {loadingUsers ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2">
                {users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-3 rounded-lg border border-border gap-3">
                    <div className="min-w-0">
                      <p className="font-medium truncate">{u.full_name || u.email}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                    </div>
                    <Select value={u.role} onValueChange={(v) => handleRoleChange(u.id, v)}>
                      <SelectTrigger className="w-36 shrink-0"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">Profesional</SelectItem>
                        <SelectItem value="admin">Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="bot" className="space-y-4 mt-4">
          <Card className="p-4 space-y-4">
            <div>
              <h2 className="font-heading font-semibold flex items-center gap-2"><Bot className="w-5 h-5" /> Configuración del bot</h2>
              <p className="text-sm text-muted-foreground">Entrená al asistente con instrucciones y elegí el modelo de IA. Esta sección solo la ve el admin.</p>
            </div>
            {loadingBot ? (
              <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Modelo de IA</Label>
                  <Select value={model} onValueChange={setModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MODELS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Instrucciones (system prompt)</Label>
                  <Textarea
                    rows={10}
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder={"Sos la asistente virtual del consultorio de [nombre]. Tu objetivo es agendar, confirmar y reprogramar citas. Cuando un paciente pida turno, pedí: tipo de servicio, día y horario preferido. Verificá disponibilidad y creá la cita. Sé amable, breve y profesional. No des información médica."}
                  />
                  <p className="text-xs text-muted-foreground">Definí la personalidad, el objetivo y las reglas del bot.</p>
                </div>
                <Button onClick={handleSaveBot} disabled={savingBot || !prompt}>
                  {savingBot && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Guardar configuración
                </Button>
              </>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}