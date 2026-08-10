import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Building2, Users, Hash } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/departments")({
  head: () => ({
    meta: [
      { title: "Departments — FactoryOS AI" },
      { name: "description", content: "Departments, hierarchy and reporting structure." },
    ],
  }),
  component: DepartmentsPage,
});

const DEPT_FORM_FIELDS: FormField[] = [
  {
    key: "name",
    label: "Department Name",
    type: "text",
    placeholder: "Production",
    required: true,
  },
  { key: "code", label: "Department Code", type: "text", placeholder: "DEPT-PROD" },
];

function DepartmentsPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const { data } = useQuery({
    queryKey: ["departments", companyId],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const { data: profiles } = useQuery({
    queryKey: ["dept-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, job_title")).data ?? [],
  });

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const { error } = await supabase.from("departments").insert({
        company_id: companyId!,
        name: formData.name,
        code: formData.code || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase
        .from("departments")
        .update({
          name: d.name,
          code: d.code || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      toast.success("Department deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <ResourceView
      eyebrow="Organization"
      title="Departments"
      sub="Organizational structure, hierarchy and reporting lines."
      moduleName="departments"
      rows={data}
      searchKeys={["name", "code"]}
      formFields={DEPT_FORM_FIELDS}
      onSubmit={async (formData, editingRow) => {
        if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        else await createMutation.mutateAsync(formData);
      }}
      onDelete={(row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi
            label="Departments"
            value={String(data?.length ?? 0)}
            icon={Building2}
            tone="primary"
          />
          <Kpi
            label="With Code"
            value={String(data?.filter((d: any) => d.code).length ?? 0)}
            icon={Hash}
            tone="info"
          />
          <Kpi
            label="Employees"
            value={String(profiles?.length ?? 0)}
            icon={Users}
            tone="success"
          />
          <Kpi
            label="Plants"
            value={String(new Set(data?.map((d: any) => d.plant_id).filter(Boolean)).size)}
            icon={Building2}
            tone="warning"
          />
        </>
      }
      columns={[
        {
          key: "code",
          header: "Code",
          render: (r) =>
            r.code ? (
              <span className="font-mono text-xs">{r.code}</span>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        {
          key: "name",
          header: "Department",
          render: (r) => <span className="font-medium">{r.name}</span>,
        },
        {
          key: "plant_id",
          header: "Plant",
          render: (r) => (
            <span className="text-muted-foreground text-xs">
              {r.plant_id ? "Linked" : "Company-wide"}
            </span>
          ),
        },
        {
          key: "created_at",
          header: "Created",
          render: (r) => (
            <span className="text-xs text-muted-foreground">
              {new Date(r.created_at).toLocaleDateString()}
            </span>
          ),
        },
      ]}
    />
  );
}
