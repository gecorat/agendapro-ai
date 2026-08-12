import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarClock, MessageCircle, Bell, Calendar, Users, Check, Sparkles, ArrowRight } from "lucide-react";
import { PLAN_PRICES } from "@/lib/plan-utils";

const FEATURES = [
  { icon: MessageCircle, title: "Asistente de WhatsApp", desc: "Un bot conversacional agenda, confirma y recuerda citas por WhatsApp, 24/7." },
  { icon: Calendar, title: "Agenda inteligente", desc: "Disponibilidad, servicios y márgenes automáticos. Sin choques de horarios." },
  { icon: Bell, title: "Recordatorios automáticos", desc: "Reduce ausencias con recordatorios a tiempo y seguimientos post-consulta." },
  { icon: Users, title: "Página de reservas", desc: "Tus pacientes reservan solos desde tu enlace público. Sin llamadas." },
];

const PRO_FEATURES = [
  "Bot de WhatsApp con IA",
  "Agenda y reservas online",
  "Recordatorios automáticos",
  "Página pública de reservas",
  "Hasta 200 citas mensuales",
];

const PREMIUM_FEATURES = [
  "Todo lo de Pro",
  "Citas ilimitadas",
  "Bandeja de chats con toma de control",
  "Reportes y métricas avanzadas",
  "Soporte prioritario",
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold">AgendaPro</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/login">Ingresar</Link>
            </Button>
            <Button size="sm" asChild>
              <Link to="/register">Probar gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-4 py-12 md:py-20">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Recepcionista virtual con IA
          </div>
          <h1 className="text-3xl md:text-5xl font-heading font-bold tracking-tight">
            Tu agenda llena, sin atendé el teléfono
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            AgendaPro responde, agenda y recuerda las citas de tus pacientes por WhatsApp.
            Vos te dedicás a atender, el bot se encarga del resto.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link to="/register">Probar gratis 14 días <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">Ya tengo cuenta</Link>
            </Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Sin tarjeta de crédito. Configurás todo y probás el bot antes de pagar.</p>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-8 border-t border-border">
        <div className="max-w-5xl mx-auto grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <Card key={f.title} className="p-5">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-heading font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground mt-1">{f.desc}</p>
              </Card>
            );
          })}
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-12">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-center">Cómo funciona</h2>
          <div className="mt-8 space-y-6">
            {[
              { n: "1", t: "Configurá tu consultorio", d: "Elegí tu especialidad, cargá tus servicios y horarios. En 5 minutos está listo." },
              { n: "2", t: "Probá el bot con tus datos", d: "Simulá conversaciones reales con el bot usando tus propios servicios y agenda." },
              { n: "3", t: "Activá WhatsApp y recibí reservas", d: "Cuando estés listo, pasás a un plan pago y el bot responde a tus pacientes de verdad." },
            ].map((s) => (
              <div key={s.n} className="flex gap-4">
                <div className="shrink-0 w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold text-sm">{s.n}</div>
                <div>
                  <h3 className="font-heading font-semibold">{s.t}</h3>
                  <p className="text-sm text-muted-foreground mt-0.5">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="px-4 py-12 border-t border-border">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-center">Planes simples</h2>
          <p className="text-center text-muted-foreground mt-2">Probás gratis 14 días. Después elegís.</p>
          <div className="mt-8 grid md:grid-cols-2 gap-4">
            <Card className="p-6 flex flex-col">
              <div className="flex items-center gap-2">
                <span className="font-heading font-semibold text-lg">Pro</span>
                <span className="text-xs rounded-full bg-primary/10 text-primary px-2 py-0.5 font-medium">Más popular</span>
              </div>
              <p className="text-3xl font-heading font-bold mt-2">{PLAN_PRICES.pro}<span className="text-sm font-normal text-muted-foreground"> ARS / mes</span></p>
              <ul className="mt-4 space-y-2.5 flex-1">
                {PRO_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-6" asChild><Link to="/register">Empezar prueba</Link></Button>
            </Card>
            <Card className="p-6 flex flex-col border-2 border-primary">
              <div className="flex items-center gap-2">
                <span className="font-heading font-semibold text-lg">Premium</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-heading font-bold mt-2">{PLAN_PRICES.premium}<span className="text-sm font-normal text-muted-foreground"> ARS / mes</span></p>
              <ul className="mt-4 space-y-2.5 flex-1">
                {PREMIUM_FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}
                  </li>
                ))}
              </ul>
              <Button className="mt-6" asChild><Link to="/register">Empezar prueba</Link></Button>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-heading font-bold">Empezá hoy, sin compromiso</h2>
          <p className="text-muted-foreground mt-2">Configurá tu consultorio y probá el bot. Sin tarjeta, sin letras chicas.</p>
          <Button size="lg" className="mt-6" asChild>
            <Link to="/register">Crear cuenta gratis <ArrowRight className="w-4 h-4 ml-1" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border px-4 py-6 text-center text-xs text-muted-foreground">
        AgendaPro · Recepcionista virtual para profesionales de la salud
      </footer>
    </div>
  );
}