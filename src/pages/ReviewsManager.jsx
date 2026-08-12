import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { Loader2, Star, Send, Plus, MessageCircle, Mail, Ban, RotateCcw } from "lucide-react";

const STATUS_LABELS = { pending: "Pendiente", sent: "Enviada", received: "Respondida", declined: "Sin respuesta" };
const STATUS_STYLES = { pending: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", received: "bg-emerald-100 text-emerald-700", declined: "bg-amber-100 text-amber-700" };

function defaultMessage(firstName) {
  return `¡Hola ${firstName || ""}! Gracias por tu visita. ¿Nos dejarías una reseña? Tu opinión nos ayuda mucho.`;
}

export default function ReviewsManager() {
  const { toast } = useToast();
  const { preset } = usePracticeSettings();
  const [reviews, setReviews] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState("");
  const [sending, setSending] = useState(false);

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

  useEffect(() => { load(); }, []);

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

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-semibold">Reseñas</h1>
          <p className="text-sm text-muted-foreground">Pedí reseñas a tus {preset.patientLabel.toLowerCase()} y recibí sus respuestas</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={eligibleAppts.length === 0}><Plus className="w-4 h-4 mr-1" /> Solicitar</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Cuando completes una cita, se genera automáticamente una solicitud de reseña. También podés crearla manualmente.
        </Card>
      ) : (
        <div className="space-y-2">
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
      await base44.integrations.Core.SendEmail({
        to: review.patient_email,
        subject: "¿Nos dejás tu reseña?",
        body: `${message}\n\nDejanos tu reseña acá: ${reviewLink}`,
      });
      await base44.entities.ReviewRequest.update(review.id, { status: "sent", sent_at: new Date().toISOString() });
      toast({ title: "Email enviado", description: "Cuando el paciente responda, vas a ver su reseña acá." });
      onReload();
    } catch (err) {
      toast({ title: "No se pudo enviar el email", description: "Es posible que tu plan no permita enviar a este destinatario. Usá WhatsApp como alternativa.", variant: "destructive" });
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
      const res = await base44.functions.invoke("zernioSendMessage", {
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

  return (
    <Card className={`p-3 ${isDisabled ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium truncate">{review.patient_name}</p>
          <p className="text-xs text-muted-foreground">{review.service_name} · {review.appointment_date ? new Date(review.appointment_date).toLocaleDateString("es-AR") : "—"}</p>
        </div>
        <Badge className={STATUS_STYLES[review.status] || ""}>{STATUS_LABELS[review.status]}</Badge>
      </div>

      {isReceived && (review.rating || review.review_text) && (
        <div className="mt-2 bg-accent/50 rounded px-2 py-1.5">
          {review.rating ? (
            <div className="flex items-center gap-1 mb-0.5">
              {[...Array(review.rating)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
            </div>
          ) : null}
          {review.review_text && <p className="text-xs italic">"{review.review_text}"</p>}
        </div>
      )}

      {!isReceived && !isDisabled && (
        <div className="mt-2 space-y-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={saveMessage}
            rows={2}
            className="text-sm"
            placeholder="Mensaje para el paciente…"
          />
          {review.status === "sent" && (
            <p className="text-xs text-blue-600">Enviada — esperando respuesta del paciente.</p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={sendWhatsApp} disabled={sendingWa}>
              {sendingWa ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Send className="w-3.5 h-3.5 mr-1" />} Enviar WhatsApp
            </Button>
            {waUrl ? (
              <Button size="sm" variant="outline" asChild>
                <a href={waUrl} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="w-3.5 h-3.5 mr-1 text-emerald-600" /> Abrir WhatsApp
                </a>
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={sendEmail} disabled={sendingEmail}>
              {sendingEmail ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Mail className="w-3.5 h-3.5 mr-1" />} Email
            </Button>
            <Button size="sm" variant="ghost" onClick={toggleDisabled}>
              <Ban className="w-3.5 h-3.5 mr-1" /> Desactivar
            </Button>
            {saving && <span className="text-xs text-muted-foreground self-center">guardando…</span>}
          </div>
        </div>
      )}

      {isDisabled && (
        <div className="mt-2 flex items-center justify-between">
          <p className="text-xs text-muted-foreground">Envío desactivado para este paciente.</p>
          <Button size="sm" variant="ghost" onClick={toggleDisabled}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reactivar
          </Button>
        </div>
      )}
    </Card>
  );
}