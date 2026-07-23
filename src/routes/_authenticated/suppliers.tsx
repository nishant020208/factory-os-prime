import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Truck, Star, DollarSign, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [
    { title: "Suppliers — FactoryOS AI" },
    { name: "description", content: "Supplier directory, scorecards, contracts and AI recommendations." },
  ]}),
  component: SuppliersPage,
});

function SuppliersPage() {
  const { data } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });
  const avg = data?.length ? (data.reduce((s, x) => s + Number(x.rating ?? 0), 0) / data.length).toFixed(2) : "0";
  return (
    <ResourceView
      eyebrow="Supply Chain"
      title="Suppliers"
      sub="Approved vendors, performance and AI-driven sourcing recommendations."
      rows={data}
      searchKeys={["name", "contact_email"]}
      kpis={
        <>
          <Kpi label="Approved Suppliers" value={String(data?.length ?? 0)} icon={Truck} tone="primary" />
          <Kpi label="Avg Score" value={avg} icon={Star} tone="warning" />
          <Kpi label="Spend YTD" value="$4.2M" delta="+9.1%" icon={DollarSign} tone="success" />
          <Kpi label="Audited" value="100%" icon={ShieldCheck} tone="info" />
        </>
      }
      columns={[
        { key: "name", header: "Supplier", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "contact_email", header: "Contact", render: (r) => <span className="text-muted-foreground">{r.contact_email ?? "—"}</span> },
        { key: "rating", header: "Score", render: (r) => (
          <div className="flex items-center gap-1"><Star className="h-3 w-3 text-warning fill-warning" />{Number(r.rating).toFixed(2)}</div>
        )},
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
