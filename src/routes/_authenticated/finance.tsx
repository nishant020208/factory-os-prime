import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Landmark, TrendingUp, Receipt, PiggyBank, FileText, ArrowDownToLine } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoneyK } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — FactoryOS AI" },
      {
        name: "description",
        content: "Revenue, receivables, payables and cash flow for this company.",
      },
    ],
  }),
  component: FinancePage,
});

function FinancePage() {
  const { companyId } = useAuth();

  // REAL customer invoices.
  const { data: invoices } = useQuery({
    queryKey: ["fin-invoices", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("*, customers!left(name, business_name)")
          .eq("company_id", companyId!)
          .order("issue_date", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  // REAL customer payments (money in).
  const { data: payments } = useQuery({
    queryKey: ["fin-payments", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("*, customers!left(name, business_name)")
          .eq("company_id", companyId!)
          .eq("status", "completed")
          .order("paid_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  // REAL supplier invoices (money out, awaiting payment).
  const { data: supplierInvoices } = useQuery({
    queryKey: ["fin-sup-invoices", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_invoices")
          .select("*, suppliers!left(name)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  // REAL supplier payments (money out, paid).
  const { data: supplierPayments } = useQuery({
    queryKey: ["fin-sup-payments", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_payments")
          .select("*, suppliers!left(name)")
          .eq("company_id", companyId!)
          .order("paid_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const now = new Date();
  const monthKey = now.toISOString().slice(0, 7);

  const totalRevenue = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const monthInvoices = (invoices ?? []).filter((i: any) =>
    i.issue_date?.startsWith(monthKey),
  ).length;
  const arOutstanding = (invoices ?? [])
    .filter((i: any) => i.status === "sent" || i.status === "overdue" || i.status === "draft")
    .reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);
  const apOutstanding = (supplierInvoices ?? [])
    .filter((i: any) => i.status === "pending")
    .reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);
  const moneyOut = (supplierPayments ?? []).reduce(
    (s: number, p: any) => s + Number(p.amount ?? 0),
    0,
  );
  const cashPosition = totalRevenue - moneyOut;
  const pendingPayments = (supplierInvoices ?? []).filter((i: any) => i.status === "pending").length;

  // Real cash-flow series: monthly money in vs money out.
  const byMonth = new Map<string, { in: number; out: number }>();
  for (const p of payments ?? []) {
    const k = (p.paid_at ?? "").slice(0, 7);
    if (!k) continue;
    const m = byMonth.get(k) ?? { in: 0, out: 0 };
    m.in += Number(p.amount ?? 0);
    byMonth.set(k, m);
  }
  for (const p of supplierPayments ?? []) {
    const k = (p.paid_at ?? "").slice(0, 7);
    if (!k) continue;
    const m = byMonth.get(k) ?? { in: 0, out: 0 };
    m.out += Number(p.amount ?? 0);
    byMonth.set(k, m);
  }
  const months = [...byMonth.keys()].sort();
  const cashflow = months.map((m) => ({
    m: new Date(m + "-01").toLocaleDateString(undefined, { month: "short" }),
    inflow: byMonth.get(m)!.in,
    outflow: byMonth.get(m)!.out,
  }));

  const fmt = (n: number) => fmtMoneyK(n);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Finance"
        title="Financial Overview"
        sub="Live revenue, receivables, payables and cash flow from real invoices and payments."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Total Revenue (lifetime)"
          value={fmt(totalRevenue)}
          icon={TrendingUp}
          tone="success"
        />
        <Kpi
          label="AR Outstanding"
          value={fmt(arOutstanding)}
          icon={Receipt}
          tone="warning"
        />
        <Kpi
          label="AP Outstanding"
          value={fmt(apOutstanding)}
          icon={Landmark}
          tone="info"
        />
        <Kpi
          label="Cash Position"
          value={fmt(cashPosition)}
          icon={PiggyBank}
          tone={cashPosition >= 0 ? "primary" : "destructive"}
        />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-4">
        <Kpi label="Invoices This Month" value={String(monthInvoices)} icon={FileText} tone="primary" />
        <Kpi label="Supplier Payments Pending" value={String(pendingPayments)} icon={ArrowDownToLine} tone="warning" />
        <Kpi label="Customer Payments Received" value={String(payments?.length ?? 0)} icon={TrendingUp} tone="success" />
        <Kpi label="Supplier Payments Made" value={String(supplierPayments?.length ?? 0)} icon={Landmark} tone="info" />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title="Cash Flow · Real Payments">
          {cashflow.length === 0 ? (
            <EmptyState title="No payments yet" sub="Cash flow appears once payments are recorded." />
          ) : (
            <div className="h-48 sm:h-72">
              <ResponsiveContainer>
                <AreaChart data={cashflow}>
                  <defs>
                    <linearGradient id="fin-in" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0.6} />
                      <stop offset="100%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="fin-out" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.62 0.23 25)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.62 0.23 25)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="m" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} tickFormatter={fmtMoneyK} />
                  <Tooltip
                    contentStyle={{
                      background: "oklch(0.20 0.025 260)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="inflow" stroke="oklch(0.72 0.19 145)" fill="url(#fin-in)" strokeWidth={2} />
                  <Area type="monotone" dataKey="outflow" stroke="oklch(0.62 0.23 25)" fill="url(#fin-out)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Recent Customer Payments">
          {(payments ?? []).length === 0 ? (
            <EmptyState title="No customer payments yet" sub="Customer payments appear here." />
          ) : (
            <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
              {(payments ?? []).slice(0, 8).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between py-2.5 text-sm">
                  <div>
                    <div className="font-medium">
                      {p.customers?.business_name ?? p.customers?.name ?? "Customer"}
                    </div>
                    <div className="text-[11px] text-muted-foreground font-mono">
                      {p.payment_number} · {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                    </div>
                  </div>
                  <div className="font-mono text-xs text-success">
                    +${Number(p.amount ?? 0).toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Supplier Invoices Awaiting Payment">
          {(supplierInvoices ?? []).length === 0 ? (
            <EmptyState title="No supplier invoices" sub="Supplier invoices appear here once raised." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Invoice #", "Supplier", "PO", "GST", "Total", "Status"].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(supplierInvoices ?? []).slice(0, 8).map((i: any) => (
                    <tr key={i.id} className="border-b border-white/5">
                      <td className="py-2.5 px-2 font-mono text-xs">{i.invoice_number}</td>
                      <td className="py-2.5 px-2">{i.suppliers?.name ?? "—"}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">{i.po_id?.slice(0, 8) ?? "—"}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">${Number(i.gst_amount ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">${Number(i.total_amount ?? 0).toLocaleString()}</td>
                      <td className="py-2.5 px-2">
                        <StatusBadge status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
