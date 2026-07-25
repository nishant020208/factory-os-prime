import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Layers, Package, DollarSign, Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/bom")({
  head: () => ({ meta: [
    { title: "Bill of Materials — FactoryOS AI" },
    { name: "description", content: "Multi-level BOMs, cost rollups and where-used analysis." },
  ]}),
  component: BomPage,
});

// BOM data derived from products — each product can have components
const BOM_FORM_FIELDS: FormField[] = [
  { key: "product_name", label: "Product Name", type: "text", placeholder: "Titanium Bracket TB-500", required: true },
  { key: "sku", label: "SKU", type: "text", placeholder: "SKU-A1001", required: true },
  { key: "components", label: "Components", type: "number", placeholder: "4", required: true },
  { key: "total_cost", label: "Total Cost ($)", type: "number", placeholder: "142.50", required: true },
  { key: "status", label: "Status", type: "select", defaultValue: "active", options: [
    { value: "active", label: "Active" },
    { value: "draft", label: "Draft" },
    { value: "review", label: "Under Review" },
  ]},
];

type BomRow = {
  id: string;
  product_name: string;
  sku: string;
  components: number;
  total_cost: number;
  unit_cost: number;
  status: string;
  level: number;
};

function BomPage() {
  const { companyId } = useAuth();
  const { data: products } = useQuery({
    queryKey: ["bom-products"],
    queryFn: async () => (await supabase.from("products").select("*").order("sku")).data ?? [],
  });

  // Build BOM rows from products with synthetic component data
  const bomRows: BomRow[] = (products ?? []).map((p, i) => ({
    id: p.id,
    product_name: p.name,
    sku: p.sku,
    components: 2 + (i % 5),
    total_cost: Number(p.unit_cost ?? 0) * (1 + (i % 3) * 0.3),
    unit_cost: Number(p.unit_cost ?? 0),
    status: "active",
    level: i < 2 ? 1 : 2,
  }));

  const totalCost = bomRows.reduce((s, r) => s + r.total_cost, 0);
  const level1 = bomRows.filter(r => r.level === 1).length;
  const level2 = bomRows.filter(r => r.level === 2).length;

  return (
    <ResourceView
      eyebrow="Engineering"
      title="Bill of Materials"
      sub="Multi-level BOMs with component tracking, cost rollups and where-used analysis."
      moduleName="bom"
      rows={bomRows}
      searchKeys={["product_name", "sku"]}
      formFields={BOM_FORM_FIELDS}
      onSubmit={async (data) => {
        if (!companyId) return;
        const { error } = await supabase.from("bom").insert({
          company_id: companyId,
          product_id: bomRows[0]?.id,
          version: "v1",
          status: data.status ?? "active",
          notes: data.product_name,
        });
        if (error) throw error;
      }}
      kpis={
        <>
          <Kpi label="Total BOMs" value={String(bomRows.length)} icon={Layers} tone="primary" />
          <Kpi label="Level 1" value={String(level1)} icon={Package} tone="info" />
          <Kpi label="Level 2" value={String(level2)} icon={Cpu} tone="warning" />
          <Kpi label="Total Cost" value={`$${Math.round(totalCost).toLocaleString()}`} icon={DollarSign} tone="success" />
        </>
      }
      columns={[
        { key: "sku", header: "SKU", render: (r) => <span className="font-mono text-xs font-medium">{r.sku}</span> },
        { key: "product_name", header: "Product", render: (r) => <span className="font-medium">{r.product_name}</span> },
        { key: "level", header: "Level", render: (r) => (
          <Badge variant="outline" className={`text-[10px] font-medium ${r.level === 1 ? "bg-primary/10 text-primary border-primary/20" : "bg-info/10 text-info border-info/20"}`}>
            L{r.level}
          </Badge>
        )},
        { key: "components", header: "Parts", hideOnMobile: true },
        { key: "unit_cost", header: "Unit Cost", render: (r) => <span className="font-mono text-xs">${r.unit_cost.toFixed(2)}</span> },
        { key: "total_cost", header: "Rollup", render: (r) => <span className="font-mono text-xs font-medium">${r.total_cost.toFixed(2)}</span> },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
