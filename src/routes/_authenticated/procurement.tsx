import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShoppingCart, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({ meta: [
    { title: "Procurement — FactoryOS AI" },
    { name: "description", content: "Purchase orders, RFQs and supplier commitments." },
  ]}),
  component: ProcurementPage,
});

function ProcurementPage() {
  const { data } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () => (await supabase.from("purchase_orders").select("*").order("created_at", { ascending: false })).data ?? [],
  });
  const total = (data ?? []).reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
  const approved = data?.filter(p => p.status === "approved").length ?? 0;
  const pending = data?.filter(p => p.status === "pending").length ?? 0;

  return (
    <ResourceView
      eyebrow="Supply Chain"
      title="Purchase Orders"
      sub="Every PO from request to receipt, with supplier scoring and AI recommendations."
      rows={data}
      searchKeys={["po_number", "status"]}
      kpis={
        <>
          <Kpi label="Open POs" value={String(data?.length ?? 0)} icon={ShoppingCart} tone="primary" />
          <Kpi label="Commit Value" value={`$${total.toLocaleString()}`} delta="+6.4%" icon={DollarSign} tone="success" />
          <Kpi label="Approved" value={String(approved)} icon={CheckCircle2} tone="info" />
          <Kpi label="Pending Approval" value={String(pending)} icon={Clock} tone="warning" />
        </>
      }
      columns={[
        { key: "po_number", header: "PO #", render: (r) => <span className="font-medium">{r.po_number}</span> },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        { key: "total_amount", header: "Amount", render: (r) => `$${Number(r.total_amount).toLocaleString()}` },
        { key: "expected_date", header: "Expected", render: (r) => r.expected_date ? new Date(r.expected_date).toLocaleDateString() : "—" },
      ]}
    />
  );
}
