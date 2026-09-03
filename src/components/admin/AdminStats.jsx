import React, { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Loader2, Users, Wallet, Clock, AlertTriangle, TrendingUp, Info } from "lucide-react";
import { PLAN_LABELS } from "@/lib/plan-utils";
import { summarizePlans, bucketRevenue, revenueTotals, formatARS, PLAN_COLORS, PLAN_ORDER } from "@/lib/admin-stats";

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

// Barra de proporción de planes. El color va SIEMPRE acompañado del nombre y el número al
// costado: los tonos de los planes no llegan a 3:1 contra el fondo claro, así que la
// identidad nunca queda dependiendo del color solo.
function PlanBreakdown({ stats }) {
  const total = stats.total || 1;
  const present = PLAN_ORDER.filter((p) => (stats.byPlan[p] || 0) > 0);

  return (
    <Card className="p-4 space-y-3">
      <p className="font-heading font-semibold text-sm">Distribución de planes</p>

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
          <ul className="space-y-1.5">
            {PLAN_ORDER.map((p) => {
              const n = stats.byPlan[p] || 0;
              const pct = stats.total ? Math.round((n / stats.total) * 100) : 0;
              return (
                <li key={p} className="flex items-center gap-2 text-sm">
                  <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: PLAN_COLORS[p] }} />
                  <span className="flex-1">{PLAN_LABELS[p]}</span>
                  <span className="font-medium tabular-nums">{n}</span>
                  <span className="text-muted-foreground text-xs w-10 text-right tabular-nums">{pct}%</span>
                </li>
              );
            })}
          </ul>
        </>
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
  const [range, setRange] = useState("month");

  useEffect(() => {
    (async () => {
      try {
        const [ps, pay] = await Promise.all([
          base44.entities.PracticeSettings.filter({}),
          base44.entities.Payment.filter({}),
        ]);
        setPractices(ps || []);
        setPayments(pay || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const stats = useMemo(() => summarizePlans(practices), [practices]);
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
        <PlanBreakdown stats={stats} />

        <Card className="p-4 space-y-3">
          <p className="font-heading font-semibold text-sm">Cobrado</p>
          <div className="space-y-2">
            {[
              ["Esta semana", totals.week],
              ["Este mes", totals.month],
              ["Este año", totals.year],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between border-b border-border/50 pb-1.5 last:border-0">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="font-heading font-semibold tabular-nums">{formatARS(value)}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Histórico total: <span className="font-medium text-foreground">{formatARS(totals.all)}</span> en {payments.length} {payments.length === 1 ? "cobro" : "cobros"}
          </p>
        </Card>
      </div>

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
              <p className="font-medium text-foreground">Todavía no hay cobros registrados.</p>
              <p className="mt-0.5">
                El registro de pagos empezó el 3/9/2026: los cobros anteriores a esa fecha no quedaron guardados y no se
                pueden recuperar. A partir de ahora, cada cuota y cada pack se guarda solo y aparece acá.
              </p>
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
