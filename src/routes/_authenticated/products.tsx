import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, DollarSign, Layers, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({ meta: [
    { title: "Products — FactoryOS AI" },
    { name: "description", content: "Manage SKUs, unit costs, prices, reorder levels and product categories." },
  ]}),
  component: ProductsPage,
});

function ProductsPage() {
  const { data } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("sku")).data ?? [],
  });
  const totalValue = (data ?? []).reduce((s, p) => s + Number(p.unit_price ?? 0), 0);

  return (
    <ResourceView
      eyebrow="Catalog"
      title="Products"
      sub="Every SKU manufactured, purchased or sold across your plants."
      rows={data}
      searchKeys={["sku", "name", "description"]}
      kpis={
        <>
          <Kpi label="Active SKUs" value={String(data?.length ?? 0)} delta="+3" icon={Package} tone="primary" />
          <Kpi label="Catalog Value" value={`$${totalValue.toLocaleString()}`} delta="+8.1%" icon={DollarSign} tone="success" />
          <Kpi label="Categories" value="3" icon={Layers} tone="info" />
          <Kpi label="AI Reorder Suggestions" value="12" delta="+2" icon={Sparkles} tone="warning" />
        </>
      }
      columns={[
        { key: "sku", header: "SKU", render: (r) => <span className="font-medium tabular-nums">{r.sku}</span> },
        { key: "name", header: "Name" },
        { key: "unit", header: "Unit", render: (r) => <span className="text-muted-foreground">{r.unit}</span> },
        { key: "unit_cost", header: "Cost", render: (r) => `$${Number(r.unit_cost).toFixed(2)}` },
        { key: "unit_price", header: "Price", render: (r) => `$${Number(r.unit_price).toFixed(2)}` },
        { key: "reorder_level", header: "Reorder", render: (r) => Number(r.reorder_level).toLocaleString() },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
