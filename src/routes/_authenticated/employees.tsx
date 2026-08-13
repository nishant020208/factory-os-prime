import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserCheck, UserMinus, GraduationCap, Building2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/employees")({
  head: () => ({
    meta: [
      { title: "Employees — FactoryOS AI" },
      { name: "description", content: "Employee directory, roles and workforce management." },
    ],
  }),
  component: EmployeesPage,
});

const EMPLOYEE_FORM_FIELDS: FormField[] = [
  { key: "full_name", label: "Full Name", type: "text", placeholder: "John Smith", required: true },
  { key: "email", label: "Email", type: "email", placeholder: "john@company.com", required: true },
  { key: "phone", label: "Phone", type: "text", placeholder: "+1 555-0123" },
  { key: "job_title", label: "Job Title", type: "text", placeholder: "CNC Operator" },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "active",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "on_leave", label: "On Leave" },
    ],
  },
];

function EmployeesPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [deptFilter, setDeptFilter] = useState<string>("all");

  // Fetch employees from profiles
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

  // Fetch roles
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

  // Fetch departments
  const { data: departments } = useQuery({
    queryKey: ["emp-departments", companyId],
    queryFn: async () => (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  // Fetch employee-department assignments
  const { data: empDepts } = useQuery({
    queryKey: ["emp-dept-assignments", companyId],
    queryFn: async () =>
      (await supabase.from("employee_departments").select("*, departments(name)")).data ?? [],
  });

  // Build department map: employee_id -> department names
  const deptMap = new Map<string, { id: string; name: string }[]>();
  (empDepts ?? []).forEach((ed: any) => {
    const existing = deptMap.get(ed.employee_id) ?? [];
    existing.push({ id: ed.department_id, name: ed.departments?.name ?? "—" });
    deptMap.set(ed.employee_id, existing);
  });

  // Merge: prefer profiles, supplement with role info and departments
  const employees = (data ?? []).map((p) => {
    const role = rolesData?.find((r: any) => r.user_id === p.id);
    const departments_ = deptMap.get(p.id) ?? [];
    return {
      ...p,
      role: role?.role ?? null,
      departments: departments_.map((d: any) => d.name).join(", "),
      department_ids: departments_.map((d: any) => d.id),
    };
  });

  // Filter by department
  const filteredEmployees =
    deptFilter === "all"
      ? employees
      : employees.filter((e) => e.department_ids?.includes(deptFilter));

  const activeCount = employees.filter((e) => e.status === "active").length;
  const totalRoles = new Set(rolesData?.map((r: any) => r.role).filter(Boolean)).size;

  // Assign/update department for an employee
  const assignDeptMutation = useMutation({
    mutationFn: async ({
      employeeId,
      deptId,
      add,
    }: {
      employeeId: string;
      deptId: string;
      add: boolean;
    }) => {
      if (!companyId) return;
      if (add) {
        const { error } = await supabase.from("employee_departments").insert({
          company_id: companyId,
          employee_id: employeeId,
          department_id: deptId,
          is_primary: false,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("employee_departments")
          .delete()
          .eq("employee_id", employeeId)
          .eq("department_id", deptId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emp-dept-assignments"] });
      toast.success("Department updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ResourceView
        eyebrow="People"
        title="Employees"
        sub="Company employee directory with roles, departments and contact information."
        moduleName="employees"
        rows={filteredEmployees}
        searchKeys={["full_name", "email", "phone", "job_title", "departments"]}
        formFields={isAuditor ? undefined : EMPLOYEE_FORM_FIELDS}
        extraActions={
          <div className="flex items-center gap-2">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-8 text-xs rounded-md border border-input bg-background px-2"
            >
              <option value="all">All Departments</option>
              {(departments ?? []).map((d: any) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </div>
        }
        onSubmit={isAuditor ? undefined : async (formData, editingRow) => {
          if (editingRow) {
            const { error } = await supabase
              .from("profiles")
              .update({
                full_name: formData.full_name,
                email: formData.email,
                phone: formData.phone || null,
                job_title: formData.job_title || null,
                status: formData.status || "active",
              })
              .eq("id", editingRow.id);
            if (error) throw error;
            toast.success("Employee updated");
          } else {
            toast.info("New employees must be created via whitelist and sign up");
          }
          queryClient.invalidateQueries({ queryKey: ["employees"] });
        }}
        onDelete={isAuditor ? undefined : async (row) => {
          const { error } = await supabase
            .from("profiles")
            .update({ status: "inactive" })
            .eq("id", row.id);
          if (error) throw error;
          queryClient.invalidateQueries({ queryKey: ["employees"] });
          toast.success("Employee deactivated");
        }}
        kpis={
          <>
            <Kpi
              label="Total Employees"
              value={String(employees.length)}
              icon={Users}
              tone="primary"
            />
            <Kpi label="Active" value={String(activeCount)} icon={UserCheck} tone="success" />
            <Kpi
              label="Departments"
              value={String(departments?.length ?? 0)}
              icon={Building2}
              tone="info"
            />
            <Kpi
              label="Unique Roles"
              value={String(totalRoles)}
              icon={GraduationCap}
              tone="warning"
            />
          </>
        }
        columns={[
          {
            key: "full_name",
            header: "Employee",
            render: (r) => (
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-[10px] font-medium text-primary">
                  {(r.full_name ?? "?")
                    .split(" ")
                    .map((w: string) => w[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()}
                </div>
                <div>
                  <div className="font-medium">{r.full_name ?? "—"}</div>
                  <div className="text-[11px] text-muted-foreground">{r.job_title ?? "—"}</div>
                </div>
              </div>
            ),
          },
          { key: "email", header: "Email", hideOnMobile: true },
          { key: "phone", header: "Phone", hideOnMobile: true },
          {
            key: "role",
            header: "Role",
            render: (r) =>
              r.role ? (
                <Badge variant="outline" className="text-[10px] font-medium capitalize">
                  {r.role.replace(/_/g, " ")}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          {
            key: "departments",
            header: "Departments",
            render: (r) =>
              r.departments ? (
                <div className="flex flex-wrap gap-1">
                  {r.departments.split(", ").map((d: string, i: number) => (
                    <span
                      key={i}
                      className="text-[10px] bg-primary/10 text-primary border border-primary/20 rounded-full px-2 py-0.5"
                    >
                      {d}
                    </span>
                  ))}
                </div>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        ]}
      />

      {/* Department assignment panel */}
      {departments && departments.length > 0 && (
        <div className="mt-4 glass rounded-2xl p-5 border-white/5">
          <div className="text-sm font-medium mb-3 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            Department Assignments
          </div>
          <div className="text-xs text-muted-foreground mb-3">
            Employees can belong to multiple departments. Use the select menu to assign departments.
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {(departments ?? []).map((dept: any) => {
              const count = employees.filter((e) => e.department_ids?.includes(dept.id)).length;
              return (
                <div
                  key={dept.id}
                  className="rounded-lg bg-card/60 border border-white/5 p-2 text-center"
                >
                  <div className="text-sm font-medium">{dept.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {count} employee{count !== 1 ? "s" : ""}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
