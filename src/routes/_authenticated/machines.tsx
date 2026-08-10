import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Cog, Wrench, TrendingUp, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/machines")({
  head: () => ({
    meta: [
      { title: "Machines — FactoryOS AI" },
      {
        name: "description",
        content: "Machine fleet management, utilization and maintenance tracking.",
      },
    ],
  }),
  component: MachinesPage,
});

const MACHINE_FORM_FIELDS: FormField[] = [
  {
    key: "name",
    label: "Machine Name",
    type: "text",
    placeholder: "CNC Mill Alpha-1",
    required: true,
  },
  { key: "code", label: "Machine Code", type: "text", placeholder: "MC-A1", required: true },
  {
    key: "type",
    label: "Type",
    type: "select",
    placeholder: "Select type",
    options: [
      { value: "5-axis CNC", label: "5-axis CNC" },
      { value: "3-axis CNC", label: "3-axis CNC" },
      { value: "Turning Center", label: "Turning Center" },
      { value: "6-axis Robot", label: "6-axis Robot" },
      { value: "Molding", label: "Molding" },
      { value: "Fiber Laser", label: "Fiber Laser" },
      { value: "Press Brake", label: "Press Brake" },
      { value: "EDM", label: "EDM" },
      { value: "Grinder", label: "Grinder" },
      { value: "Welding Robot", label: "Welding Robot" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "operational",
    options: [
      { value: "operational", label: "Operational" },
      { value: "maintenance", label: "Maintenance" },
      { value: "down", label: "Down" },
    ],
  },
  {
    key: "utilization",
    label: "Utilization %",
    type: "number",
    placeholder: "85",
    defaultValue: "80",
  },
];

function MachinesPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const { data } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => (await supabase.from("machines").select("*").order("name")).data ?? [],
  });

  const operational = data?.filter((m) => m.status === "operational").length ?? 0;
  const downCount =
    data?.filter((m) => m.status === "down" || m.status === "maintenance").length ?? 0;
  const avgUtil = data?.length
    ? (data.reduce((s, m) => s + Number(m.utilization ?? 0), 0) / data.length).toFixed(1)
    : "—";

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const { error } = await supabase.from("machines").insert({
        company_id: companyId!,
        name: formData.name,
        code: formData.code,
        type: formData.type || null,
        status: formData.status || "operational",
        utilization: parseFloat(formData.utilization) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Machine added");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase
        .from("machines")
        .update({
          name: data.name,
          code: data.code,
          type: data.type || null,
          status: data.status || "operational",
          utilization: parseFloat(data.utilization) || 0,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Machine updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("machines").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Machine removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <ResourceView
      eyebrow="Operations"
      title="Machines"
      sub="Fleet overview — utilization, status and maintenance scheduling."
      moduleName="machines"
      rows={data}
      searchKeys={["name", "code", "type", "status"]}
      formFields={MACHINE_FORM_FIELDS}
      onSubmit={async (formData, editingRow) => {
        if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        else await createMutation.mutateAsync(formData);
      }}
      onDelete={(row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi label="Total Machines" value={String(data?.length ?? 0)} icon={Cog} tone="primary" />
          <Kpi label="Operational" value={String(operational)} icon={TrendingUp} tone="success" />
          <Kpi label="Down / Maint." value={String(downCount)} icon={Wrench} tone="warning" />
          <Kpi label="Avg Utilization" value={`${avgUtil}%`} icon={AlertTriangle} tone="info" />
        </>
      }
      columns={[
        {
          key: "name",
          header: "Machine",
          render: (r) => (
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-[11px] text-muted-foreground">{r.code}</div>
            </div>
          ),
        },
        { key: "type", header: "Type", hideOnMobile: true },
        {
          key: "utilization",
          header: "Utilization",
          render: (r) => (
            <div className="flex items-center gap-2 w-32">
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${Number(r.utilization) > 80 ? "bg-success" : Number(r.utilization) > 50 ? "bg-warning" : "bg-destructive"}`}
                  style={{ width: `${Math.min(Number(r.utilization ?? 0), 100)}%` }}
                />
              </div>
              <span className="tabular-nums text-xs w-10 text-right">
                {Math.round(Number(r.utilization ?? 0))}%
              </span>
            </div>
          ),
        },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
