import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserCheck, UserMinus, GraduationCap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({ meta: [
    { title: "Employees — FactoryOS AI" },
    { name: "description", content: "Employee directory, roles and workforce management." },
  ]}),
  component: EmployeesPage,
});

const EMPLOYEE_FORM_FIELDS: FormField[] = [
  { key: "full_name", label: "Full Name", type: "text", placeholder: "John Smith", required: true },
  { key: "email", label: "Email", type: "email", placeholder: "john@company.com", required: true },
  { key: "phone", label: "Phone", type: "text", placeholder: "+1 555-0123" },
  { key: "job_title", label: "Job Title", type: "text", placeholder: "CNC Operator" },
  { key: "status", label: "Status", type: "select", defaultValue: "active", options: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "on_leave", label: "On Leave" },
  ]},
];

// We query profiles as employees since that's where employee data lives
function EmployeesPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const { data } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", companyId)
        .order("full_name");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // If no profiles for the company, fall back to user_roles joined data
  const { data: rolesData } = useQuery({
    queryKey: ["employee-roles", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("*, profiles!inner(full_name, email, phone, job_title, status, avatar_url)")
        .eq("company_id", companyId);
      if (error) return [];
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Merge: prefer profiles, supplement with role info
  const employees = (data ?? []).map(p => {
    const role = rolesData?.find((r: any) => r.user_id === p.id);
    return {
      ...p,
      role: role?.role ?? null,
    };
  });

  const activeCount = employees.filter(e => e.status === "active").length;
  const totalRoles = new Set(rolesData?.map((r: any) => r.role).filter(Boolean)).size;

  return (
    <ResourceView
      eyebrow="People"
      title="Employees"
      sub="Company employee directory with roles and contact information."
      moduleName="employees"
      rows={employees}
      searchKeys={["full_name", "email", "phone", "job_title"]}
      formFields={EMPLOYEE_FORM_FIELDS}
      onSubmit={async (formData, editingRow) => {
        if (editingRow) {
          const { error } = await supabase.from("profiles").update({
            full_name: formData.full_name,
            email: formData.email,
            phone: formData.phone || null,
            job_title: formData.job_title || null,
            status: formData.status || "active",
          }).eq("id", editingRow.id);
          if (error) throw error;
          toast.success("Employee updated");
        } else {
          toast.info("New employees must be created via whitelist and sign up");
        }
        queryClient.invalidateQueries({ queryKey: ["employees"] });
      }}
      onDelete={async (row) => {
        // Soft-delete: mark as inactive rather than hard delete
        const { error } = await supabase.from("profiles").update({ status: "inactive" }).eq("id", row.id);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ["employees"] });
        toast.success("Employee deactivated");
      }}
      kpis={
        <>
          <Kpi label="Total Employees" value={String(employees.length)} icon={Users} tone="primary" />
          <Kpi label="Active" value={String(activeCount)} icon={UserCheck} tone="success" />
          <Kpi label="Inactive" value={String(employees.length - activeCount)} icon={UserMinus} tone="warning" />
          <Kpi label="Unique Roles" value={String(totalRoles)} icon={GraduationCap} tone="info" />
        </>
      }
      columns={[
        { key: "full_name", header: "Employee", render: (r) => (
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-medium text-primary">
              {(r.full_name ?? "?").split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="font-medium">{r.full_name ?? "—"}</div>
              <div className="text-[11px] text-muted-foreground">{r.job_title ?? "—"}</div>
            </div>
          </div>
        )},
        { key: "email", header: "Email", hideOnMobile: true },
        { key: "phone", header: "Phone", hideOnMobile: true },
        { key: "role", header: "Role", render: (r) => r.role ? (
          <Badge variant="outline" className="text-[10px] font-medium capitalize">{r.role.replace(/_/g, " ")}</Badge>
        ) : <span className="text-muted-foreground">—</span> },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
