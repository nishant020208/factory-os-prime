import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, Kpi, EmptyState, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { safeDate } from "@/lib/utils";
import {
  CheckCircle2,
  Clock,
  Download,
  Loader2,
  AlertTriangle,
  Wallet,
  ClipboardCheck,
  Boxes,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { fmtMoney } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/compliance")({
  head: () => ({
    meta: [
      { title: "Compliance Reports — FactoryOS AI" },
      {
        name: "description",
        content: "Read-only compliance reports: approvals, payments, invoices, quality and stock.",
      },
    ],
  }),
  component: CompliancePage,
});

type Row = Record<string, unknown> & { id: string };

async function fetchAll<T extends Row>(table: string, limit = 500): Promise<T[]> {
  try {
    const { data, error } = await supabase
      .from(table as never)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return [];
    return (data ?? []) as T[];
  } catch {
    return [];
  }
}

function downloadCsv(filename: string, rows: Row[], labelFor: (r: Row) => string[]) {
  const labels = labelFor(rows[0] ?? ({} as Row));
  const body = rows
    .map((r) => labelFor(r).map((s) => `"${String(s ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([labels.map((l) => `"${l}"`).join(",") + "\n" + body], {
    type: "text/csv",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  toast.success(`Exported ${rows.length} rows`);
}

function CompliancePage() {
  const { companyId } = useAuth();
  const [tab, setTab] = useState("approvals");

  const approvals = useQuery({ queryKey: ["comp-approvals", companyId], queryFn: () => fetchAll("approvals") });
  const payments = useQuery({ queryKey: ["comp-payments", companyId], queryFn: () => fetchAll("payments") });
  const invoices = useQuery({ queryKey: ["comp-invoices", companyId], queryFn: () => fetchAll("invoices") });
  const quality = useQuery({ queryKey: ["comp-quality", companyId], queryFn: () => fetchAll("quality_inspections") });
  const stock = useQuery({ queryKey: ["comp-stock", companyId], queryFn: () => fetchAll("inventory") });

  const a = approvals.data ?? [];
  const p = payments.data ?? [];
  const inv = invoices.data ?? [];
  const q = quality.data ?? [];
  const st = stock.data ?? [];

  const kpis = useMemo(() => {
    const pendingApprovals = a.filter((r) => r.status === "pending").length;
    const approvedApprovals = a.filter((r) => r.status === "approved").length;
    const overdue = inv.filter(
      (r) =>
        r.status !== "paid" &&
        r.status !== "cancelled" &&
        r.due_date &&
        new Date(String(r.due_date)) < new Date(),
    ).length;
    const failed = q.filter((r) => ["fail", "failed", "rejected"].includes(String(r.result).toLowerCase())).length;
    const zeroStock = st.filter((r) => Number(r.quantity ?? 0) <= 0).length;
    const paidTotal = p
      .filter((r) => r.status === "paid" || r.status === "completed")
      .reduce((s, r) => s + Number(r.amount ?? 0), 0);
    return { pendingApprovals, approvedApprovals, overdue, failed, zeroStock, paidTotal };
  }, [a, p, inv, q, st]);

  const loading = approvals.isLoading || payments.isLoading || invoices.isLoading || quality.isLoading || stock.isLoading;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="compliance" />
      <PageHeader
        eyebrow="Compliance"
        title="Compliance Reports"
        sub="Read-only reports pulled live from the operational tables — approvals, payments, invoices, quality and stock. Nothing here can be generated, edited or deleted."
        actions={<ModuleCopilot moduleName="compliance" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4 mb-6">
        <Kpi label="Approvals pending" value={String(kpis.pendingApprovals)} icon={Clock} tone="warning" />
        <Kpi label="Approvals done" value={String(kpis.approvedApprovals)} icon={CheckCircle2} tone="success" />
        <Kpi label="Overdue invoices" value={String(kpis.overdue)} icon={AlertTriangle} tone="destructive" />
        <Kpi label="QC failures" value={String(kpis.failed)} icon={ClipboardCheck} tone="destructive" />
        <Kpi label="Zero-stock SKUs" value={String(kpis.zeroStock)} icon={Boxes} tone="warning" />
        <Kpi label="Paid total" value={fmtMoney(kpis.paidTotal)} icon={Wallet} tone="info" />
      </div>

      {loading ? (
        <div className="py-20 flex items-center justify-center text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Computing compliance reports…
        </div>
      ) : (
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="mb-4 flex-wrap">
            <TabsTrigger value="approvals">Approvals</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="quality">Quality</TabsTrigger>
            <TabsTrigger value="stock">Stock</TabsTrigger>
          </TabsList>

          <TabsContent value="approvals">
            <ReportPanel
              title="Approvals over time"
              count={a.length}
              onExport={() =>
                downloadCsv("compliance-approvals", a, (r) => [
                  String(r.entity ?? ""),
                  String(r.requester_id ?? ""),
                  String(r.approver_id ?? ""),
                  String(r.status ?? ""),
                  r.notes ? String(r.notes) : "",
                  r.created_at ? safeDate(String(r.created_at), true) : "",
                  r.resolved_at ? safeDate(String(r.resolved_at), true) : "",
                ])
              }
              cols={["Module", "Requester", "Approver", "Status", "Notes", "Requested", "Resolved"]}
              rows={a.map((r) => [
                String(r.entity ?? "—"),
                String(r.requester_id ?? "—").slice(0, 8),
                String(r.approver_id ?? "—").slice(0, 8),
                <StatusBadge key="s" status={String(r.status ?? "")} />,
                String(r.notes ?? "—"),
                r.created_at ? safeDate(String(r.created_at), true) : "—",
                r.resolved_at ? safeDate(String(r.resolved_at), true) : "—",
              ])}
            />
          </TabsContent>

          <TabsContent value="payments">
            <ReportPanel
              title="Payments & discrepancies"
              count={p.length}
              onExport={() =>
                downloadCsv("compliance-payments", p, (r) => [
                  String(r.payment_number ?? ""),
                  String(r.customer_id ?? ""),
                  String(r.amount ?? ""),
                  String(r.method ?? ""),
                  String(r.status ?? ""),
                  r.paid_at ? safeDate(String(r.paid_at), true) : "",
                ])
              }
              cols={["Payment #", "Customer", "Amount", "Method", "Status", "Paid at"]}
              rows={p.map((r) => [
                String(r.payment_number ?? "—"),
                String(r.customer_id ?? "—").slice(0, 8),
                <span key="a" className="tabular-nums">{fmtMoney(Number(r.amount ?? 0))}</span>,
                String(r.method ?? "—"),
                <StatusBadge key="s" status={String(r.status ?? "")} />,
                r.paid_at ? safeDate(String(r.paid_at), true) : "—",
              ])}
            />
          </TabsContent>

          <TabsContent value="invoices">
            <ReportPanel
              title="Invoices (incl. overdue)"
              count={inv.length}
              onExport={() =>
                downloadCsv("compliance-invoices", inv, (r) => [
                  String(r.invoice_number ?? ""),
                  String(r.customer_id ?? ""),
                  String(r.total_amount ?? ""),
                  String(r.status ?? ""),
                  r.issue_date ? safeDate(String(r.issue_date), true) : "",
                  r.due_date ? safeDate(String(r.due_date), true) : "",
                ])
              }
              cols={["Invoice #", "Customer", "Total", "Status", "Issued", "Due"]}
              rows={inv.map((r) => {
                const overdue =
                  r.status !== "paid" &&
                  r.status !== "cancelled" &&
                  r.due_date &&
                  new Date(String(r.due_date)) < new Date();
                return [
                  String(r.invoice_number ?? "—"),
                  String(r.customer_id ?? "—").slice(0, 8),
                  <span key="a" className="tabular-nums">{fmtMoney(r.total_amount)}</span>,
                  overdue ? <span key="s" className="text-destructive text-xs font-medium">OVERDUE</span> : <StatusBadge key="s" status={String(r.status ?? "")} />,
                  r.issue_date ? safeDate(String(r.issue_date), true) : "—",
                  r.due_date ? safeDate(String(r.due_date), true) : "—",
                ];
              })}
            />
          </TabsContent>

          <TabsContent value="quality">
            <ReportPanel
              title="Quality inspection results"
              count={q.length}
              onExport={() =>
                downloadCsv("compliance-quality", q, (r) => [
                  String(r.inspection_number ?? ""),
                  String(r.inspection_type ?? ""),
                  String(r.result ?? ""),
                  String(r.defects_found ?? ""),
                  String(r.quantity_checked ?? ""),
                  r.created_at ? safeDate(String(r.created_at), true) : "",
                ])
              }
              cols={["Inspection #", "Type", "Result", "Defects", "Qty checked", "Date"]}
              rows={q.map((r) => [
                String(r.inspection_number ?? "—"),
                String(r.inspection_type ?? "—"),
                <StatusBadge key="s" status={String(r.result ?? "")} />,
                String(r.defects_found ?? 0),
                String(r.quantity_checked ?? 0),
                r.created_at ? safeDate(String(r.created_at), true) : "—",
              ])}
            />
          </TabsContent>

          <TabsContent value="stock">
            <ReportPanel
              title="Inventory / stock levels"
              count={st.length}
              onExport={() =>
                downloadCsv("compliance-stock", st, (r) => [
                  String(r.product_id ?? ""),
                  String(r.warehouse_id ?? ""),
                  String(r.material_id ?? ""),
                  String(r.quantity ?? 0),
                  r.updated_at ? safeDate(String(r.updated_at), true) : "",
                ])
              }
              cols={["Product", "Warehouse", "Material", "Qty on hand", "Updated"]}
              rows={st.map((r) => {
                const qty = Number(r.quantity ?? 0);
                return [
                  String(r.product_id ?? "—").slice(0, 8),
                  String(r.warehouse_id ?? "—").slice(0, 8),
                  String(r.material_id ?? "—").slice(0, 8),
                  qty <= 0 ? (
                    <span key="q" className="text-destructive text-xs font-medium tabular-nums">{qty}</span>
                  ) : (
                    <span key="q" className="tabular-nums">{qty}</span>
                  ),
                  r.updated_at ? safeDate(String(r.updated_at), true) : "—",
                ];
              })}
            />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ReportPanel({
  title,
  count,
  onExport,
  cols,
  rows,
}: {
  title: string;
  count: number;
  onExport: () => void;
  cols: string[];
  rows: Array<Array<React.ReactNode>>;
}) {
  return (
    <Panel
      title={`${title} · ${count}`}
      right={
        <Button variant="outline" size="sm" onClick={onExport} disabled={count === 0}>
          <Download className="h-4 w-4 mr-1" /> Export CSV
        </Button>
      }
    >
      {rows.length === 0 ? (
        <EmptyState
          title={`No ${title.toLowerCase()} yet`}
          sub="Records appear here as authorized roles create them. This report reads the live operational table."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                {cols.map((c) => (
                  <th key={c} className="px-3 py-2 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((cells, i) => (
                <tr key={i} className="border-b border-border/40 hover:bg-muted/30">
                  {cells.map((c, j) => (
                    <td key={j} className="px-3 py-2.5 text-xs whitespace-nowrap">{c}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
