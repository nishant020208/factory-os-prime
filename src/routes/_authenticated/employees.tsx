import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, UserCheck, Building2, Link2, Plus, Loader2, Pencil, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney } from "@/lib/currency";
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

const EMPTY_FORM = {
  full_name: "",
  email: "",
  phone: "",
  job_title: "",
  department_id: "",
  hire_date: "",
  salary: "",
  status: "active",
};

function EmployeesPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  // REAL employee records — the same table that links to profiles via email.
  const { data: employees } = useQuery({
    queryKey: ["employees", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("employees")
          .select("*")
          .eq("company_id", companyId!)
          .order("full_name")
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: departments } = useQuery({
    queryKey: ["emp-departments", companyId],
    queryFn: async () =>
      (await supabase.from("departments").select("*").order("name")).data ?? [],
  });

  const { data: profiles } = useQuery({
    queryKey: ["emp-profiles", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("company_id", companyId!)
      ).data ?? [],
    enabled: !!companyId,
  });

  const linkedEmails = new Set((profiles ?? []).map((p: any) => p.email?.toLowerCase()));
  const rows = (employees ?? []).map((e: any) => ({
    ...e,
    linked: linkedEmails.has((e.email ?? "").toLowerCase()),
  }));

  const deptName = (id: string | null) =>
    (departments ?? []).find((d: any) => d.id === id)?.name ?? (id ? id : "—");

  const activeCount = rows.filter((e: any) => e.status === "active").length;

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!form.full_name.trim()) throw new Error("Full name is required");
      const payload: any = {
        company_id: companyId,
        full_name: form.full_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        job_title: form.job_title.trim() || null,
        department_id: form.department_id || null,
        department: deptName(form.department_id),
        hire_date: form.hire_date || null,
        salary: parseFloat(form.salary) || 0,
        status: form.status || "active",
      };
      if (editing) {
        const { error } = await supabase.from("employees").update(payload).eq("id", editing.id);
        if (error) throw error;
        toast.success("Employee updated");
      } else {
        const { error } = await supabase.from("employees").insert({
          ...payload,
          employee_code: `EMP-${Date.now().toString().slice(-6)}`,
        });
        if (error) throw error;
        toast.success("Employee record created");
      }
    },
    onSuccess: () => {
      setShowForm(false);
      setEditing(null);
      setForm({ ...EMPTY_FORM });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("employees")
        .update({ status: "inactive" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Employee deactivated");
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openNew = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM });
    setShowForm(true);
  };
  const openEdit = (row: any) => {
    setEditing(row);
    setForm({
      full_name: row.full_name ?? "",
      email: row.email ?? "",
      phone: row.phone ?? "",
      job_title: row.job_title ?? "",
      department_id: row.department_id ?? "",
      hire_date: row.hire_date ? row.hire_date.slice(0, 10) : "",
      salary: row.salary ? String(row.salary) : "",
      status: row.status ?? "active",
    });
    setShowForm(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="People"
        title="Employees"
        sub="Employment records across every department — the same records linked to system users via email."
        actions={
          !isAuditor ? (
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={openNew}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Employee
            </Button>
          ) : null
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total Employees" value={String(rows.length)} icon={Users} tone="primary" />
        <Kpi label="Active" value={String(activeCount)} icon={UserCheck} tone="success" />
        <Kpi label="Departments" value={String(departments?.length ?? 0)} icon={Building2} tone="info" />
        <Kpi label="Linked to Login" value={String(rows.filter((r: any) => r.linked).length)} icon={Link2} tone="warning" />
      </div>

      <div className="mt-4">
        <Panel title={`${rows.length} Employee Records`}>
          {rows.length === 0 ? (
            <EmptyState title="No employees yet" sub="Add an employee record to get started." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Employee", "Designation", "Department", "Hire Date", "Salary", "Status", "Login", ""].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2">
                        <div className="font-medium">{r.full_name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.email ?? "—"}</div>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground">{r.job_title ?? "—"}</td>
                      <td className="py-2.5 px-2 text-muted-foreground">{deptName(r.department_id)}</td>
                      <td className="py-2.5 px-2 text-xs font-mono">{r.hire_date?.slice(0, 10) ?? "—"}</td>
                      <td className="py-2.5 px-2 text-xs font-mono">
                        {Number(r.salary ?? 0) > 0 ? fmtMoney(Number(r.salary)) : "—"}
                      </td>
                      <td className="py-2.5 px-2">
                        <StatusBadge status={r.status} />
                      </td>
                      <td className="py-2.5 px-2">
                        {r.linked ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-success">
                            <Link2 className="h-3 w-3" /> Linked
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">No login</span>
                        )}
                      </td>
                      <td className="py-2.5 px-2">
                        {!isAuditor && (
                          <div className="flex items-center gap-1.5">
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Edit" onClick={() => openEdit(r)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            {r.status !== "inactive" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 w-7 p-0 text-destructive"
                                title="Deactivate"
                                onClick={() => deactivateMutation.mutate(r.id)}
                              >
                                <UserMinus className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Employee Record" : "Add Employee Record"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Full Name *</Label>
              <Input value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="matches login if any" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Designation</Label>
                <Input value={form.job_title} onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Department</Label>
                <select
                  value={form.department_id}
                  onChange={(e) => setForm((f) => ({ ...f, department_id: e.target.value }))}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs"
                >
                  <option value="">Select department…</option>
                  {(departments ?? []).map((d: any) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hire Date</Label>
                <Input type="date" min={new Date().toISOString().split("T")[0]} value={form.hire_date} onChange={(e) => setForm((f) => ({ ...f, hire_date: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Salary ($/yr)</Label>
                <Input type="number" value={form.salary} onChange={(e) => setForm((f) => ({ ...f, salary: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs"
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="on_leave">On Leave</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              {editing ? "Save Changes" : "Create Record"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
