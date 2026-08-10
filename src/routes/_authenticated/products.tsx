import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, DollarSign, Layers, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — FactoryOS AI" },
      {
        name: "description",
        content: "Manage SKUs, unit costs, prices, reorder levels and product categories.",
      },
    ],
  }),
  component: ProductsPage,
});

const PRODUCT_FORM_FIELDS: FormField[] = [
  { key: "sku", label: "SKU", type: "text", placeholder: "SKU-A1006", required: true },
  {
    key: "name",
    label: "Product Name",
    type: "text",
    placeholder: "Titanium Bracket TB-600",
    required: true,
  },
  {
    key: "description",
    label: "Description",
    type: "textarea",
    placeholder: "Product description",
  },
  {
    key: "unit",
    label: "Unit",
    type: "select",
    defaultValue: "pcs",
    options: [
      { value: "pcs", label: "Pieces" },
      { value: "kg", label: "Kilograms" },
      { value: "m", label: "Meters" },
      { value: "ltr", label: "Liters" },
      { value: "set", label: "Set" },
    ],
  },
  { key: "unit_cost", label: "Unit Cost ($)", type: "number", placeholder: "42.50" },
  { key: "unit_price", label: "Unit Price ($)", type: "number", placeholder: "89.00" },
  { key: "reorder_level", label: "Reorder Level", type: "number", placeholder: "200" },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "active",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "discontinued", label: "Discontinued" },
    ],
  },
];

function ProductsPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const { data } = useQuery({
    queryKey: ["products"],
    queryFn: async () => (await supabase.from("products").select("*").order("sku")).data ?? [],
  });
  const totalValue = (data ?? []).reduce(
    (s, p) => s + Number(p.unit_price ?? 0) * Number(p.reorder_level ?? 0),
    0,
  );
  const activeCount = data?.filter((p) => p.status === "active").length ?? 0;

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const { error } = await supabase.from("products").insert({
        company_id: companyId!,
        sku: formData.sku,
        name: formData.name,
        description: formData.description || null,
        unit: formData.unit || "pcs",
        unit_cost: parseFloat(formData.unit_cost) || 0,
        unit_price: parseFloat(formData.unit_price) || 0,
        reorder_level: parseFloat(formData.reorder_level) || 0,
        status: formData.status || "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase
        .from("products")
        .update({
          sku: d.sku,
          name: d.name,
          description: d.description || null,
          unit: d.unit || "pcs",
          unit_cost: parseFloat(d.unit_cost) || 0,
          unit_price: parseFloat(d.unit_price) || 0,
          reorder_level: parseFloat(d.reorder_level) || 0,
          status: d.status || "active",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      toast.success("Product deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <ResourceView
      eyebrow="Catalog"
      title="Products"
      sub="Every SKU manufactured, purchased or sold across your plants."
      moduleName="products"
      rows={data}
      searchKeys={["sku", "name", "description"]}
      formFields={PRODUCT_FORM_FIELDS}
      onSubmit={async (formData, editingRow) => {
        if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        else await createMutation.mutateAsync(formData);
      }}
      onDelete={(row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi
            label="Active SKUs"
            value={String(activeCount)}
            delta="+3"
            icon={Package}
            tone="primary"
          />
          <Kpi
            label="Catalog Value"
            value={`$${(totalValue / 1000).toFixed(0)}k`}
            delta="+8.1%"
            icon={DollarSign}
            tone="success"
          />
          <Kpi label="Total SKUs" value={String(data?.length ?? 0)} icon={Layers} tone="info" />
          <Kpi
            label="Below Reorder"
            value={String(data?.filter((p) => Number(p.reorder_level ?? 0) > 0).length ?? 0)}
            icon={Sparkles}
            tone="warning"
          />
        </>
      }
      columns={[
        {
          key: "sku",
          header: "SKU",
          render: (r) => <span className="font-medium tabular-nums">{r.sku}</span>,
        },
        { key: "name", header: "Name" },
        {
          key: "unit",
          header: "Unit",
          render: (r) => <span className="text-muted-foreground">{r.unit}</span>,
        },
        { key: "unit_cost", header: "Cost", render: (r) => `$${Number(r.unit_cost).toFixed(2)}` },
        {
          key: "unit_price",
          header: "Price",
          render: (r) => `$${Number(r.unit_price).toFixed(2)}`,
        },
        {
          key: "reorder_level",
          header: "Reorder",
          render: (r) => Number(r.reorder_level).toLocaleString(),
        },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
