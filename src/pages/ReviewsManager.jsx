import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { getPlanStatus } from "@/lib/plan-utils";
import PlanGate from "@/components/PlanGate";
import { Loader2, Star, Send, Plus, MessageCircle, Mail, Ban, RotateCcw, Check, ExternalLink } from "lucide-react";

const STATUS_CONFIG = {
  pending: { label: "Pendiente", bgSoft: "bg-slate-100", text: "text-slate-600" },
  sent: { label: "Enviada", bgSoft: "bg-blue-50", text: "text-blue-700" },
  received: { label: "Respondida", bgSoft: "bg-emerald-50", text: "text-emerald-700" },
  declined: { label: "Sin respuesta", bgSoft: "bg-amber-50", text: "text-amber-700" },
};

function defaultMessage(firstName) {
  return `¡Hola ${firstName || ""}! Gracias por tu visita. ¿Nos dejarías una reseña? Tu opinión nos ayuda mucho.`;
}

// Acepta tanto un link completo (el que copian de "Conseguir más reseñas" en su Perfil de
// Negocio de Google, o cualquier link de compartir de Maps) como un Place ID pelado
// (ej. "ChIJN1t_tDeuEmsRUsoyG83frY4") — si no empieza con http, asumimos que es el Place ID
// y armamos nosotros el link de reseña directa.
function normalizeGoogleReviewLink(raw) {
  const trimmed = (raw || "").trim();
  if (!trimmed) return "";
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(trimmed)}`;
}

export default function ReviewsManager() {
  const { toast } = useToast();
  const { preset, settings, save } = usePracticeSettings();
  const planStatus = getPlanStatus(settings);
  const [reviews, setReviews] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState("");
  const [sending, setSending] = useState(false);
  const [googleLink, setGoogleLink] = useState("");
  const [savingLink, setSavingLink] = useState(false);
  const [linkSaved, setLinkSaved] = useState(false);

  useEffect(() => {
    setGoogleLink(settings?.google_review_link || "");
  }, [settings?.google_review_link]);

  const hasUnsavedLinkChange = googleLink.trim() !== (settings?.google_review_link || "");

  const saveGoogleLink = async () => {
    if (!hasUnsavedLinkChange) return;
    setSavingLink(true);
    try {
      const normalized = normalizeGoogleReviewLink(googleLink);
      await save({ google_review_link: normalized });
      setGoogleLink(normalized);
      setLinkSaved(true);
      setTimeout(() => setLinkSaved(false), 2500);
      toast({ title: "Link guardado" });
    } catch (err) {
      toast({ title: "No se pudo guardar el link", description: err.message, variant: "destructive" });
    } finally {
      setSavingLink(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const [revs, appts, pats] = await Promise.all([
        base44.entities.ReviewRequest.list("-created_date"),
        base44.entities.Appointment.filter({ status: "completed" }),
        base44.entities.Patient.filter({}),
      ]);
      setReviews(revs || []);
      setAppointments(appts || []);
      setPatients(pats || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (settings && planStatus.hasPaidPlan) load();
    else if (settings) setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, planStatus.hasPaidPlan]);

  const eligibleAppts = appointments.filter((a) => !reviews.some((r) => r.appointment_id === a.id));

  const createRequest = async () => {
    if (!selectedAppt) return;
    setSending(true);
    try {
      const appt = appointments.find((a) => a.id === selectedAppt);
      const patient = patients.find((p) => p.id === appt.patient_id);
      const firstName = patient?.first_name || appt.patient_name || "";
      await base44.entities.ReviewRequest.create({
        patient_id: appt.patient_id,
        patient_name: appt.patient_name,
        patient_phone: patient?.phone || "",
        patient_email: patient?.email || "",
        appointment_id: appt.id,
        service_name: appt.service_name,
        appointment_date: appt.start_datetime,
        status: "pending",
        request_message: defaultMessage(firstName),
        token: crypto.randomUUID(),
        disabled: false,
      });
      toast({ title: "Solicitud creada" });
      setOpen(false);
      setSelectedAppt("");
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  if (!planStatus.loaded) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!planStatus.hasPaidPlan) {
    return (
      <div className="px-3 py-3 md:p-6 max-w-3xl mx-auto space-y-4">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Reseñas</h1>
          <p className="text-sm text-muted-foreground">Pedí reseñas a tus pacientes y recibí sus respuestas</p>
        </div>
        <PlanGate
          feature="Reseñas"
          requiredPlan="basic"
          description="Pedir y recibir reseñas de tus pacientes, con invitación automática a repetirlas en Google, está disponible a partir del plan Básico."
        />
      </div>
    );
  }

  return (
    <div className="px-3 py-3 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-semibold tracking-tight">Reseñas</h1>
          <p className="text-sm text-muted-foreground">Pedí reseñas a tus {preset.patientLabel.toLowerCase()} y recibí sus respuestas</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={eligibleAppts.length === 0} className="shadow-sm shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Solicitar
        </Button>
      </div>

      <div className="rounded-2xl border border-border p-4 space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
            <Star className="w-4 h-4 text-amber-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium">Link de reseña en Google</p>
            <p className="text-xs text-muted-foreground">Quien deje 4-5 estrellas acá adentro va a ver un botón para repetirla en Google.</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            value={googleLink}
            onChange={(e) => setGoogleLink(e.target.value)}
            placeholder="Pegá el link completo, o solo el Place ID"
            className="text-sm"
          />
          <Button size="sm" onClick={saveGoogleLink} disabled={!hasUnsavedLinkChange || savingLink} className="shrink-0 gap-1.5">
            {savingLink ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : linkSaved ? <Check className="w-3.5 h-3.5" /> : null}
            {linkSaved ? "Guardado" : "Guardar"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Lo sacás de tu Perfil de Negocio de Google (business.google.com) → tarjeta "Conseguir más reseñas" → copiar link. También podés pegar solo el Place ID si lo tenés.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-4 border-border border-t-primary rounded-full animate-spin" />
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 px-4">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
            <MessageCircle className="w-5 h-5 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground text-sm max-w-xs mx-auto">
            Cuando completes una cita, se genera automáticamente una solicitud de reseña. También podés crearla manualmente.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {reviews.map((r) => (
            <ReviewCard key={r.id} review={r} onReload={load} />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Solicitar reseña</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Elegí una cita completada para pedirle una reseña a tu paciente.</p>
            <Select value={selectedAppt} onValueChange={setSelectedAppt}>
              <SelectTrigger><SelectValue placeholder="Seleccionar cita..." /></SelectTrigger>
              <SelectContent>
                {eligibleAppts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.patient_name} — {a.service_name} ({new Date(a.start_datetime).toLocaleDateString("es-AR")})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={createRequest} disabled={!selectedAppt || sending}>{sending && <Loader2 className="w-4 h-4 mr-1 animate-spin" />} Crear solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReviewCard({ review, onReload }) {
  const { toast } = useToast();
  const [message, setMessage] = useState(review.request_message || "");
  const [saving, setSaving] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [sendingWa, setSendingWa] = useState(false);

  useEffect(() => {
    setMessage(review.request_message || "");
  }, [review.id, review.request_message]);

  const phoneDigits = (review.patient_phone || "").replace(/\D/g, "");
  const reviewLink = `${typeof window !== "undefined" ? window.location.origin : ""}/r/${review.id}${review.token ? `?t=${review.token}` : ""}`;
  const fullText = `${message}\n${reviewLink}`;
  const waUrl = phoneDigits ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(fullText)}` : "";

  const saveMessage = async () => {
    if (message === (review.request_message || "")) return;
    setSaving(true);
    try {
      await base44.entities.ReviewRequest.update(review.id, { request_message: message });
      toast({ title: "Mensaje guardado" });
      onReload();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const sendEmail = async () => {
    if (!review.patient_email) {
      toast({ title: "Sin email", description: "Este paciente no tiene email cargado. Usá WhatsApp.", variant: "destructive" });
      return;
    }
    setSendingEmail(true);
    try {
      // Vía función de backend con Resend (no el SendEmail nativo de Base44, que solo le
      // llega a usuarios registrados de la app y nunca funcionó para pacientes reales).
      await base44.functions.invoke("sendReviewRequestEmail", { review_id: review.id });
      toast({ title: "Email enviado", description: "Cuando el paciente responda, vas a ver su reseña acá." });
      onReload();
    } catch (err) {
      toast({ title: "No se pudo enviar el email", description: err?.response?.data?.error || "Probá enviar por WhatsApp.", variant: "destructive" });
    } finally {
      setSendingEmail(false);
    }
  };

  const sendWhatsApp = async () => {
    if (!review.patient_phone) {
      toast({ title: "Sin teléfono", description: "Este paciente no tiene teléfono cargado.", variant: "destructive" });
      return;
    }
    setSendingWa(true);
    try {
      await base44.functions.invoke("zernioSendMessage", {
        phone: review.patient_phone,
        message: fullText,
      });
      await base44.entities.ReviewRequest.update(review.id, { status: "sent", sent_at: new Date().toISOString() });
      toast({ title: "WhatsApp enviado", description: "Cuando el paciente responda, vas a ver su reseña acá." });
      onReload();
    } catch (err) {
      toast({ title: "No se pudo enviar por WhatsApp", description: err?.response?.data?.error || err.message, variant: "destructive" });
    } finally {
      setSendingWa(false);
    }
  };

  const toggleDisabled = async () => {
    const next = !review.disabled;
    await base44.entities.ReviewRequest.update(review.id, { disabled: next });
    toast({ title: next ? "Envío desactivado" : "Envío reactivado" });
    onReload();
  };

  const isReceived = review.status === "received";
  const isDisabled = review.disabled;
  const cfg = STATUS_CONFIG[review.status] || STATUS_CONFIG.pending;

  return (
    <div className={`bg-card rounded-2xl border border-border p-4 ${isDisabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{review.patient_name}</p>
          <p className="text-xs text-muted-foreground">{review.service_name} · {review.appointment_date ? new Date(review.appointment_date).toLocaleDateString("es-AR") : "—"}</p>
        </div>
        <span className={`text-[11px] font-medium px-2 py-1 rounded-full shrink-0 ${cfg.bgSoft} ${cfg.text}`}>{cfg.label}</span>
      </div>

      {isReceived && (review.rating || review.review_text) && (
        <div className="mt-3 bg-muted/60 rounded-xl px-3 py-2.5">
          {review.rating ? (
            <div className="flex items-center gap-1 mb-1">
              {[...Array(review.rating)].map((_, i) => <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
            </div>
          ) : null}
          {review.review_text && <p className="text-sm italic text-foreground/80">"{review.review_text}"</p>}
        </div>
      )}

      {!isReceived && !isDisabled && (
        <div className="mt-3 space-y-2.5">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={saveMessage}
            rows={2}
            className="text-sm rounded-xl"
            placeholder="Mensaje para el paciente…"
          />
          {review.status === "sent" && (
            <p className="text-xs text-blue-600">Enviada — esperando respuesta del paciente.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" className="rounded-lg" onClick={sendWhatsApp} disabled={sendingWa}>
              {sendingWa ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />} Enviar WhatsApp
            </Button>
            {waUrl ? (
              <Button size="sm" variant="outline" className="rounded-lg" asChild>
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Abrir WhatsApp
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" className="rounded-lg" onClick={sendEmail} disabled={sendingEmail}>
              {sendingEmail ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />} Email
            </Button>
            <Button size="sm" variant="ghost" className="rounded-lg" onClick={toggleDisabled}>
              <Ban className="w-3.5 h-3.5 mr-1" /> Desactivar
            </Button>
            {saving && <span className="text-xs text-muted-foreground self-center">guardando…</span>}
          </div>
        </div>
      )}

      {isDisabled && (
        <div className="mt-3 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Envío desactivado para este paciente.</p>
          <Button size="sm" variant="ghost" className="rounded-lg" onClick={toggleDisabled}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reactivar
          </Button>
        </div>
      )}
    </div>
  );
}
