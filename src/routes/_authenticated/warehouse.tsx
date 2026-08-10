import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Warehouse, Package, ArrowRightLeft, ClipboardCheck, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/warehouse")({
  head: () => ({
    meta: [
      { title: "Warehouses — FactoryOS AI" },
      {
        name: "description",
        content: "Multi-warehouse management, bin-level control and cycle counting.",
      },
    ],
  }),
  component: WarehousePage,
});

// warehouses table only has: id, company_id, plant_id, name, code, created_at
const WAREHOUSE_FORM_FIELDS: FormField[] = [
  {
    key: "name",
    label: "Warehouse Name",
    type: "text",
    placeholder: "Main Distribution Center",
    required: true,
  },
  { key: "code", label: "Warehouse Code", type: "text", placeholder: "WH-01", required: true },
];

type WarehouseRow = {
  id: string;
  name: string;
  code: string;
  company_id: string;
  plant_id: string | null;
  created_at: string;
};

function WarehousePage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const { data } = useQuery({
    queryKey: ["warehouses", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("warehouses").select("*").order("name");
      return (data ?? []) as WarehouseRow[];
    },
  });

  const { data: inventory } = useQuery({
    queryKey: ["wh-inventory", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("inventory").select("*");
      return data ?? [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const { error } = await supabase.from("warehouses").insert({
        company_id: companyId!,
        name: formData.name,
        code: formData.code,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Warehouse created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase
        .from("warehouses")
        .update({
          name: d.name,
          code: d.code,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Warehouse updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("warehouses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
      toast.success("Warehouse deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalSKUs = inventory?.length ?? 0;
  const lowStock = inventory?.filter((i: any) => Number(i.quantity ?? 0) <= 10).length ?? 0;

  return (
    <ResourceView
      eyebrow="Logistics"
      title="Warehouses"
      sub="All storage facilities with bin-level control and cycle counting."
      moduleName="warehouse"
      rows={data}
      searchKeys={["name", "code"]}
      formFields={WAREHOUSE_FORM_FIELDS}
      onSubmit={async (formData, editingRow) => {
        if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        else await createMutation.mutateAsync(formData);
      }}
      onDelete={(row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi
            label="Warehouses"
            value={String(data?.length ?? 0)}
            icon={Warehouse}
            tone="primary"
          />
          <Kpi label="SKUs Tracked" value={String(totalSKUs)} icon={Package} tone="info" />
          <Kpi label="Low Stock" value={String(lowStock)} icon={ArrowRightLeft} tone="warning" />
          <Kpi label="Cycle Counts" value="14" icon={ClipboardCheck} tone="success" />
        </>
      }
      columns={[
        {
          key: "code",
          header: "Code",
          render: (r) => <span className="font-mono text-xs">{r.code}</span>,
        },
        {
          key: "name",
          header: "Name",
          render: (r) => <span className="font-medium">{r.name}</span>,
        },
        {
          key: "plant_id",
          header: "Plant",
          render: (r) => (
            <span className="text-muted-foreground text-xs">
              {r.plant_id ? "Detroit Assembly" : "—"}
            </span>
          ),
        },
      ]}
    />
  );
}
