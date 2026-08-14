import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, Clock, Loader2, Plus, DollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { notifyPaymentStatusChanged } from "@/lib/notifications";
import { getCustomerUserId } from "@/lib/customer-lookup";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — FactoryOS AI" },
      { name: "description", content: "Customer payments received and reconciliation" },
    ],
  }),
  component: PaymentsPage,
});

function FinancePayments() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [showRecord, setShowRecord] = useState(false);
  const [form, setForm] = useState({ invoice_id: "", amount: "", method: "bank_transfer", reference: "" });

  const { data: payments } = useQuery({
    queryKey: ["fin-cust-payments", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("payments")
          .select("*, customers!left(name, business_name), invoices!left(invoice_number)")
          .eq("company_id", companyId!)
          .order("paid_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: openInvoices } = useQuery({
    queryKey: ["fin-open-invoices", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("invoices")
          .select("id, customer_id, invoice_number, total_amount, status, customers!left(name, business_name)")
          .eq("company_id", companyId!)
          .in("status", ["sent", "overdue", "draft"])
          .order("issue_date", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const recordMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const inv = (openInvoices ?? []).find((i: any) => i.id === form.invoice_id);
      if (!inv) throw new Error("Select an invoice");
      const amount = parseFloat(form.amount) || Number(inv.total_amount ?? 0);
      const { data: inserted, error } = await supabase
        .from("payments")
        .insert({
          company_id: companyId,
          payment_number: `PAY-${Date.now().toString().slice(-6)}`,
          invoice_id: inv.id,
          customer_id: inv.customer_id,
          amount,
          method: form.method,
          status: "completed",
          paid_at: new Date().toISOString(),
          reference: form.reference.trim() || null,
        })
        .select("id")
        .single();
      if (error) throw error;

      await supabase
        .from("invoices")
        .update({ status: "paid", paid_date: new Date().toISOString() })
        .eq("id", inv.id);

      if (inv.customer_id) {
        const customerUserId = await getCustomerUserId(inv.customer_id);
        await notifyPaymentStatusChanged(companyId, inv.invoice_number, customerUserId ?? "", "paid", inv.id);
      }
      return inserted;
    },
    onSuccess: () => {
      toast.success("Payment recorded — invoice marked paid, customer notified");
      setShowRecord(false);
      setForm({ invoice_id: "", amount: "", method: "bank_transfer", reference: "" });
      queryClient.invalidateQueries({ queryKey: ["fin-cust-payments"] });
      queryClient.invalidateQueries({ queryKey: ["fin-open-invoices"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const totalReceived = (payments ?? []).reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="payments" />
      <PageHeader
        eyebrow="Finance"
        title="Payments Received"
        sub="Every customer payment recorded against real invoices — money in."
        actions={
          <div className="flex items-center gap-2">
            <ModuleCopilot moduleName="payments" />
            <Button className="bg-[image:var(--gradient-primary)]" size="sm" onClick={() => setShowRecord(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Record Payment
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total Received" value={`$${totalReceived.toLocaleString()}`} icon={CreditCard} tone="success" />
        <Kpi
          label="This Month"
          value={`$${(payments ?? [])
            .filter((p: any) => (p.paid_at ?? "").startsWith(thisMonth))
            .reduce((s: number, p: any) => s + Number(p.amount ?? 0), 0)
            .toLocaleString()}`}
          icon={DollarSign}
          tone="primary"
        />
        <Kpi label="Payments" value={String(payments?.length ?? 0)} icon={CheckCircle2} tone="info" />
        <Kpi label="Invoices Awaiting" value={String(openInvoices?.length ?? 0)} icon={Clock} tone="warning" />
      </div>

      <Panel title={`${payments?.length ?? 0} Customer Payments`}>
        {(payments ?? []).length === 0 ? (
          <EmptyState title="No payments received yet" sub="Customer payments land here from the Customer Portal or manual reconciliation." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["Payment #", "Customer", "Invoice", "Amount", "Method", "Date", "Reference"].map((h) => (
                    <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments ?? []).map((p) => (
                  <TableRow key={p.id} className="border-white/5">
                    <TableCell className="font-mono text-xs">{p.payment_number}</TableCell>
                    <TableCell className="font-medium">
                      {p.customers?.business_name ?? p.customers?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs">{p.invoices?.invoice_number ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs text-success">
                      +${Number(p.amount ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{p.method?.replace(/_/g, " ")}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{p.reference ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <Dialog open={showRecord} onOpenChange={setShowRecord}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Record Customer Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Invoice *</Label>
              <select
                value={form.invoice_id}
                onChange={(e) => setForm((f) => ({ ...f, invoice_id: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs"
              >
                <option value="">Select invoice…</option>
                {(openInvoices ?? []).map((i: any) => (
                  <option key={i.id} value={i.id}>
                    {i.invoice_number} — {i.customers?.business_name ?? i.customers?.name ?? "?"} (${Number(i.total_amount ?? 0).toLocaleString()})
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Amount</Label>
                <Input type="number" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} placeholder="defaults to invoice total" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Method</Label>
                <select
                  value={form.method}
                  onChange={(e) => setForm((f) => ({ ...f, method: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs"
                >
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="upi">UPI</option>
                  <option value="cash">Cash</option>
                  <option value="cheque">Cheque</option>
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reference / Transaction ID</Label>
              <Input value={form.reference} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRecord(false)}>
              Cancel
            </Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={() => recordMutation.mutate()} disabled={recordMutation.isPending || !form.invoice_id}>
              {recordMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SupplierPaymentsView() {
  const { user, companyId } = useAuth();

  const { data: mySupplier } = useQuery({
    queryKey: ["my-supplier", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const byUser = await supabase
        .from("suppliers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (byUser.data?.id) return byUser.data.id as string;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.email) {
        const { data: sup } = await supabase
          .from("suppliers")
          .select("id")
          .eq("contact_email", profile.email)
          .maybeSingle();
        return (sup?.id as string) ?? null;
      }
      return null;
    },
  });

  const { data: payments, isLoading } = useQuery({
    queryKey: ["supplier-payments", companyId, mySupplier],
    queryFn: async () => {
      if (!mySupplier) return [];
      const { data } = await supabase
        .from("supplier_payments")
        .select("*, purchase_orders(po_number)")
        .eq("supplier_id", mySupplier)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!mySupplier,
  });

  const paid = (payments ?? []).filter((p) => p.status === "paid");
  const totalPaid = paid.reduce((s, p) => s + Number(p.amount ?? 0), 0);

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="payments" />
      <PageHeader
        eyebrow="Supplier Portal"
        title="Payments Received"
        sub="Every payment the buyer has released against your invoices."
        actions={<ModuleCopilot moduleName="payments" />}
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total Paid" value={`$${totalPaid.toLocaleString()}`} icon={CreditCard} tone="success" />
        <Kpi label="All Payments" value={String(payments?.length ?? 0)} icon={CheckCircle2} tone="primary" />
      </div>
      <Panel title={`${payments?.length ?? 0} Payments`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading payments…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["PO", "Amount", "Method", "Transaction ID", "Status", "Paid On"].map((h) => (
                    <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments ?? []).map((p) => {
                  const po = p.purchase_orders as unknown as { po_number?: string } | null;
                  return (
                    <TableRow key={p.id} className="border-white/5">
                      <TableCell className="font-medium">{po?.po_number ?? "—"}</TableCell>
                      <TableCell className="font-mono text-xs">
                        ${Number(p.amount ?? 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs">{p.method ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{p.transaction_id ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={p.status} />
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(payments ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      No payments yet. Once the buyer processes your invoice, it appears here.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function PaymentsPage() {
  const { roles } = useAuth();
  if (roles.includes("supplier_portal")) return <SupplierPaymentsView />;
  return <FinancePayments />;
}
