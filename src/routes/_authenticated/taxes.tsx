import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, TrendingUp, TrendingDown, Scale, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { downloadCsv, todayStamp } from "@/lib/report-utils";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/taxes")({
  head: () => ({
    meta: [
      { title: "Taxes — FactoryOS AI" },
      { name: "description", content: "GST collected vs paid, net summary per period." },
    ],
  }),
  component: TaxesPage,
});

function TaxesPage() {
  const { companyId } = useAuth();

  // GST collected on customer invoices (money in).
  const { data: invoices } = useQuery({
    queryKey: ["tax-invoices", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("invoice_number, tax_amount, total_amount, status, issue_date")
          .eq("company_id", companyId!)
          .neq("status", "cancelled")
      ).data ?? [],
    enabled: !!companyId,
  });

  // GST paid on supplier invoices (money out).
  const { data: supplierInvoices } = useQuery({
    queryKey: ["tax-sup-invoices", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_invoices")
          .select("invoice_number, gst_amount, total_amount, status, created_at")
          .eq("company_id", companyId!)
      ).data ?? [],
    enabled: !!companyId,
  });

  const collected = (invoices ?? []).reduce(
    (s: number, i: any) => s + Number(i.tax_amount ?? 0),
    0,
  );
  const paid = (supplierInvoices ?? []).reduce(
    (s: number, i: any) => s + Number(i.gst_amount ?? 0),
    0,
  );
  const net = collected - paid;

  // Per-period breakdown.
  const byPeriod = new Map<string, { collected: number; paid: number; invoices: number; supInvoices: number }>();
  for (const i of invoices ?? []) {
    const k = (i.issue_date ?? "").slice(0, 7);
    if (!k) continue;
    const m = byPeriod.get(k) ?? { collected: 0, paid: 0, invoices: 0, supInvoices: 0 };
    m.collected += Number(i.tax_amount ?? 0);
    m.invoices += 1;
    byPeriod.set(k, m);
  }
  for (const i of supplierInvoices ?? []) {
    const k = (i.created_at ?? "").slice(0, 7);
    if (!k) continue;
    const m = byPeriod.get(k) ?? { collected: 0, paid: 0, invoices: 0, supInvoices: 0 };
    m.paid += Number(i.gst_amount ?? 0);
    m.supInvoices += 1;
    byPeriod.set(k, m);
  }
  const periods = [...byPeriod.keys()].sort().reverse();

  const download = () => {
    const rows = periods.map((p) => {
      const m = byPeriod.get(p)!;
      return {
        Period: p,
        collected: m.collected,
        paid: m.paid,
        net: m.collected - m.paid,
        invoices: m.invoices,
        supInvoices: m.supInvoices,
      };
    });
    downloadCsv(
      "finance-gst-summary",
      [
        { key: "Period", label: "Period" },
        { key: "collected", label: "GST Collected", align: "right" },
        { key: "paid", label: "GST Paid", align: "right" },
        { key: "net", label: "Net GST", align: "right" },
        { key: "invoices", label: "Customer Invoices", align: "right" },
        { key: "supInvoices", label: "Supplier Invoices", align: "right" },
      ],
      rows,
    );
    toast.success(`Downloaded finance-gst-summary-${todayStamp()}.csv`);
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Finance"
        title="GST / Tax"
        sub="GST collected on customer invoices, GST paid on supplier invoices, and net per period — real calculations."
        actions={
          <Button variant="outline" size="sm" onClick={download} disabled={periods.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" />
            Download GST Summary
          </Button>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="GST Collected" value={`$${(collected / 1000).toFixed(1)}k`} icon={TrendingUp} tone="success" />
        <Kpi label="GST Paid" value={`$${(paid / 1000).toFixed(1)}k`} icon={TrendingDown} tone="warning" />
        <Kpi label="Net GST" value={`$${(net / 1000).toFixed(1)}k`} icon={Scale} tone={net >= 0 ? "primary" : "destructive"} />
        <Kpi label="Periods Tracked" value={String(periods.length)} icon={FileText} tone="info" />
      </div>

      <div className="mt-4">
        <Panel title="GST Summary by Period">
          {periods.length === 0 ? (
            <EmptyState title="No tax data yet" sub="GST appears once invoices and supplier invoices carry tax amounts." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Period", "GST Collected", "GST Paid", "Net GST", "Customer Invoices", "Supplier Invoices"].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => {
                    const m = byPeriod.get(p)!;
                    const netP = m.collected - m.paid;
                    return (
                      <tr key={p} className="border-b border-white/5">
                        <td className="py-2.5 px-2 font-mono text-xs">{p}</td>
                        <td className="py-2.5 px-2 font-mono text-xs text-success">
                          ${m.collected.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-xs text-warning">
                          ${m.paid.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 font-mono text-xs font-medium">
                          ${netP.toLocaleString()}
                        </td>
                        <td className="py-2.5 px-2 tabular-nums">{m.invoices}</td>
                        <td className="py-2.5 px-2 tabular-nums">{m.supInvoices}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
