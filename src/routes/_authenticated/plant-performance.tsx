import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Gauge,
  Factory,
  Users,
  Timer,
  Wrench,
  Send,
  TreePine,
  AlertOctagon,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { notifyDailyReportSubmitted, notifyMachineIssue } from "@/lib/notifications";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/plant-performance")({
  head: () => ({
    meta: [
      { title: "Plant Performance — FactoryOS AI" },
      { name: "description", content: "Live plant oversight — schedule, attendance, machines, departments and daily reporting" },
    ],
  }),
  component: PlantPerformancePage,
});

function PlantPerformancePage() {
  const queryClient = useQueryClient();
  const { companyId, user, profile } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({
    units_completed: "0",
    attendance_summary: "",
    downtime_minutes: "0",
    issues: "",
    notes: "",
  });
  const [issueDialog, setIssueDialog] = useState<{ open: boolean; machine: any | null }>({
    open: false,
    machine: null,
  });
  const [issueText, setIssueText] = useState("");

  // Production schedule — the SAME rows Production Manager creates.
  const { data: planning } = useQuery({
    queryKey: ["pm-schedule", companyId],
    queryFn: async () =>
      (await supabase.from("production_planning").select("*").order("start_date", { ascending: true }))
        .data ?? [],
    enabled: !!companyId,
  });

  // Work orders at this plant — read-only (RLS blocks plant_manager writes).
  const { data: workOrders } = useQuery({
    queryKey: ["pm-plant-wo", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("*, machines!left(name), profiles!work_orders_operator_id_fkey(full_name)")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []).map((wo: any) => ({
        ...wo,
        machine_name: wo.machines?.name ?? "—",
        operator_name: wo.profiles?.full_name ?? "Unassigned",
      }));
    },
    enabled: !!companyId,
  });

  // Staff attendance today — the SAME records Operators/HR write. No embed:
  // attendance.employee_id has no FK constraint, so joins fail; names are
  // mapped client-side from the real employees table.
  const { data: attendance } = useQuery({
    queryKey: ["pm-attendance-today", companyId, today],
    queryFn: async () =>
      (
        await supabase
          .from("attendance")
          .select("*")
          .eq("company_id", companyId!)
          .eq("date", today)
      ).data ?? [],
    enabled: !!companyId,
  });

  // Machines at this plant — read-only (Maintenance owns status changes).
  const { data: machines } = useQuery({
    queryKey: ["pm-machines", companyId],
    queryFn: async () =>
      (await supabase.from("machines").select("*").eq("company_id", companyId!).order("name")).data ??
      [],
    enabled: !!companyId,
  });

  // Departments + headcount.
  const { data: departments } = useQuery({
    queryKey: ["pm-departments", companyId],
    queryFn: async () =>
      (await supabase.from("departments").select("*").eq("company_id", companyId!).order("name"))
        .data ?? [],
    enabled: !!companyId,
  });
  const { data: employees } = useQuery({
    queryKey: ["pm-employees", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("employees")
          .select("id, full_name, department_id")
          .eq("company_id", companyId!)
          .eq("status", "active")
      ).data ?? [],
    enabled: !!companyId,
  });

  // Daily reports — own plant's history.
  const { data: dailyReports } = useQuery({
    queryKey: ["pm-daily-reports", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("daily_reports")
          .select("*")
          .eq("company_id", companyId!)
          .order("report_date", { ascending: false })
          .limit(30)
      ).data ?? [],
    enabled: !!companyId,
  });

  const submitReport = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const { data: inserted, error } = await supabase
        .from("daily_reports")
        .insert({
          company_id: companyId,
          submitted_by: user.id,
          report_date: today,
          units_completed: parseInt(reportForm.units_completed) || 0,
          attendance_summary: reportForm.attendance_summary || null,
          downtime_minutes: parseFloat(reportForm.downtime_minutes) || 0,
          issues: reportForm.issues || null,
          notes: reportForm.notes || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      await notifyDailyReportSubmitted(
        companyId,
        today,
        profile?.full_name ?? user.email ?? "Plant Manager",
        inserted.id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-daily-reports"] });
      toast.success("Daily report submitted — Company Admin notified");
      setReportOpen(false);
      setReportForm({
        units_completed: "0",
        attendance_summary: "",
        downtime_minutes: "0",
        issues: "",
        notes: "",
      });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reportIssue = useMutation({
    mutationFn: async () => {
      if (!companyId || !user || !issueDialog.machine) throw new Error("Missing data");
      const { data: inserted, error } = await supabase
        .from("machine_breakdowns")
        .insert({
          company_id: companyId,
          machine_id: issueDialog.machine.id,
          downtime_start: new Date().toISOString(),
          cause: issueText || "Flagged by Plant Manager",
          reported_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      await notifyMachineIssue(
        companyId,
        issueDialog.machine.name,
        profile?.full_name ?? "Plant Manager",
        inserted.id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pm-machines"] });
      toast.success("Issue reported — Maintenance Engineer notified");
      setIssueDialog({ open: false, machine: null });
      setIssueText("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const employeeById = new Map((employees ?? []).map((e: any) => [e.id, e]));
  const deptById = new Map((departments ?? []).map((d: any) => [d.id, d.name]));
  const attendanceRows = (attendance ?? []).map((a: any) => {
    const emp = employeeById.get(a.employee_id);
    return {
      ...a,
      employee_name: emp?.full_name ?? "—",
      department_name: emp ? (deptById.get(emp.department_id) ?? "—") : "—",
    };
  });
  const present = (attendance ?? []).filter((a: any) => a.status === "present").length;
  const absent = (attendance ?? []).filter((a: any) => a.status === "absent").length;
  const late = (attendance ?? []).filter((a: any) => a.status === "late").length;
  const operational = (machines ?? []).filter((m: any) => m.status === "operational").length;
  const down = (machines ?? []).filter((m: any) => m.status === "down").length;
  const maintenance = (machines ?? []).filter((m: any) => m.status === "maintenance").length;
  const activeWo = (workOrders ?? []).filter(
    (w: any) => w.status === "in_progress" || w.status === "pending",
  ).length;
  const completedToday =
    (workOrders ?? []).filter(
      (w: any) => w.status === "completed" && (w.end_time ?? "").slice(0, 10) === today,
    ).length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Plant"
        title="Plant Performance"
        sub="Day-to-day oversight of this plant — schedule, attendance, machines and daily reporting. Read-only views pulled live from the same tables Production, HR and Maintenance write to."
        actions={
          <Button
            className="bg-[image:var(--gradient-primary)] shadow-glow"
            onClick={() => setReportOpen(true)}
          >
            <Send className="h-4 w-4 mr-1.5" />
            Submit Daily Report
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Present Today" value={String(present)} icon={Users} tone="success" />
        <Kpi label="Absent / Late" value={String(absent + late)} icon={Timer} tone="warning" />
        <Kpi label="Machines Operational" value={`${operational}/${machines?.length ?? 0}`} icon={Gauge} tone="primary" />
        <Kpi label="Active Work Orders" value={String(activeWo)} icon={Factory} tone="info" />
      </div>

      {/* Production Schedule */}
      <Panel title={`Production Schedule (${planning?.length ?? 0} planned)`} className="mb-4">
        {planning?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                  {["Order", "Status", "Priority", "Start", "Due", "Qty"].map((h) => (
                    <th key={h} className="py-2 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(planning ?? []).map((p: any) => (
                  <tr key={p.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 px-2 font-medium font-mono text-xs">{p.order_number ?? "—"}</td>
                    <td className="py-2 px-2"><StatusBadge status={p.status ?? "planned"} /></td>
                    <td className="py-2 px-2"><StatusBadge status={p.priority ?? "medium"} /></td>
                    <td className="py-2 px-2">{p.start_date ? new Date(p.start_date).toLocaleDateString() : "—"}</td>
                    <td className="py-2 px-2">{p.due_date ? new Date(p.due_date).toLocaleDateString() : "—"}</td>
                    <td className="py-2 px-2 tabular-nums">{Number(p.quantity ?? 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No planned production" sub="Production Manager schedules orders here — they appear as soon as planning starts." />
        )}
      </Panel>

      {/* Staff Attendance */}
      <Panel title={`Staff Attendance — Today (${attendance?.length ?? 0} logged)`} className="mb-4">
        {attendance?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                  {["Employee", "Department", "Check-in", "Check-out", "Status"].map((h) => (
                    <th key={h} className="py-2 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {attendanceRows.map((a: any) => (
                  <tr key={a.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 px-2 font-medium">{a.employee_name}</td>
                    <td className="py-2 px-2">{a.department_name}</td>
                    <td className="py-2 px-2">{a.check_in ? new Date(a.check_in).toLocaleTimeString() : "—"}</td>
                    <td className="py-2 px-2">{a.check_out ? new Date(a.check_out).toLocaleTimeString() : "—"}</td>
                    <td className="py-2 px-2"><StatusBadge status={a.status ?? "—"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No attendance logged yet today" sub="Attendance appears here live as operators check in — this is the same record HR sees." />
        )}
      </Panel>

      {/* Machine Status */}
      <Panel title={`Machine Status (${machines?.length ?? 0} machines)`} className="mb-4">
        {machines?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                  {["Machine", "Code", "Type", "Status", "Utilization", "Actions"].map((h) => (
                    <th key={h} className="py-2 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(machines ?? []).map((m: any) => (
                  <tr key={m.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 px-2 font-medium">{m.name}</td>
                    <td className="py-2 px-2 font-mono text-xs">{m.code ?? "—"}</td>
                    <td className="py-2 px-2">{m.type ?? "—"}</td>
                    <td className="py-2 px-2"><StatusBadge status={m.status ?? "unknown"} /></td>
                    <td className="py-2 px-2 tabular-nums">{Math.round(Number(m.utilization ?? 0))}%</td>
                    <td className="py-2 px-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs text-amber-400"
                        onClick={() => setIssueDialog({ open: true, machine: m })}
                      >
                        <AlertOctagon className="h-3 w-3 mr-1" />
                        Report Issue
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No machines" sub="Machines registered by the company appear here." />
        )}
      </Panel>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Departments */}
        <Panel title="Departments & Headcount">
          {departments?.length ? (
            <div className="divide-y divide-white/5">
              {(departments ?? []).map((d: any) => {
                const headcount = (employees ?? []).filter(
                  (e: any) => e.department_id === d.id,
                ).length;
                const deptToday = attendanceRows.filter((a: any) => a.department_name === d.name);
                return (
                  <div key={d.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <TreePine className="h-4 w-4 text-primary" />
                      <span className="font-medium">{d.name}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {headcount} staff · {deptToday.filter((a: any) => a.status === "present").length} present today
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState title="No departments" sub="Departments are shared with HR and Production — none created yet." />
          )}
        </Panel>

        {/* Daily Reports history */}
        <Panel title={`Daily Reports (${dailyReports?.length ?? 0} submitted)`}>
          {dailyReports?.length ? (
            <div className="divide-y divide-white/5">
              {(dailyReports ?? []).map((r: any) => (
                <div key={r.id} className="py-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-sm">
                      {r.report_date} · {r.units_completed} units
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {r.downtime_minutes ? `${r.downtime_minutes} min downtime` : "No downtime"}
                      {r.issues ? ` · ${r.issues}` : ""}
                    </div>
                  </div>
                  <StatusBadge status={r.status ?? "submitted"} />
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No reports yet" sub="Submit the end-of-day report — it goes straight to Company Admin." />
          )}
        </Panel>
      </div>

      {/* Work orders (read-only) */}
      <Panel title={`Work Orders at Plant (${workOrders?.length ?? 0})`} className="mt-4">
        {workOrders?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                  {["WO #", "Operation", "Machine", "Operator", "Progress", "Status"].map((h) => (
                    <th key={h} className="py-2 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(workOrders ?? []).map((w: any) => (
                  <tr key={w.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 px-2 font-mono text-xs font-medium">{w.wo_number}</td>
                    <td className="py-2 px-2">{w.operation ?? "—"}</td>
                    <td className="py-2 px-2">{w.machine_name}</td>
                    <td className="py-2 px-2">{w.operator_name}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2 w-28">
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-[image:var(--gradient-primary)]"
                            style={{ width: `${w.progress_percent ?? 0}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs w-8 text-right">
                          {Math.round(Number(w.progress_percent ?? 0))}%
                        </span>
                      </div>
                    </td>
                    <td className="py-2 px-2"><StatusBadge status={w.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No work orders yet" sub="Work orders created by Production Manager appear here (read-only)." />
        )}
      </Panel>

      {/* Daily Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              End-of-Day Report — {today}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Units Completed</Label>
              <Input
                type="number"
                value={reportForm.units_completed}
                onChange={(e) => setReportForm((f) => ({ ...f, units_completed: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Downtime (minutes)</Label>
              <Input
                type="number"
                value={reportForm.downtime_minutes}
                onChange={(e) => setReportForm((f) => ({ ...f, downtime_minutes: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Attendance Summary</Label>
              <Input
                value={reportForm.attendance_summary}
                onChange={(e) => setReportForm((f) => ({ ...f, attendance_summary: e.target.value }))}
                placeholder="e.g. 18 present, 2 absent, 1 late"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Issues Encountered</Label>
              <Textarea
                rows={2}
                value={reportForm.issues}
                onChange={(e) => setReportForm((f) => ({ ...f, issues: e.target.value }))}
                placeholder="Machine downtime, shortages, delays..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea
                rows={2}
                value={reportForm.notes}
                onChange={(e) => setReportForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Anything else Company Admin should know"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => submitReport.mutate()}
              disabled={submitReport.isPending}
            >
              {submitReport.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Send className="h-4 w-4 mr-1.5" />}
              Submit to Company Admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Report Issue Dialog */}
      <Dialog open={issueDialog.open} onOpenChange={(o) => setIssueDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-amber-400" />
              Report Machine Issue — {issueDialog.machine?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Describe the issue</Label>
            <Textarea
              rows={3}
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              placeholder="e.g. CNC spindle making grinding noise, stops mid-cycle"
            />
            <p className="text-[11px] text-muted-foreground">
              Routes to the Maintenance Engineer, matching the Production Operator's issue flow.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueDialog({ open: false, machine: null })}>
              Cancel
            </Button>
            <Button
              className="bg-amber-500/90 hover:bg-amber-500 text-black"
              onClick={() => reportIssue.mutate()}
              disabled={reportIssue.isPending || !issueText.trim()}
            >
              <CheckCircle2 className="h-4 w-4 mr-1.5" />
              Report to Maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
