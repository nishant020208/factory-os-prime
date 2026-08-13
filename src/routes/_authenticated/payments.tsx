import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, CheckCircle2, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/payments")({
  head: () => ({
    meta: [
      { title: "Payments — FactoryOS AI" },
      { name: "description", content: "Payments received from the buyer" },
    ],
  }),
  component: PaymentsPage,
});

function PaymentsPage() {
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
  const pendingCount = (payments ?? []).filter((p) => p.status === "pending").length;

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
        <Kpi label="Pending" value={String(pendingCount)} icon={Clock} tone="warning" />
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
