import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Factory, Boxes, ShieldCheck, Cog, TrendingUp, Activity, BrainCircuit, Zap,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Operations Dashboard — FactoryOS AI" },
      { name: "description", content: "Real-time operations, OEE, production and AI insights across every plant." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const production = useQuery({
    queryKey: ["prod-orders-recent"],
    queryFn: async () => (await supabase.from("production_orders").select("*").order("created_at", { ascending: false }).limit(6)).data ?? [],
  });
  const machines = useQuery({
    queryKey: ["machines-recent"],
    queryFn: async () => (await supabase.from("machines").select("*").order("name")).data ?? [],
  });
  const products = useQuery({
    queryKey: ["products-count"],
    queryFn: async () => (await supabase.from("products").select("*", { count: "exact", head: true })).count ?? 0,
  });

  const outputTrend = Array.from({ length: 14 }, (_, i) => ({
    d: `D-${13 - i}`, output: 800 + Math.round(Math.sin(i / 2) * 120 + i * 22 + Math.random() * 60), scrap: 6 + Math.round(Math.random() * 10),
  }));
  const oeeSeries = Array.from({ length: 12 }, (_, i) => ({
    h: `${i * 2}:00`, oee: 78 + Math.round(Math.sin(i / 2) * 6 + Math.random() * 4),
    availability: 88 + Math.round(Math.random() * 4), performance: 82 + Math.round(Math.random() * 6),
  }));
  const mixData = [
    { name: "Precision", value: 42 }, { name: "Assemblies", value: 30 },
    { name: "Raw", value: 18 }, { name: "Other", value: 10 },
  ];
  const COLORS = ["oklch(0.58 0.22 259)","oklch(0.62 0.19 300)","oklch(0.72 0.14 210)","oklch(0.72 0.19 145)"];

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Operations"
        title="Command Center"
        sub="A single pane of glass across your plants, machines, orders and AI recommendations."
        actions={
          <>
            <Button variant="outline" className="glass border-white/5"><Activity className="h-4 w-4 mr-1.5" />Live</Button>
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow"><BrainCircuit className="h-4 w-4 mr-1.5" />Ask Copilot</Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Active Production Orders" value={String(production.data?.filter(p => p.status === "in_progress").length ?? 0)} delta="+4" icon={Factory} tone="primary" />
        <Kpi label="Machine Uptime" value="94.1%" delta="+1.2%" icon={Cog} tone="success" />
        <Kpi label="OEE" value="87.4%" delta="+3.2%" icon={TrendingUp} tone="info" />
        <Kpi label="Open Quality NCRs" value="7" delta="-2" icon={ShieldCheck} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Production Output · Last 14 days" right={<span className="text-[10px] text-success">▲ 12.4% vs prior</span>}>
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={outputTrend}>
                  <defs>
                    <linearGradient id="out" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.58 0.22 259)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.58 0.22 259)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="d" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="output" stroke="oklch(0.58 0.22 259)" strokeWidth={2} fill="url(#out)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
        <Panel title="AI Insights" right={<span className="text-[10px] text-primary">3 active</span>}>
          <div className="space-y-3">
            {[
              { t: "Bearing wear predicted on CNC Mill Alpha-1 within 72h", c: 94, tone: "warning" },
              { t: "Reorder SKU-A1003 · consumption up 22% WoW", c: 88, tone: "info" },
              { t: "Supplier Kyoto Precision beat SLA by 6% this month", c: 91, tone: "success" },
            ].map((r, i) => (
              <div key={i} className="rounded-xl bg-card/60 border border-white/5 p-3">
                <div className="flex items-center justify-between text-[10px] text-primary">
                  <span className="flex items-center gap-1"><Zap className="h-3 w-3" /> Copilot</span>
                  <span>{r.c}% conf.</span>
                </div>
                <div className="mt-1 text-sm">{r.t}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Panel title="OEE · Today">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={oeeSeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="h" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} domain={[60, 100]} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line type="monotone" dataKey="oee" stroke="oklch(0.58 0.22 259)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="availability" stroke="oklch(0.72 0.14 210)" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="performance" stroke="oklch(0.62 0.19 300)" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Product Mix">
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={mixData} dataKey="value" innerRadius={50} outerRadius={80} paddingAngle={4}>
                  {mixData.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Scrap · 14 days">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={outputTrend}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="d" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="scrap" fill="oklch(0.62 0.23 25)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Recent Production Orders">
            <div className="divide-y divide-white/5 -mx-2">
              {(production.data ?? []).map((o) => (
                <div key={o.id} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2.5 px-2 text-sm">
                  <div>
                    <div className="font-medium">{o.order_number}</div>
                    <div className="text-[11px] text-muted-foreground">Qty {o.quantity} · Priority {o.priority}</div>
                  </div>
                  <StatusBadge status={o.status} />
                  <div className="w-28 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${o.progress ?? 0}%` }} />
                  </div>
                  <div className="text-xs tabular-nums w-10 text-right text-muted-foreground">{Math.round(Number(o.progress ?? 0))}%</div>
                </div>
              ))}
              {production.isLoading && <div className="p-4 text-xs text-muted-foreground">Loading…</div>}
            </div>
          </Panel>
        </div>
        <Panel title="Machine Status">
          <div className="space-y-2">
            {(machines.data ?? []).slice(0, 6).map((m) => (
              <div key={m.id} className="rounded-xl bg-card/60 border border-white/5 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="truncate font-medium">{m.name}</span>
                  <StatusBadge status={m.status} />
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${m.utilization ?? 0}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{m.type ?? "—"}</span>
                  <span className="tabular-nums">{Number(m.utilization ?? 0).toFixed(1)}% util</span>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="text-xs text-muted-foreground mt-6">
        {products.isFetched && <>Catalog: {products.data} SKUs · Company scoped by RLS · Realtime ready</>}
      </div>
    </div>
  );
}
