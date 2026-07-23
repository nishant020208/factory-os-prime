import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView } from "@/components/resource-view";
import { Kpi } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/warehouse")({
  head: () => ({ meta: [
    { title: "Warehouses — FactoryOS AI" },
    { name: "description", content: "Multi-warehouse management, bin-level control and cycle counting." },
  ]}),
  component: WarehousePage,
});

function WarehousePage() {
  const { data } = useQuery({
    queryKey: ["warehouses"],
    queryFn: async () => (await supabase.from("warehouses").select("*").order("name")).data ?? [],
  });
  return (
    <ResourceView
      eyebrow="Logistics"
      title="Warehouses"
      sub="All storage facilities across your plants with bin-level control."
      rows={data}
      searchKeys={["name", "code"]}
      kpis={<>
        <Kpi label="Warehouses" value={String(data?.length ?? 0)} icon={Warehouse} tone="primary" />
        <Kpi label="Capacity Used" value="72%" delta="+3%" icon={Warehouse} tone="info" />
        <Kpi label="Cycle Counts" value="14" icon={Warehouse} tone="success" />
        <Kpi label="Transfers Today" value="6" icon={Warehouse} tone="warning" />
      </>}
      columns={[
        { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
        { key: "name", header: "Name" },
        { key: "plant_id", header: "Plant", render: () => <span className="text-muted-foreground">Detroit Assembly</span> },
      ]}
    />
  );
}
