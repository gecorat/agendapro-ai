import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CreditCard, MessageCircle, Bot, Save } from "lucide-react";

const MODELS = [
  { value: "automatic", label: "Automático (recomendado)" },
  { value: "gemini_3_flash", label: "Gemini 3 Flash — rápido, con búsqueda web" },
  { value: "gpt_5_mini", label: "GPT-5 Mini" },
  { value: "gpt_5_4", label: "GPT-5.4" },
  { value: "claude_sonnet_4_6", label: "Claude Sonnet 4.6 — avanzado" },
];

export default function AdminConnections() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [plat, setPlat] = useState(null);
  const [mpToken, setMpToken] = useState("");
  const [mpKey, setMpKey] = useState("");
  const [zernioKey, setZernioKey] = useState("");
  const [previewLimit, setPreviewLimit] = useState(20);

  const [botConfig, setBotConfig] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("automatic");

  const load = async () => {
    setLoading(true);
    try {
      const [platList, botList] = await Promise.all([
        base44.entities.PlatformConfig.filter({}),
        base44.entities.BotConfig.filter({}),
      ]);
      const p = platList?.[0] || null;
      setPlat(p);
      setMpToken(p?.mercadopago_access_token || "");
      setMpKey(p?.mercadopago_public_key || "");
      setZernioKey(p?.zernio_api_key || "");

      const b = botList?.[0] || null;
      setBotConfig(b);
      setPrompt(b?.system_prompt || "");
      setModel(b?.model || "automatic");
      setPreviewLimit(b?.bot_preview_limit ?? 20);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const savePlatform = async () => {
    setSaving(true);
    try {
      const data = {
        mercadopago_access_token: mpToken,
        mercadopago_public_key: mpKey,
        zernio_api_key: zernioKey,
      };
      if (plat) {
        await base44.entities.PlatformConfig.update(plat.id, data);
      } else {
        const created = await base44.entities.PlatformConfig.create(data);
        setPlat(created);
      }
      toast({ title: "Conexiones guardadas" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const saveBot = async () => {
    setSaving(true);
    try {
      const botData = { system_prompt: prompt, model, bot_preview_limit: Number(previewLimit) || 20 };
      if (botConfig) {
        await base44.entities.BotConfig.update(botConfig.id, botData);
      } else {
        const created = await base44.entities.BotConfig.create({ ...botData, active: true });
        setBotConfig(created);
      }
      toast({ title: "Configuración del bot guardada" });
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* Mercado Pago */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold">Mercado Pago</h2>
        </div>
        <p className="text-sm text-muted-foreground">Credenciales para cobrar la recurrencia. La integración de cobro se habilita próximamente.</p>
        <div className="space-y-2">
          <div className="space-y-1.5">
            <Label htmlFor="mptoken">Access Token</Label>
            <Input id="mptoken" value={mpToken} onChange={(e) => setMpToken(e.target.value)} placeholder="APP_USR-..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mpkey">Public Key</Label>
            <Input id="mpkey" value={mpKey} onChange={(e) => setMpKey(e.target.value)} placeholder="APP_USR-..." />
          </div>
        </div>
      </Card>

      {/* Zernio */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold">Proveedor de WhatsApp (Zernio)</h2>
        </div>
        <p className="text-sm text-muted-foreground">API key del proveedor a nivel plataforma. La conexión por profesional se habilita con el plan Pro.</p>
        <div className="space-y-1.5">
          <Label htmlFor="zkey">API Key</Label>
          <Input id="zkey" value={zernioKey} onChange={(e) => setZernioKey(e.target.value)} placeholder="zrn_..." />
        </div>
      </Card>

      <Button onClick={savePlatform} disabled={saving}>
        {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} <Save className="w-4 h-4 mr-1" /> Guardar conexiones
      </Button>

      {/* Bot */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold">Bot de IA</h2>
        </div>
        <p className="text-sm text-muted-foreground">Instrucciones maestras y modelo. Solo el admin puede editar.</p>
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
            rows={8}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Sos la asistente virtual del consultorio. Tu objetivo es agendar, confirmar y reprogramar citas. Sé amable, breve y profesional. No des información médica."
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="limit">Tope de mensajes de la demo del bot</Label>
          <Input id="limit" type="number" value={previewLimit} onChange={(e) => setPreviewLimit(e.target.value)} />
        </div>
        <Button onClick={saveBot} disabled={saving || !prompt}>
          {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Guardar configuración del bot
        </Button>
      </Card>
    </div>
  );
}