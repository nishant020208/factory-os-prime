import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  Factory,
  Cog,
  Users,
  Timer,
  Wrench,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge, Kpi } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { notifyMachineIssue } from "@/lib/notifications";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/plant-overview")({
  head: () => ({
    meta: [
      { title: "Plant Overview — FactoryOS AI" },
      {
        name: "description",
        content: "This plant's departments, machine roster, staff and daily pulse.",
      },
    ],
  }),
  component: PlantOverviewPage,
});

function PlantOverviewPage() {
  const qc = useQueryClient();
  const { companyId, user, profile } = useAuth();
  const today = new Date().toISOString().slice(0, 10);

  const { data: plant } = useQuery({
    queryKey: ["pa-plant", companyId],
    queryFn: async () => {
      // Prefer the plant assigned to this admin; fall back to the company's first plant.
      const mine = (
        await supabase
          .from("plants")
          .select("*")
          .eq("company_id", companyId!)
          .order("name")
      ).data;
      return mine?.[0] ?? null;
    },
    enabled: !!companyId,
  });

  const { data: departments } = useQuery({
    queryKey: ["pa-departments", companyId],
    queryFn: async () =>
      (await supabase.from("departments").select("*").eq("company_id", companyId!).order("name"))
        .data ?? [],
    enabled: !!companyId,
  });

  const { data: machines } = useQuery({
    queryKey: ["pa-machines", companyId],
    queryFn: async () =>
      (await supabase.from("machines").select("*").eq("company_id", companyId!).order("name"))
        .data ?? [],
    enabled: !!companyId,
  });

  const { data: employees } = useQuery({
    queryKey: ["pa-staff", companyId],
    queryFn: async () =>
      (await supabase.from("employees").select("*").eq("company_id", companyId!)).data ?? [],
    enabled: !!companyId,
  });

  const { data: attendance } = useQuery({
    queryKey: ["pa-attendance", companyId, today],
    queryFn: async () =>
      (
        await supabase
          .from("attendance")
          .select("*, employees!left(full_name, department_id, departments!left(name))")
          .eq("company_id", companyId!)
          .eq("date", today)
      ).data ?? [],
    enabled: !!companyId,
  });

  // ── Report machine issue (routes to Maintenance Engineer) ──
  const [issueDialog, setIssueDialog] = useState<{ open: boolean; machine: any }>({
    open: false,
    machine: null,
  });
  const [issueText, setIssueText] = useState("");

  const reportIssue = useMutation({
    mutationFn: async () => {
      if (!companyId || !user || !issueDialog.machine) throw new Error("Missing data");
      const { data: inserted, error } = await supabase
        .from("machine_breakdowns")
        .insert({
          company_id: companyId,
          machine_id: issueDialog.machine.id,
          downtime_start: new Date().toISOString(),
          cause: issueText || "Flagged by Plant Admin",
          reported_by: user.id,
        })
        .select("id")
        .single();
      if (error) throw error;
      await notifyMachineIssue(
        companyId,
        issueDialog.machine.name,
        profile?.full_name ?? "Plant Admin",
        inserted.id,
      );
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pa-machines"] });
      toast.success("Issue reported — Maintenance Engineer notified");
      setIssueDialog({ open: false, machine: null });
      setIssueText("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const operational = machines?.filter((m) => m.status === "operational").length ?? 0;
  const down = machines?.filter((m) => m.status === "down" || m.status === "maintenance").length ?? 0;
  const present = (attendance ?? []).filter((a: any) => a.status === "present").length;
  const absent = (attendance ?? []).filter((a: any) => a.status === "absent").length;
  const late = (attendance ?? []).filter((a: any) => a.status === "late").length;

  const deptById = new Map((departments ?? []).map((d) => [d.id, d.name]));
  const headcountByDept = new Map<string, number>();
  for (const e of employees ?? []) {
    const deptId = e.department_id ?? e.department ?? "unassigned";
    headcountByDept.set(deptId, (headcountByDept.get(deptId) ?? 0) + 1);
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="plant-overview" />
      <PageHeader
        eyebrow="Plant Admin"
        title={plant?.name ?? "Plant Overview"}
        sub={`${plant?.city ?? "—"} · ${plant?.code ?? "—"} — departments, machine roster, staff and today's attendance for this plant.`}
        actions={<ModuleCopilot moduleName="plant-overview" />}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Departments" value={String(departments?.length ?? 0)} icon={Factory} tone="primary" />
        <Kpi label="Machines" value={String(machines?.length ?? 0)} icon={Cog} tone="info" />
        <Kpi label="Staff" value={String(employees?.length ?? 0)} icon={Users} tone="success" />
        <Kpi
          label="Present Today"
          value={`${present}/${((attendance ?? []).length || (employees?.length ?? 0))}`}
          icon={Timer}
          tone="warning"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Machine roster — same table Maintenance Engineer manages */}
        <Panel
          title={`Machine Roster (${machines?.length ?? 0})`}
          className="lg:col-span-2"
          right={
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="text-success">{operational} operational</span>·
              <span className={down > 0 ? "text-destructive" : ""}>{down} down/maint.</span>
            </div>
          }
        >
          <div className="overflow-x-auto -mx-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["Machine", "Status", "Utilization", "Action"].map((h) => (
                    <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(machines ?? []).map((m) => (
                  <TableRow key={m.id} className="border-white/5">
                    <TableCell>
                      <div className="font-medium text-sm">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground">{m.code}</div>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={m.status} />
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">
                      {Math.round(Number(m.utilization ?? 0))}%
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-warning"
                        onClick={() => setIssueDialog({ open: true, machine: m })}
                      >
                        <Wrench className="h-3 w-3 mr-1" /> Report Issue
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {(machines ?? []).length === 0 && (
                  <TableRow className="border-white/5">
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">
                      No machines on this plant's roster yet.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Same roster Maintenance Engineer manages — plant setup configures it, maintenance owns
            live status.
          </p>
        </Panel>

        <div className="space-y-4">
          {/* Departments + headcount */}
          <Panel title={`Departments (${departments?.length ?? 0})`}>
            <div className="space-y-2">
              {(departments ?? []).map((d) => (
                <div key={d.id} className="flex items-center justify-between text-sm">
                  <span>{d.name}</span>
                  <span className="text-muted-foreground tabular-nums">
                    {headcountByDept.get(d.id) ?? 0}
                  </span>
                </div>
              ))}
              {(departments ?? []).length === 0 && (
                <div className="text-sm text-muted-foreground py-4 text-center">
                  No departments configured yet.
                </div>
              )}
            </div>
          </Panel>

          {/* Attendance pulse */}
          <Panel title="Attendance Today">
            <div className="flex items-center justify-between text-sm">
              <span className="text-success">Present</span>
              <span className="tabular-nums">{present}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-destructive">Absent</span>
              <span className="tabular-nums">{absent}</span>
            </div>
            <div className="flex items-center justify-between text-sm mt-2">
              <span className="text-warning">Late</span>
              <span className="tabular-nums">{late}</span>
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Same attendance Operators/HR write — Plant Admin watches, HR owns corrections.
            </p>
          </Panel>
        </div>
      </div>

      {/* Local staff */}
      <div className="mt-4">
        <Panel title={`Staff (${employees?.length ?? 0})`}>
          <div className="overflow-x-auto -mx-2">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["Name", "Department", "Designation", "Status"].map((h) => (
                    <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(employees ?? []).map((e) => (
                  <TableRow key={e.id} className="border-white/5">
                    <TableCell className="font-medium text-sm">{e.full_name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {deptById.get(e.department_id ?? "") ?? e.department ?? "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {e.job_title ?? "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={e.status} />
                    </TableCell>
                  </TableRow>
                ))}
                {(employees ?? []).length === 0 && (
                  <TableRow className="border-white/5">
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-6 text-sm">
                      No staff records yet — HR manages the employee records.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            HR owns the authoritative employee record; whitelisting stays with Company Admin.
          </p>
        </Panel>
      </div>

      {/* Machine issue dialog */}
      <Dialog
        open={issueDialog.open}
        onOpenChange={(open) => {
          if (!open) {
            setIssueDialog({ open: false, machine: null });
            setIssueText("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Report Issue — {issueDialog.machine?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">What's wrong?</Label>
            <Input
              value={issueText}
              onChange={(e) => setIssueText(e.target.value)}
              placeholder="e.g. spindle overheating, intermittent cutting errors"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIssueDialog({ open: false, machine: null })}
            >
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => reportIssue.mutate()}
              disabled={reportIssue.isPending}
            >
              {reportIssue.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Wrench className="h-4 w-4 mr-1.5" />
              )}
              Report to Maintenance
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
