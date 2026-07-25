import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Factory, Boxes, ShieldCheck, Cog, TrendingUp, Activity, BrainCircuit, Zap,
  Warehouse, ShoppingCart, Users, Landmark, Wrench, ClipboardList, Timer,
  Truck, UserRound, ScrollText, Package, ArrowRight, CheckCircle2, Clock, AlertTriangle, Link2,
} from "lucide-react";
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import type { AppRole } from "@/lib/roles";
import { ROLE_MAP } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Dashboard — FactoryOS AI" },
    { name: "description", content: "Your role-specific operations command center." },
  ]}),
  component: DashboardRouter,
});

function DashboardRouter() {
  const { roles } = useAuth();
  const role = primaryRole(roles);
  switch (role) {
    case "company_admin":       return <CompanyAdminDashboard />;
    case "plant_admin":         return <PlantAdminDashboard />;
    case "plant_manager":       return <PlantManagerDashboard />;
    case "production_manager":  return <ProductionManagerDashboard />;
    case "warehouse_manager":   return <WarehouseDashboard />;
    case "procurement_manager": return <ProcurementDashboard />;
    case "quality_inspector":   return <QualityDashboard />;
    case "maintenance_engineer":return <MaintenanceDashboard />;
    case "finance_manager":     return <FinanceDashboard />;
    case "hr_manager":          return <HRDashboard />;
    case "production_operator": return <OperatorDashboard />;
    case "customer_portal":     return <CustomerDashboard />;
    case "supplier_portal":     return <SupplierDashboard />;
    case "auditor":             return <AuditorDashboard />;
    default:                    return <GenericDashboard role={role} />;
  }
}

/* ─────────── SHARED HELPERS ─────────── */
const trend = (n: number, base = 800, jitter = 60) =>
  Array.from({ length: n }, (_, i) => ({
    d: `D-${n - 1 - i}`,
    a: base + Math.round(Math.sin(i / 2) * 120 + i * 22 + Math.random() * jitter),
    b: 6 + Math.round(Math.random() * 10),
  }));

function Shell({ title, sub, eyebrow, children }: { title: string; sub: string; eyebrow: string; children: React.ReactNode }) {
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow={eyebrow} title={title} sub={sub}
        actions={<>
          <Button variant="outline" className="glass border-white/5"><Activity className="h-4 w-4 mr-1.5" />Live</Button>
          <Button className="bg-[image:var(--gradient-primary)] shadow-glow"><BrainCircuit className="h-4 w-4 mr-1.5" />Ask Copilot</Button>
        </>}
      />
      {children}
    </div>
  );
}

function OutputChart({ data }: { data: ReturnType<typeof trend> }) {
  return (
    <div className="h-64">
      <ResponsiveContainer>
        <AreaChart data={data}>
          <defs><linearGradient id="dg" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="oklch(0.58 0.22 259)" stopOpacity={0.6} />
            <stop offset="100%" stopColor="oklch(0.58 0.22 259)" stopOpacity={0} />
          </linearGradient></defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="d" stroke="rgba(255,255,255,0.4)" fontSize={10} />
          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
          <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
          <Area type="monotone" dataKey="a" stroke="oklch(0.58 0.22 259)" strokeWidth={2} fill="url(#dg)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function AIInsights({ items }: { items: { t: string; c: number }[] }) {
  return (
    <Panel title="AI Copilot" right={<span className="text-[10px] text-primary">{items.length} insights</span>}>
      <div className="space-y-3">
        {items.map((r, i) => (
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
  );
}

/* ─────────── WORKFLOW CONNECTION PANEL ─────────── */
function WorkflowConnectionPanel() {
  const { companyId } = useAuth();
  const opts = { enabled: !!companyId };
  const { data: salesOrders } = useQuery({ queryKey: ["wf-so", companyId], queryFn: async () => (await supabase.from("sales_orders").select("so_number,status,priority")).data ?? [], ...opts });
  const { data: prodOrders } = useQuery({ queryKey: ["wf-po", companyId], queryFn: async () => (await supabase.from("production_orders").select("order_number,status,progress")).data ?? [], ...opts });
  const { data: shipments } = useQuery({ queryKey: ["wf-shp", companyId], queryFn: async () => (await supabase.from("shipments").select("shipment_number,status")).data ?? [], ...opts });
  const { data: invoices } = useQuery({ queryKey: ["wf-inv", companyId], queryFn: async () => (await supabase.from("invoices").select("invoice_number,status")).data ?? [], ...opts });
  const { data: payments } = useQuery({ queryKey: ["wf-pay", companyId], queryFn: async () => (await supabase.from("payments").select("payment_number,status")).data ?? [], ...opts });
  const { data: inspections } = useQuery({ queryKey: ["wf-qi", companyId], queryFn: async () => (await supabase.from("quality_inspections").select("inspection_number,result")).data ?? [], ...opts });
  const { data: tickets } = useQuery({ queryKey: ["wf-tkt", companyId], queryFn: async () => (await supabase.from("support_tickets").select("ticket_number,status")).data ?? [], ...opts });

  const soDone = salesOrders?.filter(s => s.status === "completed").length ?? 0;
  const soTotal = salesOrders?.length ?? 0;
  const poDone = prodOrders?.filter(p => p.status === "completed").length ?? 0;
  const poTotal = prodOrders?.length ?? 0;
  const shpDelivered = shipments?.filter(s => s.status === "delivered").length ?? 0;
  const shpTotal = shipments?.length ?? 0;
  const invPaid = invoices?.filter(i => i.status === "paid").length ?? 0;
  const invTotal = invoices?.length ?? 0;
  const payDone = payments?.filter(p => p.status === "completed").length ?? 0;
  const qiPass = inspections?.filter(q => q.result === "pass").length ?? 0;
  const qiTotal = inspections?.length ?? 0;
  const tktOpen = tickets?.filter(t => t.status === "open").length ?? 0;

  const steps = [
    { label: "Sales Orders", done: soDone, total: soTotal, color: "bg-blue-500" },
    { label: "Production", done: poDone, total: poTotal, color: "bg-violet-500" },
    { label: "Quality", done: qiPass, total: qiTotal, color: "bg-emerald-500" },
    { label: "Dispatch", done: shpDelivered, total: shpTotal, color: "bg-amber-500" },
    { label: "Invoicing", done: invPaid, total: invTotal, color: "bg-green-500" },
    { label: "Payments", done: payDone, total: payments?.length ?? 0, color: "bg-teal-500" },
  ];

  return (
    <Panel title="Workflow Pipeline" right={<span className="text-[10px] text-primary flex items-center gap-1"><Link2 className="h-3 w-3" />Live sync</span>}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {steps.map((s, i) => (
          <div key={s.label} className="relative">
            <div className="rounded-xl bg-card/60 border border-white/5 p-3 text-center">
              <div className={`h-1.5 w-full rounded-full ${s.color} opacity-30 mb-2`}><div className={`h-full rounded-full ${s.color}`} style={{ width: s.total > 0 ? `${(s.done / s.total) * 100}%` : "0%" }} /></div>
              <div className="text-[11px] text-muted-foreground mb-1">{s.label}</div>
              <div className="text-lg font-semibold tabular-nums">{s.done}<span className="text-xs text-muted-foreground">/{s.total}</span></div>
            </div>
            {i < steps.length - 1 && <ArrowRight className="hidden lg:block absolute top-1/2 -right-2 h-3 w-3 text-muted-foreground -translate-y-1/2 z-10" />}
          </div>
        ))}
      </div>
      {tktOpen > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>{tktOpen} open support ticket{tktOpen > 1 ? "s" : ""} require attention</span>
        </div>
      )}
    </Panel>
  );
}

/* ─────────── COMPANY ADMIN ─────────── */
function CompanyAdminDashboard() {
  const production = useQuery({ queryKey: ["prod-orders-recent"],
    queryFn: async () => (await supabase.from("production_orders").select("*").order("created_at", { ascending: false }).limit(6)).data ?? [] });
  const machines = useQuery({ queryKey: ["machines-recent"],
    queryFn: async () => (await supabase.from("machines").select("*").order("name")).data ?? [] });
  const products = useQuery({ queryKey: ["products-count"],
    queryFn: async () => (await supabase.from("products").select("*", { count: "exact", head: true })).count ?? 0 });
  const customers = useQuery({ queryKey: ["cust-count"],
    queryFn: async () => (await supabase.from("customers").select("*", { count: "exact", head: true })).count ?? 0 });
  const employees = useQuery({ queryKey: ["emp-count"],
    queryFn: async () => (await supabase.from("employees").select("*", { count: "exact", head: true })).count ?? 0 });

  const outputTrend = trend(14);
  const oeeSeries = Array.from({ length: 12 }, (_, i) => ({
    h: `${i * 2}:00`, oee: 78 + Math.round(Math.sin(i / 2) * 6 + Math.random() * 4),
    availability: 88 + Math.round(Math.random() * 4), performance: 82 + Math.round(Math.random() * 6),
  }));
  const activeOrders = production.data?.filter(p => p.status === "in_progress").length ?? 0;
  const completedOrders = production.data?.filter(p => p.status === "completed").length ?? 0;
  const machineUp = machines.data?.filter(m => m.status === "operational").length ?? 0;
  const machineDown = machines.data?.filter(m => m.status === "down" || m.status === "maintenance").length ?? 0;
  const avgUtil = machines.data?.length ? (machines.data.reduce((s, m) => s + Number(m.utilization ?? 0), 0) / machines.data.length).toFixed(1) : "0";
  const mixData = [{ name: "Precision", value: 42 }, { name: "Assemblies", value: 30 }, { name: "Raw", value: 18 }, { name: "Other", value: 10 }];
  const COLORS = ["oklch(0.58 0.22 259)","oklch(0.62 0.19 300)","oklch(0.72 0.14 210)","oklch(0.72 0.19 145)"];

  return (
    <Shell eyebrow="Executive" title="Command Center" sub="Company-wide operations, plants, machines and AI recommendations.">
      {/* Workflow Pipeline — live status across all 3 customer orders */}
      <WorkflowConnectionPanel />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
        <Kpi label="Active Orders" value={String(activeOrders)} delta="+4" icon={Factory} tone="primary" />
        <Kpi label="Completed" value={String(completedOrders)} delta="+1" icon={CheckCircle2} tone="success" />
        <Kpi label="Machines Up" value={`${machineUp}/${machines.data?.length ?? 0}`} icon={Cog} tone="info" />
        <Kpi label="Employees" value={String(employees.data ?? 0)} icon={Users} tone="primary" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3">
        <Kpi label="Customers" value={String(customers.data ?? 0)} icon={UserRound} tone="info" />
        <Kpi label="Products" value={String(products.data ?? 0)} icon={Boxes} tone="primary" />
        <Kpi label="Avg Utilization" value={`${avgUtil}%`} icon={TrendingUp} tone="success" />
        <Kpi label="Down Machines" value={String(machineDown)} icon={Wrench} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Production Output · 14 days" right={<span className="text-[10px] text-success">▲ 12.4%</span>}>
            <OutputChart data={outputTrend} />
          </Panel>
        </div>
        <AIInsights items={[
          { t: `MediCore SO-005 at 45% — on track for delivery in 7 days`, c: 94 },
          { t: `Reorder N-08-SKU-A1003 — consumption up 22% WoW`, c: 88 },
          { t: `Supplier Kyoto Precision beat SLA by 6% this month`, c: 91 },
        ]} />
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
                <Bar dataKey="b" fill="oklch(0.62 0.23 25)" radius={[4, 4, 0, 0]} />
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
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="text-xs text-muted-foreground mt-6">
        {products.isFetched && <>Catalog: {products.data} SKUs · {customers.data ?? 0} Customers · {employees.data ?? 0} Employees · Company-scoped by RLS · Realtime ready</>}
      </div>
    </Shell>
  );
}

/* ─────────── PLANT ADMIN / MANAGER ─────────── */
function PlantAdminDashboard() {
  return (
    <Shell eyebrow="Plant" title="Plant Overview" sub="Everything happening inside your plant right now.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Departments" value="12" icon={Users} tone="primary" />
        <Kpi label="Employees" value="248" delta="+6" icon={Users} tone="info" />
        <Kpi label="Active Machines" value="34/38" icon={Cog} tone="success" />
        <Kpi label="Open Issues" value="3" icon={ShieldCheck} tone="warning" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2"><Panel title="Plant output · last 14 days"><OutputChart data={trend(14)} /></Panel></div>
        <AIInsights items={[
          { t: "Line B utilization down 8% vs last week", c: 82 },
          { t: "Shift 2 productivity best of the quarter", c: 91 },
        ]} />
      </div>
    </Shell>
  );
}
function PlantManagerDashboard() {
  return (
    <Shell eyebrow="Plant" title="Plant Performance" sub="Live KPIs across production, maintenance and quality.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="OEE" value="86.2%" delta="+2.1%" icon={TrendingUp} tone="primary" />
        <Kpi label="Throughput" value="1,842" delta="+140" icon={Factory} tone="success" />
        <Kpi label="Machine Uptime" value="92.7%" icon={Cog} tone="info" />
        <Kpi label="First Pass Yield" value="97.4%" icon={ShieldCheck} tone="warning" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2"><Panel title="Throughput trend"><OutputChart data={trend(14, 1600)} /></Panel></div>
        <AIInsights items={[
          { t: "CNC-A3 vibration anomaly — schedule inspection", c: 87 },
          { t: "Optimize batching on line C for +6% throughput", c: 79 },
        ]} />
      </div>
    </Shell>
  );
}

/* ─────────── PRODUCTION MANAGER ─────────── */
function ProductionManagerDashboard() {
  const orders = useQuery({ queryKey: ["prod-orders"],
    queryFn: async () => (await supabase.from("production_orders").select("*").order("due_date").limit(8)).data ?? [] });
  return (
    <Shell eyebrow="Production" title="Production Planning" sub="Schedule, work orders and capacity for the next 14 days.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Planned Orders" value={String(orders.data?.length ?? 0)} icon={ClipboardList} tone="primary" />
        <Kpi label="In Progress" value={String(orders.data?.filter(o => o.status === "in_progress").length ?? 0)} icon={Factory} tone="info" />
        <Kpi label="Capacity Used" value="78%" icon={TrendingUp} tone="warning" />
        <Kpi label="On-Time %" value="94.2%" delta="+1.1%" icon={Timer} tone="success" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Upcoming production orders">
            <div className="divide-y divide-white/5 text-sm">
              {(orders.data ?? []).map(o => (
                <div key={o.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5">
                  <div><div className="font-medium">{o.order_number}</div><div className="text-[11px] text-muted-foreground">Qty {o.quantity}</div></div>
                  <StatusBadge status={o.status} />
                  <div className="text-xs text-muted-foreground">{o.due_date ? new Date(o.due_date).toLocaleDateString() : "—"}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <AIInsights items={[
          { t: "Reschedule PO-1042 → save 6 setup hours", c: 88 },
          { t: "Material shortage predicted for W-42", c: 76 },
        ]} />
      </div>
    </Shell>
  );
}

/* ─────────── WAREHOUSE MANAGER ─────────── */
function WarehouseDashboard() {
  const inv = useQuery({ queryKey: ["inv"],
    queryFn: async () => (await supabase.from("inventory").select("*").limit(200)).data ?? [] });
  const low = inv.data?.filter(i => Number(i.quantity ?? 0) <= 10).length ?? 0;
  return (
    <Shell eyebrow="Logistics" title="Warehouse Control" sub="Stock movements, receiving, dispatch and cycle counts.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="SKUs in Stock" value={String(inv.data?.length ?? 0)} icon={Boxes} tone="primary" />
        <Kpi label="Low Stock" value={String(low)} icon={Warehouse} tone="warning" />
        <Kpi label="Received Today" value="18" icon={Package} tone="success" />
        <Kpi label="Dispatched Today" value="24" icon={Truck} tone="info" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2"><Panel title="Warehouse throughput"><OutputChart data={trend(14, 240, 20)} /></Panel></div>
        <AIInsights items={[
          { t: `${low} SKUs are at or below reorder level`, c: 100 },
          { t: "Suggest bin re-slotting for A-class items", c: 84 },
        ]} />
      </div>
    </Shell>
  );
}

/* ─────────── PROCUREMENT MANAGER ─────────── */
function ProcurementDashboard() {
  const pos = useQuery({ queryKey: ["pos"],
    queryFn: async () => (await supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(10)).data ?? [] });
  return (
    <Shell eyebrow="Procurement" title="Procurement Center" sub="Suppliers, POs, RFQs and goods receipt live view.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Open POs" value={String(pos.data?.filter(p => p.status !== "received").length ?? 0)} icon={ShoppingCart} tone="primary" />
        <Kpi label="Approved" value={String(pos.data?.filter(p => p.status === "approved").length ?? 0)} icon={ShieldCheck} tone="success" />
        <Kpi label="Pending" value={String(pos.data?.filter(p => p.status === "pending").length ?? 0)} icon={Timer} tone="warning" />
        <Kpi label="Supplier OTIF" value="94%" delta="+2%" icon={Truck} tone="info" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Recent purchase orders">
            <div className="divide-y divide-white/5 text-sm">
              {(pos.data ?? []).map(p => (
                <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-3 py-2.5 items-center">
                  <div><div className="font-medium">{p.po_number ?? p.id.slice(0,8)}</div><div className="text-[11px] text-muted-foreground">Total ${Number(p.total_amount ?? 0).toLocaleString()}</div></div>
                  <StatusBadge status={p.status} />
                  <div className="text-xs text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <AIInsights items={[
          { t: "Consolidate SKU-A1003 orders → save 8%", c: 89 },
          { t: "Alt supplier available for critical Ti stock", c: 76 },
        ]} />
      </div>
    </Shell>
  );
}

/* ─────────── QUALITY INSPECTOR ─────────── */
function QualityDashboard() {
  return (
    <Shell eyebrow="Quality" title="Quality Control" sub="Incoming, in-process and final inspection at a glance.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="First-Pass Yield" value="97.8%" delta="+0.4%" icon={ShieldCheck} tone="success" />
        <Kpi label="Defect Rate" value="0.82%" delta="-0.3%" icon={ShieldCheck} tone="warning" />
        <Kpi label="Open NCRs" value="7" icon={ClipboardList} tone="info" />
        <Kpi label="CAPA On Track" value="94%" icon={ShieldCheck} tone="primary" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2"><Panel title="Yield trend"><OutputChart data={trend(14, 940, 30)} /></Panel></div>
        <AIInsights items={[
          { t: "Predicted micro-crack on batch B-2287", c: 88 },
          { t: "Housing dimensional drift approaching limit", c: 76 },
        ]} />
      </div>
    </Shell>
  );
}

/* ─────────── MAINTENANCE ENGINEER ─────────── */
function MaintenanceDashboard() {
  const machines = useQuery({ queryKey: ["m-machines"],
    queryFn: async () => (await supabase.from("machines").select("*").order("name")).data ?? [] });
  const down = machines.data?.filter(m => m.status === "down" || m.status === "maintenance").length ?? 0;
  return (
    <Shell eyebrow="Maintenance" title="Reliability & Uptime" sub="Predictive maintenance, breakdowns and spare parts.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="MTBF" value="184h" delta="+12h" icon={Timer} tone="success" />
        <Kpi label="MTTR" value="2.4h" delta="-0.3h" icon={Wrench} tone="info" />
        <Kpi label="Down / Maint" value={String(down)} icon={Cog} tone="warning" />
        <Kpi label="PM Compliance" value="96%" icon={ShieldCheck} tone="primary" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Machine status">
            <div className="space-y-2">
              {(machines.data ?? []).slice(0, 8).map(m => (
                <div key={m.id} className="rounded-xl bg-card/60 border border-white/5 p-3 text-sm flex items-center justify-between">
                  <div><div className="font-medium">{m.name}</div><div className="text-[11px] text-muted-foreground">{m.type ?? "—"}</div></div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <AIInsights items={[
          { t: "Bearing wear on CNC-A1 — 72h", c: 94 },
          { t: "Coolant pump inlet blockage risk on Line B", c: 81 },
        ]} />
      </div>
    </Shell>
  );
}

/* ─────────── FINANCE MANAGER ─────────── */
function FinanceDashboard() {
  const cash = trend(14, 120000, 4000);
  return (
    <Shell eyebrow="Finance" title="Finance Center" sub="Cash, revenue, AP/AR and budgets in real time.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Revenue MTD" value="$1.42M" delta="+7.4%" icon={TrendingUp} tone="success" />
        <Kpi label="Cash Position" value="$4.82M" delta="+2.1%" icon={Landmark} tone="primary" />
        <Kpi label="AP Outstanding" value="$318k" icon={ClipboardList} tone="warning" />
        <Kpi label="AR Outstanding" value="$612k" icon={ClipboardList} tone="info" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2"><Panel title="Cash flow"><OutputChart data={cash} /></Panel></div>
        <AIInsights items={[
          { t: "Late-paying customer detected — 42 DSO", c: 84 },
          { t: "Reallocate $60k opex to CAPEX for +ROI", c: 71 },
        ]} />
      </div>
    </Shell>
  );
}

/* ─────────── HR MANAGER ─────────── */
function HRDashboard() {
  return (
    <Shell eyebrow="People" title="HR Command" sub="Headcount, attendance and workforce analytics.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Headcount" value="248" delta="+6" icon={Users} tone="primary" />
        <Kpi label="Attendance" value="96.4%" icon={Timer} tone="success" />
        <Kpi label="Open Reqs" value="8" icon={ClipboardList} tone="info" />
        <Kpi label="Training %" value="88%" icon={ShieldCheck} tone="warning" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2"><Panel title="Headcount trend"><OutputChart data={trend(14, 240, 3)} /></Panel></div>
        <AIInsights items={[
          { t: "Attrition risk: 3 employees in Line B", c: 74 },
          { t: "Overtime spike on Shift 2 — 14% above target", c: 82 },
        ]} />
      </div>
    </Shell>
  );
}

/* ─────────── OPERATOR ─────────── */
function OperatorDashboard() {
  return (
    <Shell eyebrow="My Shift" title="Today's Work" sub="Your assigned work orders, machines and tasks.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="My Work Orders" value="4" icon={ClipboardList} tone="primary" />
        <Kpi label="Assigned Machines" value="2" icon={Cog} tone="info" />
        <Kpi label="Completed Today" value="12" delta="+2" icon={ShieldCheck} tone="success" />
        <Kpi label="Open Issues" value="1" icon={ShieldCheck} tone="warning" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Panel title="Your work orders">
          <div className="text-sm text-muted-foreground">Assigned work orders will appear here in real time as your manager releases them.</div>
        </Panel>
        <Panel title="Machine status">
          <div className="text-sm text-muted-foreground">Live status and utilization of your assigned machines.</div>
        </Panel>
      </div>
    </Shell>
  );
}

/* ─────────── CUSTOMER ─────────── */
function CustomerDashboard() {
  return (
    <Shell eyebrow="Customer" title="Your Orders" sub="Track orders, shipments and invoices.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Open Orders" value="3" icon={ShoppingCart} tone="primary" />
        <Kpi label="In Transit" value="1" icon={Truck} tone="info" />
        <Kpi label="Delivered YTD" value="18" icon={ShieldCheck} tone="success" />
        <Kpi label="Outstanding Invoices" value="$14k" icon={Landmark} tone="warning" />
      </div>
    </Shell>
  );
}

/* ─────────── SUPPLIER ─────────── */
function SupplierDashboard() {
  return (
    <Shell eyebrow="Supplier" title="Supplier Portal" sub="Purchase orders, deliveries and payments.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Open POs" value="4" icon={ShoppingCart} tone="primary" />
        <Kpi label="Delivered YTD" value="42" icon={Truck} tone="success" />
        <Kpi label="OTIF" value="94%" delta="+2%" icon={Timer} tone="info" />
        <Kpi label="Awaiting Payment" value="$28k" icon={Landmark} tone="warning" />
      </div>
    </Shell>
  );
}

/* ─────────── AUDITOR ─────────── */
function AuditorDashboard() {
  const logs = useQuery({ queryKey: ["audit-recent"],
    queryFn: async () => (await supabase.from("audit_logs").select("*").order("created_at", { ascending: false }).limit(20)).data ?? [] });
  return (
    <Shell eyebrow="Audit" title="Compliance Overview" sub="Read-only view of activity and compliance across the company.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Events (24h)" value={String(logs.data?.length ?? 0)} icon={ScrollText} tone="primary" />
        <Kpi label="Critical" value="0" icon={ShieldCheck} tone="success" />
        <Kpi label="Warnings" value="3" icon={ShieldCheck} tone="warning" />
        <Kpi label="Docs Pending" value="2" icon={ClipboardList} tone="info" />
      </div>
      <div className="mt-4">
        <Panel title="Recent audit events">
          <div className="divide-y divide-white/5 text-sm">
            {(logs.data ?? []).map(l => (
              <div key={l.id} className="grid grid-cols-[auto_1fr_auto] gap-3 py-2 items-center">
                <ScrollText className="h-4 w-4 text-muted-foreground" />
                <div><span className="font-medium">{l.action}</span> <span className="text-muted-foreground">· {l.entity ?? "system"}</span></div>
                <div className="text-xs text-muted-foreground tabular-nums">{new Date(l.created_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

function GenericDashboard({ role }: { role: AppRole | null }) {
  const label = role ? ROLE_MAP[role]?.label : "Dashboard";
  return <Shell eyebrow="Overview" title={`${label} Dashboard`} sub="Your personalized command center.">
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      <Kpi label="Activity" value="—" icon={Activity} tone="primary" />
      <Kpi label="Tasks" value="—" icon={ClipboardList} tone="info" />
      <Kpi label="Alerts" value="—" icon={ShieldCheck} tone="warning" />
      <Kpi label="Team" value="—" icon={Users} tone="success" />
    </div>
  </Shell>;
}
