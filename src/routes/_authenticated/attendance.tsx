import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Timer, UserCheck, UserX, Clock, Plus } from "lucide-react";
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
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [empId, setEmpId] = useState("");
  const [checkIn, setCheckIn] = useState("");

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
      queryClient.invalidateQueries({ queryKey: ["att-profiles"] });
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

  // REAL attendance records — same table HR uses, scoped by RLS.
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

  const records = (attendanceRecords ?? []).map((r: any) => ({
    id: r.id,
    name: r.profiles?.full_name ?? "Unknown",
    job_title: r.profiles?.job_title ?? "—",
    date: r.date ?? "",
    check_in: r.check_in ? new Date(r.check_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
    check_out: r.check_out ? new Date(r.check_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—",
    status: r.status ?? "present",
    hours: Number(r.hours_worked ?? 0),
  }));

  const total = records.length;
  const present = records.filter((r: any) => r.status === "present").length;
  const absent = records.filter((r: any) => r.status === "absent").length;
  const avgHours =
    records.length
      ? (records.reduce((s: number, r: any) => s + r.hours, 0) / records.length).toFixed(1)
      : "0.0";

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="People"
        title="Attendance"
        sub="Daily attendance tracking, check-in/out and shift management."
        actions={
          !isAuditor ? (
            <Button
              className="bg-[image:var(--gradient-primary)] shadow-glow"
              onClick={() => setShowNew(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Record Attendance
            </Button>
          ) : null
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total Employees" value={String(total)} icon={Timer} tone="primary" />
        <Kpi label="Present Today" value={String(present)} icon={UserCheck} tone="success" />
        <Kpi label="Absent" value={String(absent)} icon={UserX} tone="warning" />
        <Kpi label="Avg Hours" value={`${avgHours}h`} icon={Clock} tone="info" />
      </div>
      <div className="mt-4">
        <Panel title="Today's Attendance">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Employee
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Role
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Date
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Check In
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Check Out
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Hours
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 font-medium">{r.name}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">
                      {r.job_title}
                    </td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">
                      {r.date ?? "—"}
                    </td>
                    <td className="py-2.5 px-2 font-mono text-xs">{r.check_in ?? "—"}</td>
                    <td className="py-2.5 px-2 font-mono text-xs hidden md:table-cell">
                      {r.check_out ?? "—"}
                    </td>
                    <td className="py-2.5 px-2 tabular-nums">
                      {r.hours > 0 ? `${r.hours}h` : "—"}
                    </td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
