import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { usePracticeSettings } from "@/hooks/usePracticeSettings";
import { Loader2, Star, Send, Plus, MessageCircle } from "lucide-react";

const STATUS_LABELS = { pending: "Pendiente", sent: "Enviada", received: "Respondida", declined: "Sin respuesta" };
const STATUS_STYLES = { pending: "bg-gray-100 text-gray-700", sent: "bg-blue-100 text-blue-700", received: "bg-emerald-100 text-emerald-700", declined: "bg-amber-100 text-amber-700" };

export default function ReviewsManager() {
  const { toast } = useToast();
  const { preset } = usePracticeSettings();
  const [reviews, setReviews] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState("");
  const [sending, setSending] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [revs, appts] = await Promise.all([
        base44.entities.ReviewRequest.list("-created_date"),
        base44.entities.Appointment.filter({ status: "completed" }),
      ]);
      setReviews(revs || []);
      setAppointments(appts || []);
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
      await base44.entities.ReviewRequest.create({
        patient_id: appt.patient_id,
        patient_name: appt.patient_name,
        appointment_id: appt.id,
        service_name: appt.service_name,
        appointment_date: appt.start_datetime,
        status: "pending",
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

  const sendRequest = async (rev) => {
    try {
      await base44.entities.ReviewRequest.update(rev.id, { status: "sent", sent_at: new Date().toISOString() });
      toast({ title: "Solicitud marcada como enviada", description: "Cuando WhatsApp esté activo, se enviará automáticamente." });
      load();
    } catch (err) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-heading font-semibold">Gestionar reseñas</h1>
          <p className="text-sm text-muted-foreground">Solicitudes de reseña enviadas a tus {preset.patientLabel.toLowerCase()}</p>
        </div>
        <Button onClick={() => setOpen(true)} disabled={eligibleAppts.length === 0}><Plus className="w-4 h-4 mr-1" /> Solicitar</Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : reviews.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
          Aún no generaste solicitudes de reseña. Cuando completes una cita, pedí una reseña a tu paciente.
        </Card>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <Card key={r.id} className="p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium truncate">{r.patient_name}</p>
                  <p className="text-xs text-muted-foreground">{r.service_name} · {r.appointment_date ? new Date(r.appointment_date).toLocaleDateString("es-AR") : "—"}</p>
                  {r.review_text && (
                    <div className="mt-2 bg-accent/50 rounded px-2 py-1.5">
                      <div className="flex items-center gap-1 mb-0.5">
                        {[...Array(r.rating || 0)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
                      </div>
                      <p className="text-xs italic">"{r.review_text}"</p>
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <Badge className={STATUS_STYLES[r.status] || ""}>{STATUS_LABELS[r.status]}</Badge>
                  {r.status === "pending" && (
                    <Button size="sm" variant="outline" onClick={() => sendRequest(r)}><Send className="w-3.5 h-3.5 mr-1" /> Enviar</Button>
                  )}
                </div>
              </div>
            </Card>
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