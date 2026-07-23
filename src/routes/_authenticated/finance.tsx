import { createFileRoute } from "@tanstack/react-router";
import { Landmark, TrendingUp, Receipt, PiggyBank } from "lucide-react";
import { PageHeader, Kpi, Panel } from "@/components/ui-parts";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({ meta: [
    { title: "Finance — FactoryOS AI" },
    { name: "description", content: "GL, AP/AR, budgets, cost centers and executive financial analytics." },
  ]}),
  component: FinancePage,
});

const cashflow = Array.from({ length: 12 }, (_, i) => ({
  m: ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i],
  inflow: 1200 + i * 60 + Math.round(Math.random() * 200),
  outflow: 950 + i * 45 + Math.round(Math.random() * 180),
}));

function FinancePage() {
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="Finance" title="Financial Command" sub="GL, AP/AR, budgets and cash flow, unified with operations." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Revenue MTD" value="$1.84M" delta="+11.4%" icon={TrendingUp} tone="success" />
        <Kpi label="COGS MTD" value="$1.02M" delta="+6.1%" icon={Landmark} tone="info" />
        <Kpi label="AP Outstanding" value="$412k" delta="-8.3%" icon={Receipt} tone="warning" />
        <Kpi label="Cash Position" value="$6.7M" delta="+3.1%" icon={PiggyBank} tone="primary" />
      </div>
      <div className="mt-4">
        <Panel title="Cash flow · Last 12 months">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={cashflow}>
                <defs>
                  <linearGradient id="in" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="out" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.23 25)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.62 0.23 25)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="m" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="inflow" stroke="oklch(0.72 0.19 145)" fill="url(#in)" strokeWidth={2} />
                <Area type="monotone" dataKey="outflow" stroke="oklch(0.62 0.23 25)" fill="url(#out)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
