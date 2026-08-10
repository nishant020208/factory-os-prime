import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Factory, MapPin, Users, Cog } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/plants")({
  head: () => ({
    meta: [
      { title: "Plants — FactoryOS AI" },
      { name: "description", content: "All manufacturing plants belonging to your company." },
    ],
  }),
  component: PlantsPage,
});

const PLANT_FORM_FIELDS: FormField[] = [
  {
    key: "name",
    label: "Plant Name",
    type: "text",
    placeholder: "Detroit Assembly Plant",
    required: true,
  },
  { key: "code", label: "Plant Code", type: "text", placeholder: "DET-01", required: true },
  { key: "city", label: "City", type: "text", placeholder: "Detroit" },
  { key: "country", label: "Country", type: "text", placeholder: "United States" },
  { key: "address", label: "Address", type: "text", placeholder: "123 Industrial Blvd" },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "active",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "maintenance", label: "Under Maintenance" },
    ],
  },
];

function PlantsPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const { data } = useQuery({
    queryKey: ["plants", companyId],
    queryFn: async () => (await supabase.from("plants").select("*").order("name")).data ?? [],
  });

  const { data: machines } = useQuery({
    queryKey: ["plants-machines"],
    queryFn: async () => (await supabase.from("machines").select("plant_id, status")).data ?? [],
  });

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const { error } = await supabase.from("plants").insert({
        company_id: companyId!,
        name: formData.name,
        code: formData.code,
        city: formData.city || null,
        country: formData.country || null,
        address: formData.address || null,
        status: formData.status || "active",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      toast.success("Plant created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase
        .from("plants")
        .update({
          name: d.name,
          code: d.code,
          city: d.city || null,
          country: d.country || null,
          address: d.address || null,
          status: d.status || "active",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      toast.success("Plant updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plants").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plants"] });
      toast.success("Plant deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const activePlants = data?.filter((p: any) => p.status === "active").length ?? 0;
  const totalMachines = machines?.length ?? 0;

  return (
    <ResourceView
      eyebrow="Infrastructure"
      title="Plants"
      sub="Manufacturing facilities, locations and operational status."
      moduleName="plants"
      rows={data}
      searchKeys={["name", "code", "city", "country"]}
      formFields={PLANT_FORM_FIELDS}
      onSubmit={async (formData, editingRow) => {
        if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        else await createMutation.mutateAsync(formData);
      }}
      onDelete={(row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi
            label="Total Plants"
            value={String(data?.length ?? 0)}
            icon={Factory}
            tone="primary"
          />
          <Kpi label="Active" value={String(activePlants)} icon={MapPin} tone="success" />
          <Kpi label="Total Machines" value={String(totalMachines)} icon={Cog} tone="info" />
          <Kpi
            label="Countries"
            value={String(new Set(data?.map((p: any) => p.country).filter(Boolean)).size)}
            icon={MapPin}
            tone="warning"
          />
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
        { key: "city", header: "City", hideOnMobile: true, render: (r) => r.city ?? "—" },
        { key: "country", header: "Country", hideOnMobile: true, render: (r) => r.country ?? "—" },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
