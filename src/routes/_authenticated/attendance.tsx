import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Timer, UserCheck, UserX, Clock, Plus, Pencil, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { OperatorAttendance } from "@/components/operator-workspace";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({
    meta: [
      { title: "Attendance — FactoryOS AI" },
      {
        name: "description",
        content: "Employee attendance tracking, shift management and time clock.",
      },
    ],
  }),
  component: AttendancePage,
});

function AttendancePage() {
  const { companyId, roles, user } = useAuth();
  if (roles.includes("production_operator")) return <OperatorAttendance />;
  const isAuditor = roles.includes("auditor");
  // HR Manager + Company Admin can correct any company attendance row.
  const canCorrect = roles.some((r) => ["hr_manager", "company_admin"].includes(r));
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [empId, setEmpId] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    status: "present",
    check_in: "",
    check_out: "",
    hours: "8",
    reason: "",
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const { error } = await supabase.from("attendance").insert({
        company_id: companyId,
        employee_id: empId,
        date: new Date().toISOString().split("T")[0],
        check_in: new Date().toISOString(),
        status: "present",
        hours_worked: 8,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance recorded");
      setShowNew(false);
      queryClient.invalidateQueries({ queryKey: ["att-records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const correctMutation = useMutation({
    mutationFn: async () => {
      if (!editRow) return;
      const { error } = await supabase
        .from("attendance")
        .update({
          status: editForm.status,
          check_in: editForm.check_in ? new Date(`${editRow.date}T${editForm.check_in}`).toISOString() : editRow.check_in,
          check_out: editForm.check_out ? new Date(`${editRow.date}T${editForm.check_out}`).toISOString() : editRow.check_out,
          hours_worked: parseFloat(editForm.hours) || 0,
          correction_reason: editForm.reason.trim() || `Corrected to ${editForm.status}`,
        })
        .eq("id", editRow.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Attendance corrected");
      setEditRow(null);
      queryClient.invalidateQueries({ queryKey: ["att-records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: profiles } = useQuery({
    queryKey: ["att-profiles", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("company_id", companyId)
        .order("full_name");
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // REAL attendance records — same table Production Operators write to via
  // their own check-in/check-out (verified in the Operator build).
  const { data: attendanceRecords } = useQuery({
    queryKey: ["att-records", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("attendance")
        .select("*, profiles!left(full_name, job_title)")
        .eq("company_id", companyId)
        .order("date", { ascending: false })
        .limit(300);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const today = new Date().toISOString().split("T")[0];
  const records = (attendanceRecords ?? []).map((r: any) => ({
    id: r.id,
    name: r.profiles?.full_name ?? "Unknown",
    job_title: r.profiles?.job_title ?? "—",
    date: r.date ?? "",
    check_in: r.check_in
      ? new Date(r.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—",
    check_out: r.check_out
      ? new Date(r.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : "—",
    status: r.status ?? "present",
    hours: Number(r.hours_worked ?? 0),
    correction_reason: r.correction_reason ?? null,
  }));

  const todaysRecords = records.filter((r: any) => r.date === today);
  const presentToday = todaysRecords.filter((r: any) => r.status === "present").length;
  const absentToday = todaysRecords.filter((r: any) => r.status === "absent").length;
  const onLeaveToday = todaysRecords.filter((r: any) => r.status === "on_leave").length;
  const avgHours = todaysRecords.length
    ? (todaysRecords.reduce((s: number, r: any) => s + r.hours, 0) / todaysRecords.length).toFixed(1)
    : "0.0";

  const openEdit = (r: any) => {
    setEditRow(r);
    setEditForm({
      status: r.status,
      check_in: r.check_in === "—" ? "" : r.check_in,
      check_out: r.check_out === "—" ? "" : r.check_out,
      hours: String(r.hours || 8),
      reason: r.correction_reason ?? "",
    });
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="attendance" />
      <PageHeader
        eyebrow="People"
        title="Attendance"
        sub="Daily attendance across every department — the same check-ins operators record themselves."
        actions={
          !isAuditor ? (
            <Button
              className="bg-[image:var(--gradient-primary)] shadow-glow"
              onClick={() => setShowNew(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Record Attendance
            </Button>
          ) : (
            <ModuleCopilot moduleName="attendance" />
          )
        }
      />
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Record Attendance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Employee</Label>
              <Select value={empId} onValueChange={setEmpId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select employee" />
                </SelectTrigger>
                <SelectContent>
                  {(profiles ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name ?? p.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Check In Time</Label>
              <Input type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!empId || createMutation.isPending}
              className="bg-[image:var(--gradient-primary)]"
            >
              Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Correction dialog */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Correct Attendance</DialogTitle>
          </DialogHeader>
          {editRow && (
            <div className="space-y-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{editRow.name}</span> · {editRow.date}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Status</Label>
                <Select value={editForm.status} onValueChange={(v) => setEditForm((f) => ({ ...f, status: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="present">Present</SelectItem>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="on_leave">On Leave</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Check In</Label>
                  <Input
                    type="time"
                    value={editForm.check_in}
                    onChange={(e) => setEditForm((f) => ({ ...f, check_in: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Check Out</Label>
                  <Input
                    type="time"
                    value={editForm.check_out}
                    onChange={(e) => setEditForm((f) => ({ ...f, check_out: e.target.value }))}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Hours</Label>
                <Input
                  type="number"
                  value={editForm.hours}
                  onChange={(e) => setEditForm((f) => ({ ...f, hours: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Correction Reason *</Label>
                <Input
                  value={editForm.reason}
                  onChange={(e) => setEditForm((f) => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. forgot to check in, biometric error"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => correctMutation.mutate()}
              disabled={correctMutation.isPending}
            >
              {correctMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Save Correction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Present Today" value={String(presentToday)} icon={UserCheck} tone="success" />
        <Kpi label="Absent Today" value={String(absentToday)} icon={UserX} tone="warning" />
        <Kpi label="On Leave Today" value={String(onLeaveToday)} icon={Timer} tone="info" />
        <Kpi label="Avg Hours Today" value={`${avgHours}h`} icon={Clock} tone="primary" />
      </div>
      <div className="mt-4">
        <Panel title="Attendance Records">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  {["Employee", "Role", "Date", "Check In", "Check Out", "Hours", "Status", ""].map((h) => (
                    <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 font-medium">{r.name}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">{r.job_title}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">{r.date}</td>
                    <td className="py-2.5 px-2 font-mono text-xs">{r.check_in}</td>
                    <td className="py-2.5 px-2 font-mono text-xs hidden md:table-cell">{r.check_out}</td>
                    <td className="py-2.5 px-2 tabular-nums">{r.hours > 0 ? `${r.hours}h` : "—"}</td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={r.status} />
                      {r.correction_reason && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 max-w-[160px] truncate" title={r.correction_reason}>
                          {r.correction_reason}
                        </div>
                      )}
                    </td>
                    <td className="py-2.5 px-2">
                      {canCorrect && (
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Correct" onClick={() => openEdit(r)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center text-muted-foreground py-12">
                      No attendance records yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
