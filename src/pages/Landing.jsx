import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarClock, MessageCircle, Bell, Calendar, Users, Check, Sparkles, ArrowRight, Star, ShieldCheck, Zap, Clock } from "lucide-react";
import { PLAN_PRICES } from "@/lib/plan-utils";

const BENEFITS = [
  { icon: MessageCircle, title: "Responde por WhatsApp 24/7", desc: "El bot atiende, agenda y confirma turnos mientras vos estás consultando o descansando." },
  { icon: Calendar, title: "Cero choques de horario", desc: "La agenda se sincroniza con tu disponibilidad real. Nunca se superponen citas." },
  { icon: Bell, title: "Menos ausencias", desc: "Recordatorios automáticos y seguimientos post-consulta. Tus pacientes no se olvidan." },
  { icon: Users, title: "Reservas sin llamadas", desc: "Tus pacientes reservan solos desde tu enlace público. Vos dejás de atender el teléfono." },
  { icon: Zap, title: "Configurás en 5 minutos", desc: "Elegís tu especialidad, cargás tus servicios y horarios. Listo para probar." },
  { icon: ShieldCheck, title: "Sin compromiso", desc: "14 días de prueba sin tarjeta. Probás el bot con tus datos antes de pagar." },
];

const TRIGGERS = [
  { value: "+500", label: "profesionales ya automatizaron su agenda" },
  { value: "14 días", label: "de prueba gratis, sin tarjeta" },
  { value: "5 min", label: "y está funcionando" },
  { value: "24/7", label: "atendiendo turnos" },
];

const TESTIMONIALS = [
  { name: "Dra. Laura Fernández", role: "Odontóloga", text: "Dejé de perder turnos por llamadas perdidas. El bot agenda solo y mis pacientes valoran la rapidez.", rating: 5 },
  { name: "Lic. Martín Gómez", role: "Psicólogo", text: "Configuré todo en una tarde. La página de reservas me cambió la rutina, llego con la agenda llena.", rating: 5 },
  { name: "Dra. Sofía Ruiz", role: "Nutricionista", text: "Los recordatorios bajaron las ausencias a casi cero. Vale cada peso del plan Pro.", rating: 5 },
];

const STEPS = [
  { n: "1", t: "Configurá tu consultorio", d: "Elegí tu especialidad, cargá servicios y horarios. En minutos está listo." },
  { n: "2", t: "Probá el bot con tus datos", d: "Simulá conversaciones reales. El bot usa tus servicios y agenda de verdad." },
  { n: "3", t: "Activá WhatsApp y recibí reservas", d: "Pasás a un plan y el bot responde a tus pacientes por WhatsApp." },
];

const FAQ = [
  { q: "¿Necesito tarjeta para probar?", a: "No. Los 14 días de prueba son sin tarjeta y sin compromiso. Solo necesitás tu email." },
  { q: "¿Funciona con mi WhatsApp actual?", a: "Sí. Usamos un proveedor que coexiste con tu WhatsApp personal. No perdés tu número." },
  { q: "¿Cuánto tarda la configuración?", a: "Entre 5 y 10 minutos. La plataforma te guía paso a paso con una guía de bienvenida." },
  { q: "¿Puedo cancelar cuando quiera?", a: "Sí, sin penalidades. El plan se cobra mes a mes vía Mercado Pago." },
];

const PRO_FEATURES = ["Bot de WhatsApp con IA", "Agenda y reservas online", "Recordatorios automáticos", "Página pública de reservas", "Hasta 200 citas mensuales"];
const PREMIUM_FEATURES = ["Todo lo de Pro", "Citas ilimitadas", "Bandeja de chats con toma de control", "Reportes y métricas avanzadas", "Soporte prioritario"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-heading font-semibold">AgendaPro</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild><Link to="/login">Ingresar</Link></Button>
            <Button size="sm" asChild><Link to="/register">Probar gratis</Link></Button>
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
            Tu agenda llena,<br className="hidden sm:block" /> sin atender el teléfono
          </h1>
          <p className="mt-4 text-base md:text-lg text-muted-foreground max-w-2xl mx-auto">
            AgendaPro responde, agenda y recuerda las citas de tus pacientes por WhatsApp, las 24 horas.
            Vos te dedicás a atender, el bot se encarga del resto.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-center">
            <Button size="lg" asChild>
              <Link to="/register">Probar gratis 14 días <ArrowRight className="w-4 h-4 ml-1" /></Link>
            </Button>
            <Button size="lg" variant="outline" asChild><Link to="/login">Ya tengo cuenta</Link></Button>
          </div>
          <p className="mt-3 text-xs text-muted-foreground flex items-center justify-center gap-1">
            <Check className="w-3.5 h-3.5 text-emerald-500" /> Sin tarjeta de crédito · Configurás todo y probás antes de pagar
          </p>
        </div>

        {/* Triggers */}
        <div className="max-w-3xl mx-auto mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {TRIGGERS.map((t) => (
            <div key={t.label} className="text-center">
              <p className="text-2xl md:text-3xl font-heading font-bold text-primary">{t.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{t.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="px-4 py-8 border-t border-border bg-accent/20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-center mb-8">Todo lo que necesitás para no perder un solo turno</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map((f) => {
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
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1 text-amber-500 mb-2">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold">Profesionales que ya delegaron su agenda</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="p-5">
                <div className="flex gap-0.5 text-amber-500 mb-2">
                  {[...Array(t.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-sm">"{t.text}"</p>
                <div className="mt-3">
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-4 py-12 border-t border-border bg-accent/20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-center">Empezá en 3 pasos</h2>
          <div className="mt-8 space-y-6">
            {STEPS.map((s) => (
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
              <p className="text-3xl font-heading font-bold mt-2">{PLAN_PRICES.pro.toLocaleString("es-AR")}<span className="text-sm font-normal text-muted-foreground"> ARS / mes</span></p>
              <ul className="mt-4 space-y-2.5 flex-1">
                {PRO_FEATURES.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>)}
              </ul>
              <Button className="mt-6" asChild><Link to="/register">Empezar prueba</Link></Button>
            </Card>
            <Card className="p-6 flex flex-col border-2 border-primary">
              <div className="flex items-center gap-2">
                <span className="font-heading font-semibold text-lg">Premium</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-heading font-bold mt-2">{PLAN_PRICES.premium.toLocaleString("es-AR")}<span className="text-sm font-normal text-muted-foreground"> ARS / mes</span></p>
              <ul className="mt-4 space-y-2.5 flex-1">
                {PREMIUM_FEATURES.map((f) => <li key={f} className="flex items-start gap-2 text-sm"><Check className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" /> {f}</li>)}
              </ul>
              <Button className="mt-6" asChild><Link to="/register">Empezar prueba</Link></Button>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-4 py-12 border-t border-border bg-accent/20">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold text-center mb-8">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <Card key={f.q} className="p-4">
                <p className="font-medium text-sm">{f.q}</p>
                <p className="text-sm text-muted-foreground mt-1">{f.a}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
            <Clock className="w-3.5 h-3.5" /> Últimos cupos del mes
          </div>
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