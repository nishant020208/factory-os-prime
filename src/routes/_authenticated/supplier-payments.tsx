import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, Loader2, Send, CheckCircle2, Clock, Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/supplier-payments")({
  head: () => ({
    meta: [
      { title: "Supplier Payments — FactoryOS AI" },
      { name: "description", content: "Process payments against supplier invoices — money out." },
    ],
  }),
  component: SupplierPaymentsPage,
});

function SupplierPaymentsPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [showPay, setShowPay] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [form, setForm] = useState({ amount: "", method: "bank_transfer", transaction_id: "" });

  // Supplier invoices raised in the Supplier Portal (verified in the Supplier
  // build) — awaiting payment here.
  const { data: supplierInvoices } = useQuery({
    queryKey: ["sp-supplier-invoices", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_invoices")
          .select("*, suppliers!left(name, user_id), purchase_orders!left(po_number)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  // Payments released — the SAME rows the Supplier Portal's Payments tab reads.
  const { data: released } = useQuery({
    queryKey: ["sp-released", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_payments")
          .select("*, suppliers!left(name), supplier_invoices!left(invoice_number)")
          .eq("company_id", companyId!)
          .order("paid_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const pendingInvoices = (supplierInvoices ?? []).filter((i: any) => i.status === "pending");
  const pendingTotal = pendingInvoices.reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);
  const paidTotal = (released ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);

  const processMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user || !selected) throw new Error("Not authenticated");
      const amount = parseFloat(form.amount) || Number(selected.total_amount ?? 0);

      // 1) Write the payment to supplier_payments — the SAME table the
      //    Supplier Portal's "Payments Received" tab reads from.
      const { data: inserted, error } = await supabase
        .from("supplier_payments")
        .insert({
          company_id: companyId,
          supplier_id: selected.supplier_id,
          invoice_id: selected.id,
          po_id: selected.po_id,
          amount,
          transaction_id: form.transaction_id.trim() || `SP-${Date.now().toString().slice(-6)}`,
          method: form.method,
          status: "paid",
          paid_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      // The DB trigger trg_supplier_payment_effects flips the linked
      // supplier_invoice to 'paid' (so the Supplier Portal's Payments
      // Received tab reflects it live) and notifies that specific supplier
      // (to_user) — single source of truth, client only inserts the payment.
      if (error) throw error;
      return inserted;
    },
    onSuccess: () => {
      toast.success("Payment processed — supplier notified");
      setShowPay(false);
      setSelected(null);
      setForm({ amount: "", method: "bank_transfer", transaction_id: "" });
      queryClient.invalidateQueries({ queryKey: ["sp-supplier-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["sp-released"] });
      queryClient.invalidateQueries({ queryKey: ["fin-sup-invoices"] });
      queryClient.invalidateQueries({ queryKey: ["fin-sup-payments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="supplier-payments" />
      <PageHeader
        eyebrow="Finance"
        title="Supplier Payments"
        sub="Process payments against supplier invoices raised in the Supplier Portal — money out."
        actions={<ModuleCopilot moduleName="supplier-payments" />}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Awaiting Payment" value={String(pendingInvoices.length)} icon={Clock} tone="warning" />
        <Kpi label="Due Amount" value={fmtMoney(pendingTotal)} icon={Landmark} tone="info" />
        <Kpi label="Paid to Suppliers" value={fmtMoney(paidTotal)} icon={Wallet} tone="success" />
        <Kpi label="Payments Released" value={String(released?.length ?? 0)} icon={CheckCircle2} tone="primary" />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`${pendingInvoices.length} Supplier Invoices Awaiting Payment`}>
          {pendingInvoices.length === 0 ? (
            <EmptyState title="Nothing awaiting payment" sub="Supplier invoices land here once raised in the Supplier Portal." />
          ) : (
            <div className="divide-y divide-white/5">
              {pendingInvoices.map((i: any) => (
                <div key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-medium">{i.invoice_number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {i.suppliers?.name ?? "Supplier"} · {i.purchase_orders?.po_number ?? "—"}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">
                      {fmtMoney(i.total_amount)}
                    </span>
                    {!isAuditor && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs text-success"
                        onClick={() => {
                          setSelected(i);
                          setForm({ amount: String(i.total_amount ?? ""), method: "bank_transfer", transaction_id: "" });
                          setShowPay(true);
                        }}
                      >
                        <Send className="h-3 w-3 mr-1" />
                        Process Payment
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={`${released?.length ?? 0} Payments Released`}>
          {(released ?? []).length === 0 ? (
            <EmptyState title="No payments released yet" sub="Released payments appear here — and in the supplier's own Payments tab." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Supplier", "Invoice", "Amount", "Tx ID", "Date"].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(released ?? []).map((p: any) => (
                    <tr key={p.id} className="border-b border-white/5">
                      <td className="py-2.5 px-2 font-medium">{p.suppliers?.name ?? "—"}</td>
                      <td className="py-2.5 px-2 text-xs">{p.supplier_invoices?.invoice_number ?? "—"}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">{fmtMoney(p.amount)}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">{p.transaction_id ?? "—"}</td>
                      <td className="py-2.5 px-2 text-xs text-muted-foreground">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Dialog open={showPay} onOpenChange={setShowPay}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Process Supplier Payment</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{selected.invoice_number}</span> —{" "}
                {selected.suppliers?.name} · {fmtMoney(selected.total_amount)}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Method</Label>
                <select
                  value={form.method}
                  onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="cheque">Cheque</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Transaction ID</Label>
                <Input value={form.transaction_id} onChange={(e) => setForm((f) => ({ ...f, transaction_id: e.target.value }))} />
              </div>
              <p className="text-[10px] text-muted-foreground">
                Writes to the same supplier_payments table the Supplier Portal's Payments tab reads — the supplier sees this payment live.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPay(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => processMutation.mutate()}
              disabled={processMutation.isPending || !selected}
            >
              {processMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Release Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
