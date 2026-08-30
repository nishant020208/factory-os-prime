import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, TrendingUp, Timer, Wallet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { useAuth } from "@/hooks/use-auth";
import { useSupplier } from "@/hooks/use-supplier";
import { fmtMoney } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/supplier-performance")({
  head: () => ({
    meta: [
      { title: "Performance — FactoryOS AI" },
      { name: "description", content: "Your OTIF, fulfillment and business value" },
    ],
  }),
  component: SupplierPerformancePage,
});

function SupplierPerformancePage() {
  const { companyId } = useAuth();
  const { mySupplier } = useSupplier();

  const { data: pos, isLoading } = useQuery({
    queryKey: ["supplier-perf-pos", companyId, mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier?.id) return [];
      const { data } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("supplier_id", mySupplier.id);
      return data ?? [];
    },
    enabled: !!mySupplier?.id,
  });

  const { data: deliveries } = useQuery({
    queryKey: ["supplier-perf-del", companyId, mySupplier?.id],
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
    queryKey: ["supplier-perf-pay", companyId, mySupplier?.id],
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

  const total = pos?.length ?? 0;
  const fulfilled = (pos ?? []).filter((p) => ["received", "fulfilled"].includes(p.status)).length;
  const responded = (pos ?? []).filter((p) => p.status !== "sent").length;
  const lifetime = (pos ?? []).reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
  const pendingPayments = (payments ?? []).filter((p) => p.status === "pending");

  // On-time = delivery whose expected arrival was on/after the dispatch date
  const onTime = (deliveries ?? []).filter((d) => {
    if (!d.dispatch_date || !d.expected_arrival) return false;
    return new Date(d.expected_arrival) >= new Date(d.dispatch_date);
  }).length;
  const deliveryCount = (deliveries ?? []).length;

  const fulfillmentRate = total ? Math.round((fulfilled / total) * 100) : 0;
  const responseRate = total ? Math.round((responded / total) * 100) : 0;
  const otif = deliveryCount ? Math.round((onTime / deliveryCount) * 100) : 0;

  const metrics: { label: string; value: string; sub: string }[] = [
    {
      label: "Fulfillment Rate",
      value: `${fulfillmentRate}%`,
      sub: `${fulfilled} of ${total} POs received`,
    },
    {
      label: "On-Time In Full (OTIF)",
      value: `${otif}%`,
      sub: `${onTime} of ${deliveryCount} shipments on schedule`,
    },
    {
      label: "Response Rate",
      value: `${responseRate}%`,
      sub: `${responded} of ${total} POs answered`,
    },
    {
      label: "Pending Payments",
      value: fmtMoney(pendingPayments.reduce((s, p) => s + Number(p.amount ?? 0), 0)),
      sub: `${pendingPayments.length} awaiting release`,
    },
  ];

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="supplier-performance" />
      <PageHeader
        eyebrow="Supplier Portal"
        title="Performance"
        sub="Live metrics computed from your POs, shipments and payments — nothing fabricated."
        actions={<ModuleCopilot moduleName="supplier-performance" />}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Computing metrics…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
            <Kpi label="Fulfillment Rate" value={metrics[0].value} icon={Star} tone="success" />
            <Kpi label="On-Time In Full" value={metrics[1].value} icon={TrendingUp} tone="primary" />
            <Kpi label="Response Rate" value={metrics[2].value} icon={Timer} tone="info" />
            <Kpi label="Pending Payments" value={metrics[3].value} icon={Wallet} tone="warning" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Panel title="Lifetime Business Value">
              <p className="text-3xl font-semibold">${lifetime.toLocaleString()}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Total value of all POs issued to you (received or in progress).
              </p>
            </Panel>
            <Panel title="How metrics are computed">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>• Fulfillment: POs marked received ÷ total POs issued to you.</li>
                <li>• OTIF: shipments whose expected arrival is on/after the dispatch date.</li>
                <li>• Response: POs you answered (accepted / rejected / modified) ÷ total.</li>
                <li>• Pending payments: supplier payments still awaiting release by Finance.</li>
              </ul>
            </Panel>
            <Panel title="Recent Purchase Orders">
              <ul className="space-y-2">
                {(pos ?? []).slice(0, 5).map((p) => (
                  <li key={p.id} className="flex items-center justify-between text-xs">
                    <span className="font-medium">{p.po_number}</span>
                    <span className="text-muted-foreground">
                      ${Number(p.total_amount ?? 0).toLocaleString()} · {p.status}
                    </span>
                  </li>
                ))}
                {(pos ?? []).length === 0 && (
                  <li className="text-xs text-muted-foreground">No purchase orders yet.</li>
                )}
              </ul>
            </Panel>
          </div>
        </>
      )}
    </div>
  );
}
