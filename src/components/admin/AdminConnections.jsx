import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, CreditCard, MessageCircle, Bot, Save, Eye, EyeOff, Copy, Check, QrCode } from "lucide-react";

const MODELS = [
  { value: "automatic", label: "Automático (recomendado)" },
  { value: "gemini_3_flash", label: "Gemini 3 Flash — rápido, con búsqueda web" },
  { value: "gpt_5_mini", label: "GPT-5 Mini" },
  { value: "gpt_5_4", label: "GPT-5.4" },
  { value: "claude_sonnet_4_6", label: "Claude Sonnet 4.6 — avanzado" },
];

// Campo de texto sensible (tokens/claves): arranca VISIBLE (type="text") a propósito —
// usar type="password" desde el principio causaba que el pegado no se registrara bien en
// algunos navegadores con gestor de contraseñas activo (confirmado: el valor se veía en
// pantalla pero nunca llegaba a guardarse en la base). Con "ojito" para ocultarlo después
// si se quiere, pero el primer pegado siempre es sobre un input de texto normal.
function SecretField({ id, value, onChange, placeholder }) {
  const [visible, setVisible] = useState(true);
  return (
    <div className="relative">
      <Input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pr-10 font-mono text-sm"
        autoComplete="off"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        title={visible ? "Ocultar" : "Mostrar"}
      >
        {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

export default function AdminConnections() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [plat, setPlat] = useState(null);
  const [mpToken, setMpToken] = useState("");
  const [mpKey, setMpKey] = useState("");
  const [zernioKey, setZernioKey] = useState("");
  const [zernioAccountId, setZernioAccountId] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [evolutionBaseUrl, setEvolutionBaseUrl] = useState("");
  const [evolutionApiKey, setEvolutionApiKey] = useState("");
  const [previewLimit, setPreviewLimit] = useState(20);

  const [botConfig, setBotConfig] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [model, setModel] = useState("automatic");
  const [webhookCopied, setWebhookCopied] = useState(false);

  // Esta es la URL real que funciona (probada en vivo durante toda la integración): antes
  // acá se mostraba "{origin}/api/functions/zernioWebhook", que no es una ruta válida — si
  // alguien la había cargado en Zernio, los mensajes de WhatsApp nunca iban a llegar.
  const webhookUrl = "https://base44.app/api/apps/6a726ce53f9d0f63f3816283/functions/zernioWebhook";
  const evolutionWebhookUrlHint = "https://base44.app/api/apps/6a726ce53f9d0f63f3816283/functions/evolutionWebhook?practiceId=<se completa solo por profesional>&secret=<idem>";

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setWebhookCopied(true);
      setTimeout(() => setWebhookCopied(false), 2000);
    } catch { /* noop */ }
  };

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
      setZernioAccountId(p?.zernio_account_id || "");
      setWebhookSecret(p?.zernio_webhook_secret || "");
      setEvolutionBaseUrl(p?.evolution_base_url || "");
      setEvolutionApiKey(p?.evolution_api_key || "");

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
        zernio_account_id: zernioAccountId,
        zernio_webhook_secret: webhookSecret,
        evolution_base_url: evolutionBaseUrl,
        evolution_api_key: evolutionApiKey,
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
            <SecretField id="mptoken" value={mpToken} onChange={(e) => setMpToken(e.target.value)} placeholder="APP_USR-..." />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="mpkey">Public Key</Label>
            <SecretField id="mpkey" value={mpKey} onChange={(e) => setMpKey(e.target.value)} placeholder="APP_USR-..." />
          </div>
        </div>
      </Card>

      {/* Zernio */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold">Proveedor de WhatsApp (Zernio)</h2>
        </div>
        <p className="text-sm text-muted-foreground">Credenciales del proveedor de WhatsApp. El Account ID vincula los mensajes entrantes al profesional correcto.</p>
        <div className="space-y-1.5">
          <Label htmlFor="zkey">API Key</Label>
          <SecretField id="zkey" value={zernioKey} onChange={(e) => setZernioKey(e.target.value)} placeholder="zrn_..." />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zacc">Account ID (referencia interna / testing)</Label>
          <Input id="zacc" value={zernioAccountId} onChange={(e) => setZernioAccountId(e.target.value)} placeholder="acc_..." />
          <p className="text-xs text-muted-foreground">Solo referencia para el admin. Cada profesional genera el suyo automáticamente al conectar su WhatsApp; este campo no lo toca el profesional.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zsecret">Webhook Secret</Label>
          <SecretField id="zsecret" value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} placeholder="secreto compartido (opcional)" />
          <p className="text-xs text-muted-foreground">Opcional pero recomendado. Configurá el mismo valor en el dashboard de Zernio al crear el webhook.</p>
        </div>
        <div className="space-y-1.5 rounded-lg bg-accent/50 p-3">
          <Label>URL del webhook</Label>
          <div className="flex items-center gap-2">
            <p className="text-xs text-muted-foreground break-all font-mono flex-1">{webhookUrl}</p>
            <Button type="button" size="sm" variant="outline" onClick={copyWebhookUrl} className="shrink-0">
              {webhookCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Configurá esta URL en Zernio → Webhooks con el evento <strong>message.received</strong>.</p>
        </div>
      </Card>

      {/* Evolution API (QR) */}
      <Card className="p-4 space-y-3">
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-primary" />
          <h2 className="font-heading font-semibold">Conexión rápida por QR (Evolution API)</h2>
        </div>
        <p className="text-sm text-muted-foreground">Alternativa sin verificación de Meta, corriendo en tu propio servidor (Evolution API self-hosted). Cada profesional que conecta por QR genera su propia instancia automáticamente; estas credenciales son únicas y globales para toda la plataforma.</p>
        <div className="space-y-1.5">
          <Label htmlFor="evobaseurl">Base URL</Label>
          <Input id="evobaseurl" value={evolutionBaseUrl} onChange={(e) => setEvolutionBaseUrl(e.target.value)} placeholder="https://evolution.tudominio.com" />
          <p className="text-xs text-muted-foreground">La URL de tu instancia de Evolution API en el VPS (sin barra al final).</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="evoapikey">Global API Key</Label>
          <SecretField id="evoapikey" value={evolutionApiKey} onChange={(e) => setEvolutionApiKey(e.target.value)} placeholder="La AUTHENTICATION_API_KEY de tu .env de Evolution" />
          <p className="text-xs text-muted-foreground">Habilita el botón "Conectar con QR" para todos los profesionales. Es la misma key que configuraste como AUTHENTICATION_API_KEY al levantar Evolution API en tu VPS.</p>
        </div>
        <div className="space-y-1.5 rounded-lg bg-accent/50 p-3">
          <Label>URL de webhook (se genera automáticamente por profesional)</Label>
          <p className="text-xs text-muted-foreground break-all font-mono">{evolutionWebhookUrlHint}</p>
          <p className="text-xs text-muted-foreground mt-1">No hace falta configurar nada manualmente en Evolution API — se arma solo al crear cada instancia.</p>
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
          <Label>Instrucciones (system prompt) — fallback de plataforma</Label>
          <p className="text-xs text-muted-foreground -mt-1">Cada consultorio ahora tiene su propio "Objetivo" y "Tono" editables en Ajustes → Bot (con su propio predeterminado). Este campo solo se usa como último respaldo para consultorios que nunca personalizaron el suyo.</p>
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