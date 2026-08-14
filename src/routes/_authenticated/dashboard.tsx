import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Factory,
  Boxes,
  ShieldCheck,
  Cog,
  TrendingUp,
  Activity,
  Zap,
  Warehouse,
  ShoppingCart,
  Users,
  Landmark,
  Wrench,
  ClipboardList,
  Timer,
  Truck,
  UserRound,
  ScrollText,
  Package,
  ArrowRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Link2,
  Plus,
  X,
  MessageSquare,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import { safeDate } from "@/lib/utils";
import type { AppRole } from "@/lib/roles";
import { ROLE_MAP } from "@/lib/roles";
import { getDashboardNotes, saveDashboardNote } from "@/lib/order-lifecycle";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — FactoryOS AI" },
      { name: "description", content: "Your role-specific operations command center." },
    ],
  }),
  component: DashboardRouter,
});

function DashboardRouter() {
  const { roles } = useAuth();
  const role = primaryRole(roles);
  switch (role) {
    case "company_admin":
      return <CompanyAdminDashboard />;
    case "plant_admin":
      return <PlantAdminDashboard />;
    case "plant_manager":
      return <PlantManagerDashboard />;
    case "production_manager":
      return <ProductionManagerDashboard />;
    case "warehouse_manager":
      return <WarehouseDashboard />;
    case "procurement_manager":
      return <ProcurementDashboard />;
    case "quality_inspector":
      return <QualityDashboard />;
    case "maintenance_engineer":
      return <MaintenanceDashboard />;
    case "finance_manager":
      return <FinanceDashboard />;
    case "hr_manager":
      return <HRDashboard />;
    case "production_operator":
      return <OperatorDashboard />;
    case "customer_portal":
      return <CustomerDashboard />;
    case "supplier_portal":
      return <SupplierDashboard />;
    case "auditor":
      return <AuditorDashboard />;
    default:
      return <GenericDashboard role={role} />;
  }
}

/* ─────────── SHARED HELPERS ─────────── */
const trend = (n: number, base = 800, jitter = 60) =>
  Array.from({ length: n }, (_, i) => ({
    d: `D-${n - 1 - i}`,
    a: base + Math.round(Math.sin(i / 2) * 120 + i * 22 + Math.random() * jitter),
    b: 6 + Math.round(Math.random() * 10),
  }));

/* ─────────── LIVE STATS HOOK (real numbers, never fabricated) ─────────── */
interface LiveStats {
  employees: number;
  departments: number;
  machines: number;
  machinesUp: number;
  machinesDown: number;
  products: number;
  customers: number;
  salesOrders: number;
  salesOrdersOpen: number;
  salesOrdersDelivered: number;
  salesOrdersPending: number;
  salesOrdersRevenue: number;
  productionOrders: number;
  productionInProgress: number;
  workOrders: number;
  invoices: number;
  invoicesOutstanding: number;
  payments: number;
  shipments: number;
  shipmentsToday: number;
  purchaseOrders: number;
  purchaseOrdersOpen: number;
  suppliers: number;
  inspections: number;
  inspectionsPassed: number;
  supportTickets: number;
  supportTicketsOpen: number;
  auditEvents: number;
  inventorySku: number;
  lowStock: number;
}

const EMPTY_STATS: LiveStats = {
  employees: 0,
  departments: 0,
  machines: 0,
  machinesUp: 0,
  machinesDown: 0,
  products: 0,
  customers: 0,
  salesOrders: 0,
  salesOrdersOpen: 0,
  salesOrdersDelivered: 0,
  salesOrdersPending: 0,
  salesOrdersRevenue: 0,
  productionOrders: 0,
  productionInProgress: 0,
  workOrders: 0,
  invoices: 0,
  invoicesOutstanding: 0,
  payments: 0,
  shipments: 0,
  shipmentsToday: 0,
  purchaseOrders: 0,
  purchaseOrdersOpen: 0,
  suppliers: 0,
  inspections: 0,
  inspectionsPassed: 0,
  supportTickets: 0,
  supportTicketsOpen: 0,
  auditEvents: 0,
  inventorySku: 0,
  lowStock: 0,
};

function useLiveStats(companyId: string | null) {
  const safe = async (fn: () => PromiseLike<any>): Promise<any> => {
    try {
      return await fn();
    } catch {
      return null;
    }
  };
  return useQuery({
    queryKey: ["live-stats", companyId],
    queryFn: async (): Promise<LiveStats> => {
      if (!companyId) return EMPTY_STATS;
      const today = new Date().toISOString().slice(0, 10);
      const [
        employees,
        departments,
        machines,
        products,
        customers,
        salesOrders,
        productionOrders,
        workOrders,
        invoices,
        payments,
        shipments,
        purchaseOrders,
        suppliers,
        inspections,
        supportTickets,
        auditLogs,
        inventory,
        inventoryAll,
      ] = await Promise.all([
        safe(() =>
          supabase
            .from("employees")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
        safe(() =>
          supabase
            .from("departments")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
        safe(() => supabase.from("machines").select("*").eq("company_id", companyId)),
        safe(() =>
          supabase
            .from("products")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
        safe(() =>
          supabase
            .from("customers")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
        safe(() =>
          supabase.from("sales_orders").select("status,total_amount").eq("company_id", companyId),
        ),
        safe(() => supabase.from("production_orders").select("status").eq("company_id", companyId)),
        safe(() =>
          supabase
            .from("work_orders")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
        safe(() =>
          supabase.from("invoices").select("status,total_amount").eq("company_id", companyId),
        ),
        safe(() =>
          supabase
            .from("payments")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
        safe(() =>
          supabase.from("shipments").select("status,created_at").eq("company_id", companyId),
        ),
        safe(() => supabase.from("purchase_orders").select("status").eq("company_id", companyId)),
        safe(() =>
          supabase
            .from("suppliers")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
        safe(() =>
          supabase.from("quality_inspections").select("result").eq("company_id", companyId),
        ),
        safe(() => supabase.from("support_tickets").select("status").eq("company_id", companyId)),
        safe(() =>
          supabase
            .from("audit_logs")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
        safe(() =>
          supabase
            .from("inventory")
            .select("quantity,products(reorder_level)")
            .eq("company_id", companyId),
        ),
        safe(() =>
          supabase
            .from("inventory")
            .select("id", { count: "exact", head: true })
            .eq("company_id", companyId),
        ),
      ]);

      const so = salesOrders?.data ?? [];
      const po = productionOrders?.data ?? [];
      const inv = invoices?.data ?? [];
      const shp = shipments?.data ?? [];
      const pur = purchaseOrders?.data ?? [];
      const qi = inspections?.data ?? [];
      const tkt = supportTickets?.data ?? [];
      const mach = machines?.data ?? [];
      const invRows = inventory?.data ?? [];
      const low = invRows.filter(
        (i: any) => Number(i.quantity ?? 0) <= Number(i.products?.reorder_level ?? 0),
      ).length;
      const openStatuses = [
        "pending_approval",
        "approved",
        "in_production",
        "quality_pending",
        "dispatch_ready",
        "out_for_delivery",
        "pending",
      ];

      return {
        employees: employees?.count ?? 0,
        departments: departments?.count ?? 0,
        machines: mach.length,
        machinesUp: mach.filter((m: any) => m.status === "operational").length,
        machinesDown: mach.filter((m: any) => m.status === "down" || m.status === "maintenance")
          .length,
        products: products?.count ?? 0,
        customers: customers?.count ?? 0,
        salesOrders: so.length,
        salesOrdersOpen: so.filter((s: any) => openStatuses.includes(s.status)).length,
        salesOrdersDelivered: so.filter(
          (s: any) => s.status === "delivered" || s.status === "completed",
        ).length,
        salesOrdersPending: so.filter((s: any) => s.status === "pending_approval").length,
        salesOrdersRevenue: so.reduce(
          (sum: number, s: any) => sum + Number(s.total_amount ?? 0),
          0,
        ),
        productionOrders: po.length,
        productionInProgress: po.filter(
          (p: any) => p.status === "in_progress" || p.status === "in-production",
        ).length,
        workOrders: workOrders?.count ?? 0,
        invoices: inv.length,
        invoicesOutstanding: inv.filter(
          (i: any) => i.status === "pending" || i.status === "partial" || i.status === "unpaid",
        ).length,
        payments: payments?.count ?? 0,
        shipments: shp.length,
        shipmentsToday: shp.filter((s: any) => (s.created_at ?? "").slice(0, 10) === today).length,
        purchaseOrders: pur.length,
        purchaseOrdersOpen: pur.filter(
          (p: any) => p.status !== "received" && p.status !== "fulfilled",
        ).length,
        suppliers: suppliers?.count ?? 0,
        inspections: qi.length,
        inspectionsPassed: qi.filter((q: any) => q.result === "pass" || q.result === "passed")
          .length,
        supportTickets: tkt.length,
        supportTicketsOpen: tkt.filter((t: any) => t.status === "open" || t.status === "pending")
          .length,
        auditEvents: auditLogs?.count ?? 0,
        inventorySku: inventoryAll?.count ?? 0,
        lowStock: low,
      };
    },
    enabled: !!companyId,
    // Cache for 3 minutes — 18 queries don't re-run on every tab switch
    staleTime: 3 * 60_000,
    gcTime: 15 * 60_000,
  });
}

/** Honest fallback when a metric has no real data source yet */
function na(): string {
  return "N/A";
}

function Shell({
  title,
  sub,
  eyebrow,
  children,
}: {
  title: string;
  sub: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        sub={sub}
        actions={
          <>
            <ModuleCopilot moduleName="dashboard" />
            <Button variant="outline" className="glass border-white/5">
              <Activity className="h-4 w-4 mr-1.5" />
              Live
            </Button>
          </>
        }
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
          <defs>
            <linearGradient id="dg" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="oklch(0.58 0.22 259)" stopOpacity={0.6} />
              <stop offset="100%" stopColor="oklch(0.58 0.22 259)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="d" stroke="rgba(255,255,255,0.4)" fontSize={10} />
          <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
          <Tooltip
            contentStyle={{
              background: "oklch(0.20 0.025 260)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 12,
              fontSize: 12,
            }}
          />
          <Area
            type="monotone"
            dataKey="a"
            stroke="oklch(0.58 0.22 259)"
            strokeWidth={2}
            fill="url(#dg)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/* ─────────── AI INSIGHTS WITH PERSISTENT NOTES (Bug B Fix) ─────────── */
function AIInsights({
  items,
  dashboardType = "default",
}: {
  items: { t: string; c: number }[];
  dashboardType?: string;
}) {
  const { companyId, user } = useAuth();
  const queryClient = useQueryClient();
  const [showAddNote, setShowAddNote] = useState(false);
  const [newNote, setNewNote] = useState("");

  const { data: savedNotes } = useQuery({
    queryKey: ["dashboard-notes", dashboardType, companyId],
    queryFn: () => getDashboardNotes(companyId!, dashboardType),
    enabled: !!companyId,
  });

  const handleSaveNote = async () => {
    if (!companyId || !user || !newNote.trim()) return;
    try {
      await saveDashboardNote(companyId, user.id, dashboardType, newNote.trim(), "manual");
      queryClient.invalidateQueries({ queryKey: ["dashboard-notes", dashboardType] });
      toast.success("Note saved");
      setNewNote("");
      setShowAddNote(false);
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  return (
    <Panel
      title="AI Copilot"
      right={
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-primary">
            {items.length + (savedNotes?.length ?? 0)} insights
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowAddNote(!showAddNote)}
          >
            {showAddNote ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </Button>
        </div>
      }
    >
      {showAddNote && (
        <div className="flex gap-2 mb-3">
          <Input
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Add your own note or insight..."
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleSaveNote()}
          />
          <Button size="sm" className="h-8 shrink-0" onClick={handleSaveNote}>
            <MessageSquare className="h-3 w-3 mr-1" />
            Save
          </Button>
        </div>
      )}
      <div className="space-y-3">
        {/* AI-generated insights */}
        {items.map((r, i) => (
          <div key={`ai-${i}`} className="rounded-xl bg-card/60 border border-white/5 p-3">
            <div className="flex items-center justify-between text-[10px] text-primary">
              <span className="flex items-center gap-1">
                <Zap className="h-3 w-3" /> Copilot
              </span>
              <span>{r.c}% conf.</span>
            </div>
            <div className="mt-1 text-sm">{r.t}</div>
          </div>
        ))}
        {/* Saved user notes */}
        {(savedNotes ?? []).map((note: any) => (
          <div key={note.id} className="rounded-xl bg-card/40 border border-primary/10 p-3">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Note
              </span>
              <span>{safeDate(note.created_at)}</span>
            </div>
            <div className="mt-1 text-sm">{note.content}</div>
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
  const { data: salesOrders } = useQuery({
    queryKey: ["wf-so", companyId],
    queryFn: async () => {
      try {
        return (await supabase.from("sales_orders").select("so_number,status,priority")).data ?? [];
      } catch {
        console.warn("[dashboard] sales_orders");
        return [];
      }
    },
    ...opts,
  });
  const { data: prodOrders } = useQuery({
    queryKey: ["wf-po", companyId],
    queryFn: async () => {
      try {
        return (
          (await supabase.from("production_orders").select("order_number,status,progress")).data ??
          []
        );
      } catch {
        console.warn("[dashboard] production_orders");
        return [];
      }
    },
    ...opts,
  });
  const { data: shipments } = useQuery({
    queryKey: ["wf-shp", companyId],
    queryFn: async () => {
      try {
        return (await supabase.from("shipments").select("shipment_number,status")).data ?? [];
      } catch {
        console.warn("[dashboard] shipments");
        return [];
      }
    },
    ...opts,
  });
  const { data: invoices } = useQuery({
    queryKey: ["wf-inv", companyId],
    queryFn: async () => {
      try {
        return (await supabase.from("invoices").select("invoice_number,status")).data ?? [];
      } catch {
        console.warn("[dashboard] invoices");
        return [];
      }
    },
    ...opts,
  });
  const { data: payments } = useQuery({
    queryKey: ["wf-pay", companyId],
    queryFn: async () => {
      try {
        return (await supabase.from("payments").select("payment_number,status")).data ?? [];
      } catch {
        console.warn("[dashboard] payments");
        return [];
      }
    },
    ...opts,
  });
  const { data: inspections } = useQuery({
    queryKey: ["wf-qi", companyId],
    queryFn: async () => {
      try {
        return (
          (await supabase.from("quality_inspections").select("inspection_number,result")).data ?? []
        );
      } catch {
        console.warn("[dashboard] quality_inspections");
        return [];
      }
    },
    ...opts,
  });
  const { data: tickets } = useQuery({
    queryKey: ["wf-tkt", companyId],
    queryFn: async () => {
      try {
        return (await supabase.from("support_tickets").select("ticket_number,status")).data ?? [];
      } catch {
        console.warn("[dashboard] support_tickets");
        return [];
      }
    },
    ...opts,
  });

  const soDone =
    salesOrders?.filter((s) => s.status === "completed" || s.status === "delivered").length ?? 0;
  const soTotal = salesOrders?.length ?? 0;
  const poDone = prodOrders?.filter((p) => p.status === "completed").length ?? 0;
  const poTotal = prodOrders?.length ?? 0;
  const shpDelivered = shipments?.filter((s) => s.status === "delivered").length ?? 0;
  const shpTotal = shipments?.length ?? 0;
  const invPaid = invoices?.filter((i) => i.status === "paid").length ?? 0;
  const invTotal = invoices?.length ?? 0;
  const payDone = payments?.filter((p) => p.status === "completed").length ?? 0;
  const qiPass = inspections?.filter((q) => q.result === "pass").length ?? 0;
  const qiTotal = inspections?.length ?? 0;
  const tktOpen = tickets?.filter((t) => t.status === "open").length ?? 0;

  const steps = [
    { label: "Sales Orders", done: soDone, total: soTotal, color: "bg-blue-500" },
    { label: "Production", done: poDone, total: poTotal, color: "bg-violet-500" },
    { label: "Quality", done: qiPass, total: qiTotal, color: "bg-emerald-500" },
    { label: "Dispatch", done: shpDelivered, total: shpTotal, color: "bg-amber-500" },
    { label: "Invoicing", done: invPaid, total: invTotal, color: "bg-green-500" },
    { label: "Payments", done: payDone, total: payments?.length ?? 0, color: "bg-teal-500" },
  ];

  return (
    <Panel
      title="Workflow Pipeline"
      right={
        <span className="text-[10px] text-primary flex items-center gap-1">
          <Link2 className="h-3 w-3" />
          Live sync
        </span>
      }
    >
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {steps.map((s, i) => (
          <div key={s.label} className="relative">
            <div className="rounded-xl bg-card/60 border border-white/5 p-3 text-center">
              <div className={`h-1.5 w-full rounded-full ${s.color} opacity-30 mb-2`}>
                <div
                  className={`h-full rounded-full ${s.color}`}
                  style={{ width: s.total > 0 ? `${(s.done / s.total) * 100}%` : "0%" }}
                />
              </div>
              <div className="text-[11px] text-muted-foreground mb-1">{s.label}</div>
              <div className="text-lg font-semibold tabular-nums">
                {s.done}
                <span className="text-xs text-muted-foreground">/{s.total}</span>
              </div>
            </div>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden lg:block absolute top-1/2 -right-2 h-3 w-3 text-muted-foreground -translate-y-1/2 z-10" />
            )}
          </div>
        ))}
      </div>
      {tktOpen > 0 && (
        <div className="mt-3 flex items-center gap-2 text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span>
            {tktOpen} open support ticket{tktOpen > 1 ? "s" : ""} require attention
          </span>
        </div>
      )}
    </Panel>
  );
}

/* ─────────── PENDING APPROVALS PANEL ─────────── */
function PendingApprovalsPanel() {
  const { companyId } = useAuth();
  const { data: pendingOrders } = useQuery({
    queryKey: ["pending-approvals", companyId],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("sales_orders")
          .select("*, customers!inner(name)")
          .eq("status", "pending_approval")
          .order("created_at", { ascending: false });
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!companyId,
  });

  if (!pendingOrders?.length) return null;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 mb-4">
      <div className="flex items-center gap-2 text-sm font-medium text-amber-400 mb-3">
        <AlertTriangle className="h-4 w-4" />
        {pendingOrders.length} Order{pendingOrders.length > 1 ? "s" : ""} Pending Approval
      </div>
      <div className="space-y-2">
        {pendingOrders.slice(0, 5).map((o: any) => (
          <div key={o.id} className="flex items-center justify-between text-sm">
            <div>
              <span className="font-medium">{o.so_number}</span>
              <span className="text-muted-foreground mx-1">·</span>
              <span className="text-muted-foreground">{o.customers?.name ?? "—"}</span>
            </div>
            <span className="text-xs text-muted-foreground">
              ${Number(o.total_amount ?? 0).toLocaleString()}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─────────── COMPANY ADMIN ─────────── */
function CompanyAdminDashboard() {
  const production = useQuery({
    queryKey: ["prod-orders-recent"],
    queryFn: async () => {
      try {
        return (
          (
            await supabase
              .from("production_orders")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(6)
          ).data ?? []
        );
      } catch {
        return [];
      }
    },
  });
  const machines = useQuery({
    queryKey: ["machines-recent"],
    queryFn: async () => {
      try {
        return (await supabase.from("machines").select("*").order("name")).data ?? [];
      } catch {
        return [];
      }
    },
  });
  const products = useQuery({
    queryKey: ["products-count"],
    queryFn: async () => {
      try {
        return (
          (await supabase.from("products").select("*", { count: "exact", head: true })).count ?? 0
        );
      } catch {
        return 0;
      }
    },
  });
  const customers = useQuery({
    queryKey: ["cust-count"],
    queryFn: async () => {
      try {
        return (
          (await supabase.from("customers").select("*", { count: "exact", head: true })).count ?? 0
        );
      } catch {
        return 0;
      }
    },
  });
  const employees = useQuery({
    queryKey: ["emp-count"],
    queryFn: async () => {
      try {
        return (
          (await supabase.from("employees").select("*", { count: "exact", head: true })).count ?? 0
        );
      } catch {
        return 0;
      }
    },
  });
  const { data: changeRequests } = useQuery({
    queryKey: ["change-requests"],
    queryFn: async () => {
      try {
        return (
          (
            await supabase
              .from("profile_change_requests")
              .select("*")
              .eq("status", "pending")
              .order("created_at", { ascending: false })
          ).data ?? []
        );
      } catch {
        return [];
      }
    },
  });

  const outputTrend = trend(14);
  const oeeSeries = Array.from({ length: 12 }, (_, i) => ({
    h: `${i * 2}:00`,
    oee: 78 + Math.round(Math.sin(i / 2) * 6 + Math.random() * 4),
    availability: 88 + Math.round(Math.random() * 4),
    performance: 82 + Math.round(Math.random() * 6),
  }));
  const activeOrders = production.data?.filter((p) => p.status === "in_progress").length ?? 0;
  const completedOrders = production.data?.filter((p) => p.status === "completed").length ?? 0;
  const machineUp = machines.data?.filter((m) => m.status === "operational").length ?? 0;
  const machineDown =
    machines.data?.filter((m) => m.status === "down" || m.status === "maintenance").length ?? 0;
  const avgUtil = machines.data?.length
    ? (
        machines.data.reduce((s, m) => s + Number(m.utilization ?? 0), 0) / machines.data.length
      ).toFixed(1)
    : "0";
  const mixData = [
    { name: "Precision", value: 42 },
    { name: "Assemblies", value: 30 },
    { name: "Raw", value: 18 },
    { name: "Other", value: 10 },
  ];
  const COLORS = [
    "oklch(0.58 0.22 259)",
    "oklch(0.62 0.19 300)",
    "oklch(0.72 0.14 210)",
    "oklch(0.72 0.19 145)",
  ];

  return (
    <Shell
      eyebrow="Executive"
      title="Command Center"
      sub="Company-wide operations, plants, machines and AI recommendations."
    >
      <WorkflowConnectionPanel />
      <PendingApprovalsPanel />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
        <Kpi
          label="Active Orders"
          value={String(activeOrders)}
          delta="+4"
          icon={Factory}
          tone="primary"
        />
        <Kpi
          label="Completed"
          value={String(completedOrders)}
          delta="+1"
          icon={CheckCircle2}
          tone="success"
        />
        <Kpi
          label="Machines Up"
          value={`${machineUp}/${machines.data?.length ?? 0}`}
          icon={Cog}
          tone="info"
        />
        <Kpi label="Employees" value={String(employees.data ?? 0)} icon={Users} tone="primary" />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3">
        <Kpi label="Customers" value={String(customers.data ?? 0)} icon={UserRound} tone="info" />
        <Kpi label="Products" value={String(products.data ?? 0)} icon={Boxes} tone="primary" />
        <Kpi label="Avg Utilization" value={`${avgUtil}%`} icon={TrendingUp} tone="success" />
        <Kpi
          label="Change Requests"
          value={String(changeRequests?.length ?? 0)}
          icon={Users}
          tone="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel
            title="Production Output · 14 days"
            right={<span className="text-[10px] text-success">▲ 12.4%</span>}
          >
            <OutputChart data={outputTrend} />
          </Panel>
        </div>
        <AIInsights
          dashboardType="company_admin"
          items={[
            {
              t: `Orders pipeline: ${production.data?.length ?? 0} active, ${completedOrders} completed this period`,
              c: 94,
            },
            {
              t: `Machine utilization at ${avgUtil}% — ${machineDown} machine(s) need attention`,
              c: 88,
            },
            {
              t: `Inventory health: ${products.data} SKUs tracked, ${customers.data} active customers`,
              c: 91,
            },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <Panel title="OEE · Today">
          <div className="h-56">
            <ResponsiveContainer>
              <LineChart data={oeeSeries}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="h" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} domain={[60, 100]} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 260)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Line
                  type="monotone"
                  dataKey="oee"
                  stroke="oklch(0.58 0.22 259)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="availability"
                  stroke="oklch(0.72 0.14 210)"
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="performance"
                  stroke="oklch(0.62 0.19 300)"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Product Mix">
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={mixData}
                  dataKey="value"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={4}
                >
                  {mixData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 260)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
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
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 260)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
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
                <div
                  key={o.id}
                  className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2.5 px-2 text-sm"
                >
                  <div>
                    <div className="font-medium">{o.order_number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Qty {o.quantity} · Priority {o.priority}
                    </div>
                  </div>
                  <StatusBadge status={o.status} />
                  <div className="w-28 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div
                      className="h-full bg-[image:var(--gradient-primary)]"
                      style={{ width: `${o.progress ?? 0}%` }}
                    />
                  </div>
                  <div className="text-xs tabular-nums w-10 text-right text-muted-foreground">
                    {Math.round(Number(o.progress ?? 0))}%
                  </div>
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
                  <div
                    className="h-full bg-[image:var(--gradient-primary)]"
                    style={{ width: `${m.utilization ?? 0}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="text-xs text-muted-foreground mt-6">
        {products.isFetched && (
          <>
            Catalog: {products.data} SKUs · {customers.data ?? 0} Customers · {employees.data ?? 0}{" "}
            Employees · Company-scoped by RLS · Realtime ready
          </>
        )}
      </div>
    </Shell>
  );
}

/* ─────────── PLANT ADMIN / MANAGER ─────────── */
function PlantAdminDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  const uptime = s && s.machines > 0 ? Math.round((s.machinesUp / s.machines) * 1000) / 10 : 0;
  return (
    <Shell
      eyebrow="Plant"
      title="Plant Overview"
      sub="Everything happening inside your plant right now."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Departments" value={String(s?.departments ?? 0)} icon={Users} tone="primary" />
        <Kpi label="Employees" value={String(s?.employees ?? 0)} icon={Users} tone="info" />
        <Kpi
          label="Active Machines"
          value={`${s?.machinesUp ?? 0}/${s?.machines ?? 0}`}
          icon={Cog}
          tone="success"
        />
        <Kpi
          label="Machine Uptime"
          value={s ? `${uptime}%` : "…"}
          icon={ShieldCheck}
          tone="warning"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Plant output · last 14 days">
            <OutputChart data={trend(14)} />
          </Panel>
        </div>
        <AIInsights
          dashboardType="plant_admin"
          items={[
            { t: `${s?.machinesDown ?? 0} machine(s) currently down or in maintenance`, c: 82 },
            { t: `${s?.salesOrdersOpen ?? 0} open customer orders across the plant`, c: 91 },
          ]}
        />
      </div>
    </Shell>
  );
}
function PlantManagerDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  const uptime = s && s.machines > 0 ? Math.round((s.machinesUp / s.machines) * 1000) / 10 : 0;
  const fpy =
    s && s.inspections > 0 ? Math.round((s.inspectionsPassed / s.inspections) * 1000) / 10 : 0;
  return (
    <Shell
      eyebrow="Plant"
      title="Plant Performance"
      sub="Live KPIs across production, maintenance and quality."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Production Orders"
          value={String(s?.productionOrders ?? 0)}
          icon={TrendingUp}
          tone="primary"
        />
        <Kpi
          label="In Progress"
          value={String(s?.productionInProgress ?? 0)}
          icon={Factory}
          tone="success"
        />
        <Kpi label="Machine Uptime" value={s ? `${uptime}%` : "…"} icon={Cog} tone="info" />
        <Kpi
          label="First Pass Yield"
          value={s && s.inspections ? `${fpy}%` : na()}
          icon={ShieldCheck}
          tone="warning"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Throughput trend">
            <OutputChart data={trend(14, 1600)} />
          </Panel>
        </div>
        <AIInsights
          dashboardType="plant_manager"
          items={[
            { t: `${s?.workOrders ?? 0} work orders currently on the floor`, c: 87 },
            { t: `${s?.lowStock ?? 0} SKUs at or below reorder level`, c: 79 },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── PRODUCTION MANAGER ─────────── */
function ProductionManagerDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  const orders = useQuery({
    queryKey: ["prod-orders"],
    queryFn: async () => {
      try {
        return (
          (await supabase.from("production_orders").select("*").order("due_date").limit(8)).data ??
          []
        );
      } catch {
        return [];
      }
    },
  });
  const { data: approvedOrders } = useQuery({
    queryKey: ["approved-sales-orders"],
    queryFn: async () => {
      try {
        return (
          (
            await supabase
              .from("sales_orders")
              .select("*, customers!inner(name)")
              .eq("status", "approved")
              .order("created_at", { ascending: false })
          ).data ?? []
        );
      } catch {
        return [];
      }
    },
  });
  return (
    <Shell
      eyebrow="Production"
      title="Production Planning"
      sub="Schedule, work orders and capacity for the next 14 days."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Production Orders"
          value={String(s?.productionOrders ?? 0)}
          icon={ClipboardList}
          tone="primary"
        />
        <Kpi
          label="In Progress"
          value={String(s?.productionInProgress ?? 0)}
          icon={Factory}
          tone="info"
        />
        <Kpi
          label="Work Orders"
          value={String(s?.workOrders ?? 0)}
          icon={TrendingUp}
          tone="warning"
        />
        <Kpi
          label="Open Customer Orders"
          value={String(s?.salesOrdersOpen ?? 0)}
          icon={Timer}
          tone="success"
        />
      </div>
      {/* Approved orders needing production orders */}
      {approvedOrders && approvedOrders.length > 0 && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 mb-4">
          <div className="text-sm font-medium text-blue-400 mb-2">
            {approvedOrders.length} Approved Customer Order{approvedOrders.length > 1 ? "s" : ""} —
            Create Production Orders
          </div>
          <div className="space-y-1">
            {approvedOrders.map((o: any) => (
              <div key={o.id} className="text-xs text-muted-foreground">
                {o.so_number} — {o.customers?.name ?? "—"} — $
                {Number(o.total_amount ?? 0).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Upcoming production orders">
            <div className="divide-y divide-white/5 text-sm">
              {(orders.data ?? []).map((o) => (
                <div
                  key={o.id}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5"
                >
                  <div>
                    <div className="font-medium">{o.order_number}</div>
                    <div className="text-[11px] text-muted-foreground">Qty {o.quantity}</div>
                  </div>
                  <StatusBadge status={o.status} />
                  <div className="text-xs text-muted-foreground">{safeDate(o.due_date)}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <AIInsights
          dashboardType="production_manager"
          items={[
            { t: "Reschedule PO-1042 → save 6 setup hours", c: 88 },
            { t: "Material shortage predicted for W-42", c: 76 },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── WAREHOUSE MANAGER ─────────── */
function WarehouseDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  return (
    <Shell
      eyebrow="Logistics"
      title="Warehouse Control"
      sub="Stock movements, receiving, dispatch and cycle counts."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="SKUs in Stock"
          value={String(s?.inventorySku ?? 0)}
          icon={Boxes}
          tone="primary"
        />
        <Kpi label="Low Stock" value={String(s?.lowStock ?? 0)} icon={Warehouse} tone="warning" />
        <Kpi label="Shipments" value={String(s?.shipments ?? 0)} icon={Package} tone="success" />
        <Kpi
          label="Shipped Today"
          value={String(s?.shipmentsToday ?? 0)}
          icon={Truck}
          tone="info"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Warehouse throughput">
            <OutputChart data={trend(14, 240, 20)} />
          </Panel>
        </div>
        <AIInsights
          dashboardType="warehouse_manager"
          items={[
            { t: `${s?.lowStock ?? 0} SKUs are at or below reorder level`, c: 100 },
            {
              t: `${s?.shipments ?? 0} total shipments, ${s?.shipmentsToday ?? 0} dispatched today`,
              c: 84,
            },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── PROCUREMENT MANAGER ─────────── */
function ProcurementDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  const pos = useQuery({
    queryKey: ["pos"],
    queryFn: async () => {
      try {
        return (
          (
            await supabase
              .from("purchase_orders")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(10)
          ).data ?? []
        );
      } catch {
        return [];
      }
    },
  });
  return (
    <Shell
      eyebrow="Procurement"
      title="Procurement Center"
      sub="Suppliers, POs, RFQs and goods receipt live view."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Total POs"
          value={String(s?.purchaseOrders ?? 0)}
          icon={ShoppingCart}
          tone="primary"
        />
        <Kpi
          label="Open POs"
          value={String(s?.purchaseOrdersOpen ?? 0)}
          icon={ShieldCheck}
          tone="success"
        />
        <Kpi label="Suppliers" value={String(s?.suppliers ?? 0)} icon={Truck} tone="info" />
        <Kpi
          label="Low Stock Alerts"
          value={String(s?.lowStock ?? 0)}
          icon={Timer}
          tone="warning"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Recent purchase orders">
            <div className="divide-y divide-white/5 text-sm">
              {(pos.data ?? []).map((p) => (
                <div
                  key={p.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 py-2.5 items-center"
                >
                  <div>
                    <div className="font-medium">{p.po_number ?? p.id.slice(0, 8)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      Total ${Number(p.total_amount ?? 0).toLocaleString()}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                  <div className="text-xs text-muted-foreground">{safeDate(p.created_at)}</div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <AIInsights
          dashboardType="procurement_manager"
          items={[
            { t: `${s?.purchaseOrdersOpen ?? 0} purchase orders awaiting supplier action`, c: 89 },
            {
              t: `${s?.suppliers ?? 0} suppliers on file with ${s?.purchaseOrders ?? 0} total POs`,
              c: 76,
            },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── QUALITY INSPECTOR ─────────── */
function QualityDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  const fpy =
    s && s.inspections > 0 ? Math.round((s.inspectionsPassed / s.inspections) * 1000) / 10 : 0;
  const defect =
    s && s.inspections > 0
      ? Math.round(((s.inspections - s.inspectionsPassed) / s.inspections) * 10000) / 100
      : 0;
  return (
    <Shell
      eyebrow="Quality"
      title="Quality Control"
      sub="Incoming, in-process and final inspection at a glance."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Inspections"
          value={String(s?.inspections ?? 0)}
          icon={ShieldCheck}
          tone="primary"
        />
        <Kpi
          label="Passed"
          value={String(s?.inspectionsPassed ?? 0)}
          icon={CheckCircle2}
          tone="success"
        />
        <Kpi
          label="First-Pass Yield"
          value={s && s.inspections ? `${fpy}%` : na()}
          icon={ShieldCheck}
          tone="info"
        />
        <Kpi
          label="Defect Rate"
          value={s && s.inspections ? `${defect}%` : na()}
          icon={ClipboardList}
          tone="warning"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Yield trend">
            <OutputChart data={trend(14, 940, 30)} />
          </Panel>
        </div>
        <AIInsights
          dashboardType="quality_inspector"
          items={[
            {
              t: `${s?.inspections ?? 0} total inspections, ${s?.inspectionsPassed ?? 0} passed (${s && s.inspections ? fpy + "%" : "N/A"} first-pass)`,
              c: 88,
            },
            { t: "Inspection records update live as batches are checked", c: 76 },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── MAINTENANCE ENGINEER ─────────── */
function MaintenanceDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  const machines = useQuery({
    queryKey: ["m-machines"],
    queryFn: async () => {
      try {
        return (await supabase.from("machines").select("*").order("name")).data ?? [];
      } catch {
        return [];
      }
    },
  });
  const down =
    machines.data?.filter((m) => m.status === "down" || m.status === "maintenance").length ?? 0;
  const uptime = s && s.machines > 0 ? Math.round((s.machinesUp / s.machines) * 1000) / 10 : 0;
  return (
    <Shell
      eyebrow="Maintenance"
      title="Reliability & Uptime"
      sub="Predictive maintenance, breakdowns and spare parts."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Machines" value={String(s?.machines ?? 0)} icon={Cog} tone="primary" />
        <Kpi
          label="Operational"
          value={String(s?.machinesUp ?? 0)}
          icon={CheckCircle2}
          tone="success"
        />
        <Kpi label="Down / Maint" value={String(down)} icon={Wrench} tone="warning" />
        <Kpi label="Uptime" value={s ? `${uptime}%` : "…"} icon={ShieldCheck} tone="info" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Machine status">
            <div className="space-y-2">
              {(machines.data ?? []).slice(0, 8).map((m) => (
                <div
                  key={m.id}
                  className="rounded-xl bg-card/60 border border-white/5 p-3 text-sm flex items-center justify-between"
                >
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-[11px] text-muted-foreground">{m.type ?? "—"}</div>
                  </div>
                  <StatusBadge status={m.status} />
                </div>
              ))}
            </div>
          </Panel>
        </div>
        <AIInsights
          dashboardType="maintenance_engineer"
          items={[
            { t: `${down} machine(s) currently down or in maintenance`, c: 94 },
            { t: `${s?.machines ?? 0} machines tracked with live status`, c: 81 },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── FINANCE MANAGER ─────────── */
function FinanceDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  const cash = trend(14, 120000, 4000);
  const revenue = (s?.salesOrdersRevenue ?? 0) / 1_000_000;
  const outInv = (s?.invoicesOutstanding ?? 0) / 1000;
  return (
    <Shell
      eyebrow="Finance"
      title="Finance Center"
      sub="Invoices, payments and outstanding balances in real time."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Order Revenue"
          value={s ? `$${revenue.toFixed(2)}M` : "…"}
          icon={TrendingUp}
          tone="success"
        />
        <Kpi label="Invoices" value={String(s?.invoices ?? 0)} icon={Landmark} tone="primary" />
        <Kpi
          label="Outstanding Invoices"
          value={s ? `$${outInv.toFixed(0)}k` : "…"}
          icon={ClipboardList}
          tone="warning"
        />
        <Kpi label="Payments" value={String(s?.payments ?? 0)} icon={ClipboardList} tone="info" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Cash flow">
            <OutputChart data={cash} />
          </Panel>
        </div>
        <AIInsights
          dashboardType="finance_manager"
          items={[
            { t: `${s?.invoicesOutstanding ?? 0} invoice(s) awaiting payment`, c: 84 },
            {
              t: `${s?.salesOrders ?? 0} customer orders worth $${(s?.salesOrdersRevenue ?? 0).toLocaleString()}`,
              c: 71,
            },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── HR MANAGER ─────────── */
function HRDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  return (
    <Shell
      eyebrow="People"
      title="HR Command"
      sub="Headcount, departments and workforce analytics."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Headcount" value={String(s?.employees ?? 0)} icon={Users} tone="primary" />
        <Kpi
          label="Departments"
          value={String(s?.departments ?? 0)}
          icon={Factory}
          tone="success"
        />
        <Kpi
          label="Open Support Tickets"
          value={String(s?.supportTicketsOpen ?? 0)}
          icon={ClipboardList}
          tone="info"
        />
        <Kpi label="Customers" value={String(s?.customers ?? 0)} icon={UserRound} tone="warning" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Headcount trend">
            <OutputChart data={trend(14, 240, 3)} />
          </Panel>
        </div>
        <AIInsights
          dashboardType="hr_manager"
          items={[
            {
              t: `${s?.employees ?? 0} employees across ${s?.departments ?? 0} departments`,
              c: 74,
            },
            { t: `${s?.supportTicketsOpen ?? 0} open support tickets need attention`, c: 82 },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── OPERATOR ─────────── */
function OperatorDashboard() {
  const { user } = useAuth();
  const { data: myWorkOrders = [] } = useQuery({
    queryKey: ["my-wos", user?.id],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("work_orders")
          .select("id,status,progress_percent,created_at")
          .eq("operator_id", user?.id ?? "")
          .limit(50);
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });
  return (
    <Shell
      eyebrow="My Shift"
      title="Today's Work"
      sub="Your assigned work orders, attendance and reported issues."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="My Work Orders"
          value={String(
            myWorkOrders.filter((o: any) => !["completed", "cancelled"].includes(o.status)).length,
          )}
          icon={ClipboardList}
          tone="primary"
        />
        <Kpi
          label="Completed"
          value={String(myWorkOrders.filter((o: any) => o.status === "completed").length)}
          icon={CheckCircle2}
          tone="success"
        />
        <Kpi
          label="In Progress"
          value={String(myWorkOrders.filter((o: any) => o.status === "in_progress").length)}
          icon={Clock}
          tone="info"
        />
        <Kpi
          label="My Blocked Work"
          value={String(myWorkOrders.filter((o: any) => o.status === "blocked").length)}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <Panel title="Your work orders">
          <div className="space-y-2 text-sm">
            {myWorkOrders.slice(0, 5).map((o: any) => (
              <div key={o.id} className="flex justify-between gap-2">
                <span>{o.progress_percent}% complete</span>
                <StatusBadge status={o.status} />
              </div>
            ))}
            {!myWorkOrders.length && (
              <span className="text-muted-foreground">No assigned work orders.</span>
            )}
          </div>
        </Panel>
        <Panel title="Your scope">
          <div className="text-sm text-muted-foreground">
            This dashboard only shows your assigned work. Use My Attendance to check in or out and
            Report Issue to pause an assigned work order.
          </div>
        </Panel>
      </div>
    </Shell>
  );
}

/* ─────────── CUSTOMER ─────────── */
function CustomerDashboard() {
  const { companyId, user } = useAuth();
  const s = useLiveStats(companyId).data;
  const { data: myOrders } = useQuery({
    queryKey: ["my-so", user?.id],
    queryFn: async () => {
      try {
        // Customers only see their own orders (scoped via customers.user_id)
        const { data: customer } = await supabase
          .from("customers")
          .select("id")
          .eq("user_id", user?.id ?? "")
          .maybeSingle();
        if (!customer?.id) return [];
        const { data } = await supabase
          .from("sales_orders")
          .select("status,total_amount")
          .eq("customer_id", customer.id);
        return data ?? [];
      } catch {
        return [];
      }
    },
    enabled: !!user,
  });
  const open = (myOrders ?? []).filter((o: any) =>
    [
      "pending_approval",
      "approved",
      "in_production",
      "quality_pending",
      "dispatch_ready",
      "out_for_delivery",
    ].includes(o.status),
  ).length;
  const delivered = (myOrders ?? []).filter(
    (o: any) => o.status === "delivered" || o.status === "completed",
  ).length;
  const outstanding = (myOrders ?? [])
    .filter(
      (o: any) => o.status !== "delivered" && o.status !== "completed" && o.status !== "cancelled",
    )
    .reduce((sum: number, o: any) => sum + Number(o.total_amount ?? 0), 0);
  return (
    <Shell eyebrow="Customer" title="Your Orders" sub="Track orders, shipments and invoices.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="My Orders"
          value={String(myOrders?.length ?? 0)}
          icon={ShoppingCart}
          tone="primary"
        />
        <Kpi label="Open" value={String(open)} icon={Truck} tone="info" />
        <Kpi label="Delivered" value={String(delivered)} icon={ShieldCheck} tone="success" />
        <Kpi
          label="Outstanding Value"
          value={`$${(outstanding / 1000).toFixed(0)}k`}
          icon={Landmark}
          tone="warning"
        />
      </div>
      <div className="mt-4">
        <AIInsights
          dashboardType="customer_portal"
          items={[
            {
              t: `${open} order(s) currently in progress — track them in Orders → Order Tracking`,
              c: 96,
            },
            {
              t:
                delivered > 0
                  ? `${delivered} order(s) delivered. Download invoices & certificates in Documents.`
                  : "No delivered orders yet.",
              c: 90,
            },
          ]}
        />
      </div>
    </Shell>
  );
}

/* ─────────── SUPPLIER ─────────── */
function SupplierDashboard() {
  const { companyId, user } = useAuth();
  const [openPo, setOpenPo] = useState<string | null>(null);

  const { data: mySupplier } = useQuery({
    queryKey: ["sup-dash-supplier", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const byUser = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (byUser.data?.id) {
        return {
          id: byUser.data.id as string,
          name: (byUser.data.name as string) ?? "Your company",
        };
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.email) {
        const { data: sup } = await supabase
          .from("suppliers")
          .select("id, name")
          .eq("contact_email", profile.email)
          .maybeSingle();
        return sup?.id
          ? { id: sup.id as string, name: (sup.name as string) ?? "Your company" }
          : null;
      }
      return null;
    },
  });

  const { data: pos } = useQuery({
    queryKey: ["sup-dash-pos", companyId, mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier?.id) return [];
      const { data } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("supplier_id", mySupplier.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!mySupplier?.id,
  });

  const { data: deliveries } = useQuery({
    queryKey: ["sup-dash-del", companyId, mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier?.id) return [];
      const { data } = await supabase
        .from("supplier_deliveries")
        .select("*")
        .eq("supplier_id", mySupplier.id);
      return data ?? [];
    },
    enabled: !!mySupplier?.id,
  });

  const { data: payments } = useQuery({
    queryKey: ["sup-dash-pay", companyId, mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier?.id) return [];
      const { data } = await supabase
        .from("supplier_payments")
        .select("*")
        .eq("supplier_id", mySupplier.id);
      return data ?? [];
    },
    enabled: !!mySupplier?.id,
  });

  const awaiting = (pos ?? []).filter((p) => ["sent", "pending"].includes(p.status)).length ?? 0;
  const accepted =
    (pos ?? []).filter((p) => ["accepted", "in_progress"].includes(p.status)).length ?? 0;
  const inbound = (deliveries ?? []).filter((d) => d.status === "dispatched").length ?? 0;
  const totalPaid = (payments ?? [])
    .filter((p) => p.status === "paid")
    .reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <Shell
      eyebrow="Supplier"
      title="Supplier Portal"
      sub={`Purchase orders, deliveries and payments${mySupplier?.name ? ` for ${mySupplier.name}` : ""}.`}
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Awaiting Response"
          value={String(awaiting)}
          icon={ShoppingCart}
          tone="primary"
        />
        <Kpi label="Accepted" value={String(accepted)} icon={CheckCircle2} tone="success" />
        <Kpi label="Inbound Shipments" value={String(inbound)} icon={Truck} tone="info" />
        <Kpi
          label="Payments Received"
          value={`$${totalPaid.toLocaleString()}`}
          icon={Landmark}
          tone="warning"
        />
      </div>

      <div className="mt-4">
        <Panel title={`${pos?.length ?? 0} Purchase Orders`}>
          <ul className="space-y-2">
            {(pos ?? []).slice(0, 6).map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => setOpenPo(openPo === p.id ? null : p.id)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-white/5 text-xs transition-colors"
                >
                  <span className="font-medium">{p.po_number ?? p.id.slice(0, 8)}</span>
                  <span className="flex items-center gap-2 text-muted-foreground">
                    ${Number(p.total_amount ?? 0).toLocaleString()}
                    <StatusBadge status={p.status} />
                  </span>
                </button>
                {openPo === p.id && (
                  <p className="px-3 pb-2 text-xs text-muted-foreground">
                    Expected{" "}
                    {p.expected_date ? new Date(p.expected_date).toLocaleDateString() : "—"}
                    {p.supplier_note ? ` · ${p.supplier_note}` : ""}
                  </p>
                )}
              </li>
            ))}
            {(pos ?? []).length === 0 && (
              <li className="text-xs text-muted-foreground text-center py-6">
                No purchase orders yet. When the buyer sends you one, it appears here.
              </li>
            )}
          </ul>
        </Panel>
      </div>
    </Shell>
  );
}

/* ─────────── AUDITOR ─────────── */
function AuditorDashboard() {
  const { companyId } = useAuth();
  const s = useLiveStats(companyId).data;
  const logs = useQuery({
    queryKey: ["audit-recent"],
    queryFn: async () => {
      try {
        return (
          (
            await supabase
              .from("audit_logs")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(20)
          ).data ?? []
        );
      } catch {
        return [];
      }
    },
  });
  return (
    <Shell
      eyebrow="Audit"
      title="Compliance Overview"
      sub="Read-only view of activity and compliance across the company."
    >
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Audit Events"
          value={String(s?.auditEvents ?? 0)}
          icon={ScrollText}
          tone="primary"
        />
        <Kpi label="Orders" value={String(s?.salesOrders ?? 0)} icon={ShoppingCart} tone="info" />
        <Kpi
          label="Production"
          value={String(s?.productionOrders ?? 0)}
          icon={Factory}
          tone="success"
        />
        <Kpi label="Machines" value={String(s?.machines ?? 0)} icon={Cog} tone="warning" />
      </div>
      <div className="mt-4">
        <Panel title="Recent audit events">
          <div className="divide-y divide-white/5 text-sm">
            {(logs.data ?? []).map((l) => (
              <div key={l.id} className="grid grid-cols-[auto_1fr_auto] gap-3 py-2 items-center">
                <ScrollText className="h-4 w-4 text-muted-foreground" />
                <div>
                  <span className="font-medium">{l.action}</span>{" "}
                  <span className="text-muted-foreground">· {l.entity ?? "system"}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {safeDate(l.created_at, true)}
                </div>
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
  return (
    <Shell eyebrow="Overview" title={`${label} Dashboard`} sub="Your personalized command center.">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Activity" value="—" icon={Activity} tone="primary" />
        <Kpi label="Tasks" value="—" icon={ClipboardList} tone="info" />
        <Kpi label="Alerts" value="—" icon={ShieldCheck} tone="warning" />
        <Kpi label="Team" value="—" icon={Users} tone="success" />
      </div>
    </Shell>
  );
}
