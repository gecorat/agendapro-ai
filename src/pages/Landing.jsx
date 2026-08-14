import React from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  CalendarClock, MessageCircle, Bell, Calendar, Users, Check, Sparkles,
  ArrowRight, Star, ShieldCheck, Zap, Clock, Phone, Stethoscope,
} from "lucide-react";
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

const BASIC_FEATURES = ["Página pública de reservas", "Agenda manual + calendario", "Gestión de pacientes", "Recordatorios por email"];
const PRO_FEATURES = ["Todo lo de Básico", "Bot de WhatsApp con IA", "Agenda y reservas online", "Recordatorios automáticos", "Hasta 200 citas mensuales"];
const PREMIUM_FEATURES = ["Todo lo de Pro", "Citas ilimitadas", "Bandeja de chats con toma de control", "Reportes y métricas avanzadas", "Soporte prioritario"];

export default function Landing() {
  return (
    <div className="min-h-screen bg-stone-50 text-slate-900 font-body antialiased">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-stone-50/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <CalendarClock className="w-4 h-4 text-white" />
            </div>
            <span className="font-heading font-semibold tracking-tight">AgendaPro</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" asChild className="text-slate-600 hover:text-slate-900"><Link to="/login">Ingresar</Link></Button>
            <Button size="sm" asChild className="bg-slate-900 hover:bg-slate-800">
              <Link to="/register">Probar gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="px-5 pt-14 pb-10 md:pt-20 md:pb-16">
        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div>
            <div className="inline-flex items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 mb-5 ring-1 ring-inset ring-indigo-100">
              <Sparkles className="w-3.5 h-3.5" /> Recepcionista virtual con IA
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-[3.25rem] font-heading font-bold tracking-tight leading-[1.08]">
              Tu agenda llena,<br className="hidden sm:block" /> sin atender el teléfono
            </h1>
            <p className="mt-5 text-base md:text-lg text-slate-600 max-w-xl leading-relaxed">
              AgendaPro responde, agenda y recuerda las citas de tus pacientes por WhatsApp, las 24 horas.
              Vos te dedicás a atender, el bot se encarga del resto.
            </p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
              <Button size="lg" asChild className="bg-slate-900 hover:bg-slate-800 h-11 px-6 text-sm">
                <Link to="/register">Probar gratis 14 días <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
              </Button>
              <Button size="lg" variant="outline" asChild className="h-11 px-6 border-slate-300 text-slate-700 hover:bg-white">
                <Link to="/login">Ya tengo cuenta</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-slate-500 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-emerald-600" /> Sin tarjeta de crédito · Configurás todo y probás antes de pagar
            </p>
          </div>

          {/* Visual mock */}
          <div className="relative lg:pl-6">
            <div className="absolute -inset-4 bg-gradient-to-br from-indigo-100/60 to-emerald-100/40 rounded-3xl blur-2xl" />
            <Card className="relative p-5 shadow-xl shadow-slate-200/60 border-slate-200 bg-white">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-xs text-slate-400">Próximas citas</p>
                  <p className="font-heading font-semibold text-sm">Hoy, Jueves 14</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Bot activo
                </div>
              </div>
              <div className="space-y-2.5">
                {[
                  { t: "09:30", n: "María González", s: "Limpieza dental", c: "bg-blue-500" },
                  { t: "11:00", n: "Carlos Pérez", s: "Consulta general", c: "bg-amber-500" },
                  { t: "15:30", n: "Ana Romero", s: "Control mensual", c: "bg-emerald-500" },
                ].map((a) => (
                  <div key={a.t} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-100 bg-slate-50/60">
                    <div className="text-xs font-medium text-slate-500 w-10">{a.t}</div>
                    <div className={`w-1 h-8 rounded-full ${a.c}`} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{a.n}</p>
                      <p className="text-xs text-slate-500 truncate">{a.s}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-lg bg-slate-900 p-3 text-white">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <MessageCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span className="text-xs font-medium">WhatsApp · 08:47</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  "Hola, necesito un turno para limpieza dental" →
                  <span className="text-white"> "Listo María, te agendé mañana a las 09:30. Te recuerdo media hora antes. 🦷"</span>
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Triggers */}
        <div className="max-w-5xl mx-auto mt-14 grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-slate-200 pt-10">
          {TRIGGERS.map((t) => (
            <div key={t.label} className="text-center">
              <p className="text-2xl md:text-3xl font-heading font-bold text-slate-900">{t.value}</p>
              <p className="text-xs text-slate-500 mt-1 leading-tight">{t.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="px-5 py-16 border-y border-slate-200 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight">Todo lo que necesitás para no perder un solo turno</h2>
            <p className="text-slate-500 mt-2 text-sm">Una plataforma pensada para profesionales de la salud, sin curva de aprendizaje.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {BENEFITS.map((f) => {
              const Icon = f.icon;
              return (
                <Card key={f.title} className="p-6 border-slate-200 hover:border-slate-300 hover:shadow-md transition-all bg-white">
                  <div className="w-11 h-11 rounded-xl bg-slate-900 flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-heading font-semibold text-[15px]">{f.title}</h3>
                  <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.desc}</p>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="px-5 py-16">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-1 text-amber-500 mb-2">
              {[...Array(5)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
            </div>
            <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight">Profesionales que ya delegaron su agenda</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t) => (
              <Card key={t.name} className="p-6 border-slate-200 bg-white">
                <div className="flex gap-0.5 text-amber-500 mb-3">
                  {[...Array(t.rating)].map((_, i) => <Star key={i} className="w-4 h-4 fill-current" />)}
                </div>
                <p className="text-[15px] text-slate-700 leading-relaxed">"{t.text}"</p>
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="font-medium text-sm">{t.name}</p>
                  <p className="text-xs text-slate-500">{t.role}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="px-5 py-16 border-y border-slate-200 bg-slate-900 text-white">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-center">Empezá en 3 pasos</h2>
          <div className="mt-10 space-y-7">
            {STEPS.map((s, i) => (
              <div key={s.n} className="flex gap-4">
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-white text-slate-900 flex items-center justify-center font-semibold text-sm">{s.n}</div>
                  {i < STEPS.length - 1 && <div className="absolute left-1/2 top-10 -translate-x-1/2 w-px h-7 bg-white/20" />}
                </div>
                <div className="pb-2">
                  <h3 className="font-heading font-semibold">{s.t}</h3>
                  <p className="text-sm text-slate-400 mt-1 leading-relaxed">{s.d}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precios" className="px-5 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight">Planes simples</h2>
            <p className="text-slate-500 mt-2 text-sm">Probás gratis 14 días. Después elegís.</p>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            <Card className="p-7 flex flex-col border border-slate-300 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading font-semibold text-lg">Básico</span>
              </div>
              <p className="text-3xl font-heading font-bold mt-3">{PLAN_PRICES.basic.toLocaleString("es-AR")}<span className="text-sm font-normal text-slate-500"> ARS / mes</span></p>
              <ul className="mt-5 space-y-3 flex-1">
                {BASIC_FEATURES.map((f) => <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {f}</li>)}
              </ul>
              <Button className="mt-7 bg-slate-900 hover:bg-slate-800 h-11" asChild><Link to="/register">Empezar prueba</Link></Button>
            </Card>
            <Card className="p-7 flex flex-col border-slate-200 bg-white">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading font-semibold text-lg">Pro</span>
                <span className="text-xs rounded-full bg-indigo-50 text-indigo-700 px-2 py-0.5 font-medium ring-1 ring-inset ring-indigo-100">Más popular</span>
              </div>
              <p className="text-3xl font-heading font-bold mt-3">{PLAN_PRICES.pro.toLocaleString("es-AR")}<span className="text-sm font-normal text-slate-500"> ARS / mes</span></p>
              <ul className="mt-5 space-y-3 flex-1">
                {PRO_FEATURES.map((f) => <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {f}</li>)}
              </ul>
              <Button className="mt-7 bg-slate-900 hover:bg-slate-800 h-11" asChild><Link to="/register">Empezar prueba</Link></Button>
            </Card>
            <Card className="p-7 flex flex-col border-2 border-slate-900 bg-white relative">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-heading font-semibold text-lg">Premium</span>
                <Sparkles className="w-4 h-4 text-amber-500" />
              </div>
              <p className="text-3xl font-heading font-bold mt-3">{PLAN_PRICES.premium.toLocaleString("es-AR")}<span className="text-sm font-normal text-slate-500"> ARS / mes</span></p>
              <ul className="mt-5 space-y-3 flex-1">
                {PREMIUM_FEATURES.map((f) => <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> {f}</li>)}
              </ul>
              <Button className="mt-7 bg-slate-900 hover:bg-slate-800 h-11" asChild><Link to="/register">Empezar prueba</Link></Button>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="px-5 py-16 border-t border-slate-200 bg-white">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-heading font-bold tracking-tight text-center mb-8">Preguntas frecuentes</h2>
          <div className="space-y-3">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-xl border border-slate-200 p-5">
                <p className="font-medium text-[15px]">{f.q}</p>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-5 py-20 bg-slate-900 text-white">
        <div className="max-w-2xl mx-auto text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-white mb-5">
            <Clock className="w-3.5 h-3.5" /> Últimos cupos del mes
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight">Empezá hoy, sin compromiso</h2>
          <p className="text-slate-400 mt-3 leading-relaxed">Configurá tu consultorio y probá el bot. Sin tarjeta, sin letras chicas.</p>
          <Button size="lg" className="mt-7 bg-white text-slate-900 hover:bg-slate-100 h-12 px-8" asChild>
            <Link to="/register">Crear cuenta gratis <ArrowRight className="w-4 h-4 ml-1.5" /></Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-slate-800 bg-slate-900 text-slate-400 px-5 py-8">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-white/10 flex items-center justify-center">
              <CalendarClock className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-medium text-slate-300">AgendaPro</span>
            <span className="text-slate-600">·</span>
            <span>Recepcionista virtual para profesionales de la salud</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><Stethoscope className="w-3.5 h-3.5" /> Para profesionales</span>
            <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> Soporte</span>
          </div>
        </div>
      </footer>
    </div>
  );
}