import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Star, Check, Loader2, CalendarClock } from "lucide-react";

export default function PublicReview() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await base44.functions.invoke("publicReview", { action: "get", id });
        const d = res.data;
        if (d?.error) { setError(d.error); }
        else {
          setData(d);
          if (d.status === "received") setDone(true);
        }
      } catch {
        setError("No se pudo cargar la solicitud.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  async function submit() {
    if (rating < 1) return;
    setSubmitting(true);
    try {
      const res = await base44.functions.invoke("publicReview", { action: "submit", id, rating, review_text: text });
      if (res.data?.error) { setError(res.data.error); }
      else { setDone(true); }
    } catch {
      setError("No se pudo enviar. Intentá de nuevo.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  const brand = data?.page_color || "#0f172a";

  if (error && !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-center">
        <div>
          <CalendarClock className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-heading font-semibold">{error}</p>
          <p className="text-sm text-muted-foreground mt-1">El enlace puede haber expirado o no ser válido.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="w-full" style={{ backgroundColor: brand }}>
        <div className="max-w-lg mx-auto px-4 py-8 text-center text-white">
          <h1 className="text-xl font-heading font-semibold">{data?.practice_name || "Reseña"}</h1>
          {data?.service_name && <p className="text-sm text-white/80 mt-1">{data.service_name}</p>}
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6">
        <Card className="p-6 text-center space-y-4">
          {done ? (
            <>
              <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                <Check className="w-7 h-7 text-emerald-600" />
              </div>
              <h2 className="font-heading font-semibold text-lg">¡Gracias por tu reseña!</h2>
              <p className="text-sm text-muted-foreground">Tu opinión nos ayuda a seguir mejorando.</p>
            </>
          ) : (
            <>
              <div>
                <h2 className="font-heading font-semibold text-lg">¿Cómo fue tu experiencia?</h2>
                <p className="text-sm text-muted-foreground mt-1">Tu opinión ayuda a otros pacientes y al profesional.</p>
              </div>
              <div className="flex justify-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onMouseEnter={() => setHover(n)}
                    onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                  >
                    <Star
                      className={`w-9 h-9 transition-colors ${(hover || rating) >= n ? "fill-amber-400 text-amber-400" : "text-slate-300"}`}
                    />
                  </button>
                ))}
              </div>
              <Textarea
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Contanos cómo te fue (opcional)…"
                rows={4}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button className="w-full" style={{ backgroundColor: brand }} disabled={!rating || submitting} onClick={submit}>
                {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Enviar reseña
              </Button>
              <p className="text-xs text-muted-foreground">Tus datos no se publican públicamente.</p>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}