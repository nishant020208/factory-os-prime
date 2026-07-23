import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserRound, DollarSign, ShoppingBag, Repeat } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({ meta: [
    { title: "Customers — FactoryOS AI" },
    { name: "description", content: "Customer accounts, segments and lifetime value." },
  ]}),
  component: CustomersPage,
});

function CustomersPage() {
  const { data } = useQuery({
    queryKey: ["customers"],
    queryFn: async () => (await supabase.from("customers").select("*").order("name")).data ?? [],
  });
  return (
    <ResourceView
      eyebrow="Commercial"
      title="Customers"
      sub="Every account you serve, from aerospace to consumer goods."
      rows={data}
      searchKeys={["name", "contact_email", "segment"]}
      kpis={
        <>
          <Kpi label="Active Accounts" value={String(data?.length ?? 0)} icon={UserRound} tone="primary" />
          <Kpi label="Revenue YTD" value="$18.4M" delta="+11.2%" icon={DollarSign} tone="success" />
          <Kpi label="Open Orders" value="34" icon={ShoppingBag} tone="info" />
          <Kpi label="Repeat Rate" value="82%" delta="+2.1%" icon={Repeat} tone="warning" />
        </>
      }
      columns={[
        { key: "name", header: "Customer", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "segment", header: "Segment", render: (r) => <span className="text-muted-foreground">{r.segment ?? "—"}</span> },
        { key: "contact_email", header: "Contact" },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
