import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, Receipt, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoneyK } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/customer-ledger")({
  head: () => ({
    meta: [
      { title: "Customer Ledger — FactoryOS AI" },
      { name: "description", content: "Per-customer running balance from real invoices and payments." },
    ],
  }),
  component: CustomerLedgerPage,
});

function CustomerLedgerPage() {
  const { companyId } = useAuth();

  // REAL invoices per customer.
  const { data: invoices } = useQuery({
    queryKey: ["ledger-invoices", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("id, customer_id, total_amount, status, invoice_number, issue_date")
          .eq("company_id", companyId!)
          .order("issue_date", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  // REAL payments per customer.
  const { data: payments } = useQuery({
    queryKey: ["ledger-payments", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("customer_id, amount, status")
          .eq("company_id", companyId!)
          .eq("status", "completed")
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: customers } = useQuery({
    queryKey: ["ledger-customers", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("customers")
          .select("id, name, business_name, email")
          .eq("company_id", companyId!)
          .order("business_name")
      ).data ?? [],
    enabled: !!companyId,
  });

  const ledger = (customers ?? []).map((c: any) => {
    const cInvoices = (invoices ?? []).filter((i: any) => i.customer_id === c.id);
    const billed = cInvoices.reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);
    const paid = (payments ?? [])
      .filter((p: any) => p.customer_id === c.id)
      .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
    const outstanding = billed - paid;
    const paidCount = cInvoices.filter((i: any) => i.status === "paid").length;
    return {
      ...c,
      billed,
      paid,
      outstanding,
      invoiceCount: cInvoices.length,
      paidCount,
      openInvoices: cInvoices.filter((i: any) => i.status !== "paid"),
    };
  });

  const totalBilled = ledger.reduce((s, c) => s + c.billed, 0);
  const totalPaid = ledger.reduce((s, c) => s + c.paid, 0);
  const totalOutstanding = ledger.reduce((s, c) => s + c.outstanding, 0);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Finance"
        title="Customer Ledger"
        sub="Per-customer running balance — the same numbers the Customer Portal shows in its Invoices/Payments tabs."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total Billed" value={fmtMoneyK(totalBilled)} icon={Receipt} tone="primary" />
        <Kpi label="Total Collected" value={fmtMoneyK(totalPaid)} icon={CheckCircle2} tone="success" />
        <Kpi label="Outstanding" value={fmtMoneyK(totalOutstanding)} icon={Clock} tone="warning" />
        <Kpi label="Customers" value={String(ledger.length)} icon={Users} tone="info" />
      </div>

      <div className="mt-4">
        <Panel title={`${ledger.length} Customer Ledgers`}>
          {ledger.length === 0 ? (
            <EmptyState title="No customers yet" sub="Customer ledgers appear once invoices exist." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Customer", "Invoices", "Total Billed", "Paid", "Outstanding", "Status"].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((c: any) => (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2">
                        <div className="font-medium">{c.business_name ?? c.name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{c.email ?? c.contact_email ?? ""}</div>
                      </td>
                      <td className="py-2.5 px-2 text-xs">
                        {c.invoiceCount} ({c.paidCount} paid)
                      </td>
                      <td className="py-2.5 px-2 font-mono text-xs">${c.billed.toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-mono text-xs text-success">${c.paid.toLocaleString()}</td>
                      <td className="py-2.5 px-2 font-mono text-xs font-medium">
                        ${c.outstanding.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2">
                        {c.outstanding <= 0 ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-success">
                            <TrendingUp className="h-3 w-3" /> Settled
                          </span>
                        ) : (
                          <StatusBadge status="pending" />
                        )}
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
