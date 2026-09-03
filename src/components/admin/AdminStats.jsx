import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2, Users, Wallet, Clock, AlertTriangle, TrendingUp, Info, CalendarClock } from "lucide-react";
import { PLAN_LABELS, formatDate } from "@/lib/plan-utils";
import {
  summarizePlans, bucketRevenue, revenueTotals, planRevenue, upcomingCharges,
  formatARS, PLAN_COLORS, PLAN_ORDER,
} from "@/lib/admin-stats";

const RANGES = {
  week: { label: "Semanal", count: 12, caption: "Últimas 12 semanas" },
  month: { label: "Mensual", count: 12, caption: "Últimos 12 meses" },
  year: { label: "Anual", count: 5, caption: "Últimos 5 años" },
};

function StatTile({ icon: Icon, label, value, hint, tone = "default" }) {
  const toneClass = {
    default: "text-foreground",
    good: "text-emerald-600",
    warn: "text-amber-600",
    bad: "text-destructive",
  }[tone];
  return (
    <Card className="p-4">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon className="w-3.5 h-3.5" /> {label}
      </p>
      <p className={`text-2xl font-heading font-bold mt-1 ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
    </Card>
  );
}

// Distribución de planes + cuánto factura cada uno. El color va SIEMPRE acompañado del
// nombre y los números al costado: los tonos de los planes no llegan a 3:1 de contraste
// contra el fondo claro, así que la identidad nunca queda dependiendo del color solo.
function PlanBreakdown({ stats, revenue }) {
  const total = stats.total || 1;
  const present = PLAN_ORDER.filter((p) => (stats.byPlan[p] || 0) > 0);
  const monthlyTotal = PLAN_ORDER.reduce((acc, p) => acc + (revenue[p]?.monthly || 0), 0);

  return (
    <Card className="p-4 space-y-3">
      <p className="font-heading font-semibold text-sm">Detalle por plan</p>

      {stats.total === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay cuentas registradas.</p>
      ) : (
        <>
          <div className="flex h-2.5 rounded-full overflow-hidden gap-[2px]">
            {present.map((p) => (
              <div
                key={p}
                style={{ width: `${((stats.byPlan[p] || 0) / total) * 100}%`, backgroundColor: PLAN_COLORS[p] }}
                title={`${PLAN_LABELS[p]}: ${stats.byPlan[p]}`}
              />
            ))}
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="text-left font-normal pb-1">Plan</th>
                <th className="text-right font-normal pb-1">Cuentas</th>
                <th className="text-right font-normal pb-1">Facturan</th>
                <th className="text-right font-normal pb-1">Por mes</th>
              </tr>
            </thead>
            <tbody>
              {PLAN_ORDER.map((p) => {
                const row = revenue[p] || { accounts: 0, billable: 0, monthly: 0 };
                return (
                  <tr key={p} className="border-t border-border/50">
                    <td className="py-1.5">
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PLAN_COLORS[p] }} />
                        {PLAN_LABELS[p]}
                      </span>
                    </td>
                    <td className="text-right tabular-nums">{row.accounts}</td>
                    <td className="text-right tabular-nums text-muted-foreground">{row.billable}</td>
                    <td className="text-right tabular-nums font-medium">{row.monthly ? formatARS(row.monthly) : "—"}</td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-border">
                <td className="py-1.5 font-medium" colSpan={3}>Total mensual recurrente</td>
                <td className="text-right tabular-nums font-heading font-bold">{formatARS(monthlyTotal)}</td>
              </tr>
            </tbody>
          </table>

          <p className="text-xs text-muted-foreground">
            "Facturan" excluye las cuentas suspendidas y las que un admin asignó a mano, que no tienen cobro detrás.
          </p>
        </>
      )}
    </Card>
  );
}

// Lo que falta cobrar en el mes en curso, con el detalle de cada cobro.
function UpcomingCharges({ upcoming, collectedThisMonth }) {
  const expected = collectedThisMonth + upcoming.total;

  return (
    <Card className="p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="font-heading font-semibold text-sm">Por cobrar este mes</p>
          <p className="text-xs text-muted-foreground">Según la fecha de cobro de cada suscripción</p>
        </div>
        <p className="font-heading font-bold text-xl tabular-nums">{formatARS(upcoming.total)}</p>
      </div>

      {upcoming.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          No queda ningún cobro pendiente en lo que resta del mes.
        </p>
      ) : (
        <>
          <ul className="space-y-1.5">
            {Object.entries(upcoming.byPlan).map(([plan, row]) => (
              <li key={plan} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PLAN_COLORS[plan] }} />
                <span className="flex-1">{PLAN_LABELS[plan]}</span>
                <span className="text-muted-foreground text-xs tabular-nums">{row.count} ×</span>
                <span className="font-medium tabular-nums">{formatARS(row.amount)}</span>
              </li>
            ))}
          </ul>

          <div className="rounded-xl bg-muted/50 p-3 space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Próximos cobros</p>
            {upcoming.rows.slice(0, 6).map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-2 text-sm">
                <span className="flex items-center gap-1.5 min-w-0">
                  <CalendarClock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate">{r.practice_name}</span>
                  {r.estimated && <span className="text-xs text-amber-600 shrink-0">≈</span>}
                </span>
                <span className="text-muted-foreground text-xs shrink-0">
                  {formatDate(r.date)} · <span className="text-foreground font-medium tabular-nums">{formatARS(r.amount)}</span>
                </span>
              </div>
            ))}
            {upcoming.rows.length > 6 && (
              <p className="text-xs text-muted-foreground">y {upcoming.rows.length - 6} más</p>
            )}
          </div>
        </>
      )}

      <div className="flex items-baseline justify-between text-sm border-t border-border/50 pt-2">
        <span className="text-muted-foreground">Esperado del mes (cobrado + por cobrar)</span>
        <span className="font-heading font-semibold tabular-nums">{formatARS(expected)}</span>
      </div>

      {upcoming.estimatedCount > 0 && (
        <p className="text-xs text-amber-700 flex items-start gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
          <span>
            {upcoming.estimatedCount} {upcoming.estimatedCount === 1 ? "fecha es estimada" : "fechas son estimadas"} (marcadas con ≈):
            esas cuentas todavía no tienen guardada su fecha real de cobro. Se corrige sola con la sincronización horaria.
          </span>
        </p>
      )}
    </Card>
  );
}

function RevenueTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-2 shadow-md">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold text-sm">{formatARS(row.total)}</p>
      <p className="text-xs text-muted-foreground">{row.count} {row.count === 1 ? "cobro" : "cobros"}</p>
    </div>
  );
}

export default function AdminStats() {
  const [practices, setPractices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [paymentsUnavailable, setPaymentsUnavailable] = useState(false);
  const [range, setRange] = useState("month");

  useEffect(() => {
    (async () => {
      // Cada consulta con su propio catch a propósito: si la entidad Payment todavía no
      // está desplegada (o falla), las estadísticas de planes y trials — que no dependen
      // de ella — tienen que mostrarse igual en vez de dejar la pantalla en cero.
      try {
        const [ps, pay] = await Promise.all([
          base44.entities.PracticeSettings.filter({}).catch(() => []),
          base44.entities.Payment.filter({}).catch(() => null),
        ]);
        setPractices(ps || []);
        setPayments(pay || []);
        setPaymentsUnavailable(pay === null);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => summarizePlans(practices), [practices]);
  const revenue = useMemo(() => planRevenue(practices), [practices]);
  const upcoming = useMemo(() => upcomingCharges(practices), [practices]);
  const totals = useMemo(() => revenueTotals(payments), [payments]);
  const series = useMemo(
    () => bucketRevenue(payments, range, new Date(), RANGES[range].count),
    [payments, range],
  );

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const hasPayments = payments.length > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatTile icon={Users} label="Cuentas totales" value={stats.total} hint={`${stats.suspended} suspendidas`} />
        <StatTile icon={Wallet} label="Pagas activas" value={stats.activePaid} tone="good" hint="Sin contar trials" />
        <StatTile icon={Clock} label="Trials activos" value={stats.trialsActive} hint={`${stats.trialsExpired} ya vencidos`} />
        <StatTile
          icon={TrendingUp}
          label="MRR estimado"
          value={formatARS(stats.mrr)}
          hint="Planes activos × precio de lista"
        />
      </div>

      {stats.trialsExpiring > 0 && (
        <Card className="p-3 border-amber-300 bg-amber-50">
          <p className="text-sm text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              <strong>{stats.trialsExpiring}</strong> {stats.trialsExpiring === 1 ? "prueba vence" : "pruebas vencen"} en los próximos 3 días.
            </span>
          </p>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        <PlanBreakdown stats={stats} revenue={revenue} />
        <UpcomingCharges upcoming={upcoming} collectedThisMonth={totals.month} />
      </div>

      <Card className="p-4 space-y-3">
        <p className="font-heading font-semibold text-sm">Cobrado</p>
        <div className="grid sm:grid-cols-3 gap-3">
          {[
            ["Esta semana", totals.week],
            ["Este mes", totals.month],
            ["Este año", totals.year],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="font-heading font-semibold text-lg tabular-nums">{formatARS(value)}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          Histórico total: <span className="font-medium text-foreground">{formatARS(totals.all)}</span> en {payments.length} {payments.length === 1 ? "cobro" : "cobros"}
        </p>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="font-heading font-semibold text-sm">Facturación</p>
            <p className="text-xs text-muted-foreground">{RANGES[range].caption} · solo cobros acreditados</p>
          </div>
          <Tabs value={range} onValueChange={setRange}>
            <TabsList>
              {Object.entries(RANGES).map(([key, cfg]) => (
                <TabsTrigger key={key} value={key} className="text-xs">{cfg.label}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        {!hasPayments ? (
          <div className="rounded-xl bg-muted/50 p-4 flex items-start gap-2">
            <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              {paymentsUnavailable ? (
                <>
                  <p className="font-medium text-foreground">No se pudo leer el registro de cobros.</p>
                  <p className="mt-0.5">Si recién se publicó el cambio, puede que la entidad Payment todavía no esté desplegada. El resto de las estadísticas de arriba son correctas.</p>
                </>
              ) : (
                <>
                  <p className="font-medium text-foreground">Todavía no hay cobros registrados.</p>
                  <p className="mt-0.5">
                    El registro de pagos empezó el 3/9/2026: los cobros anteriores a esa fecha no quedaron guardados y no se
                    pueden recuperar. A partir de ahora, cada cuota y cada pack se guarda solo y aparece acá.
                  </p>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={series} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={70}
                  tickFormatter={(v) => (v >= 1000 ? `$${Math.round(v / 1000)}k` : `$${v}`)}
                />
                <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(148,163,184,0.12)" }} />
                <Bar dataKey="total" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
