import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, Loader2, CheckCircle2, Wrench, Clock } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { safeDate } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/schedules")({
  head: () => ({
    meta: [
      { title: "Maintenance Schedules — FactoryOS AI" },
      { name: "description", content: "Preventive maintenance calendar per machine." },
    ],
  }),
  component: SchedulesPage,
});

const RECURRENCE_DAYS: Record<string, number> = { weekly: 7, monthly: 30, quarterly: 90 };

function SchedulesPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ machine_id: "", recurrence: "monthly", next_due: "", assigned_to: "", notes: "" });

  const { data: schedules } = useQuery({
    queryKey: ["ms-schedules", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("maintenance_schedules")
          .select("*, machines!left(name, code, last_maintenance)")
          .eq("company_id", companyId!)
          .order("next_due", { ascending: true })
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: machines } = useQuery({
    queryKey: ["ms-machines"],
    queryFn: async () =>
      (await supabase.from("machines").select("id, name, code").order("name")).data ?? [],
  });

  const { data: profiles } = useQuery({
    queryKey: ["ms-profiles", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("company_id", companyId!)
          .order("full_name")
      ).data ?? [],
    enabled: !!companyId,
  });

  const today = new Date().toISOString().slice(0, 10);
  const in7 = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const dueThisWeek = (schedules ?? []).filter(
    (s: any) => s.status !== "completed" && s.next_due <= in7,
  ).length;
  const overdue = (schedules ?? []).filter(
    (s: any) => s.status !== "completed" && s.next_due < today,
  ).length;
  const completed = (schedules ?? []).filter((s: any) => s.status === "completed").length;

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!form.machine_id || !form.next_due) throw new Error("Machine and due date required");
      const { error } = await supabase.from("maintenance_schedules").insert({
        company_id: companyId,
        machine_id: form.machine_id,
        recurrence: form.recurrence,
        next_due: form.next_due,
        assigned_to: form.assigned_to || null,
        notes: form.notes.trim() || null,
        status: "scheduled",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Maintenance scheduled");
      setShowNew(false);
      setForm({ machine_id: "", recurrence: "monthly", next_due: "", assigned_to: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["ms-schedules"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const completeMutation = useMutation({
    mutationFn: async (sched: any) => {
      if (!user) throw new Error("Not authenticated");
      const days = RECURRENCE_DAYS[sched.recurrence] ?? 30;
      const nextDue = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from("maintenance_schedules")
        .update({ status: "completed", last_done: nowIso, next_due: nextDue, assigned_to: user.id })
        .eq("id", sched.id);
      if (error) throw error;
      if (sched.machine_id) {
        await supabase
          .from("machines")
          .update({ status: "operational", last_maintenance: nowIso })
          .eq("id", sched.machine_id);
        await supabase.from("machine_status_log").insert({
          company_id: sched.company_id,
          machine_id: sched.machine_id,
          from_status: "operational",
          to_status: "operational",
          reason: `Preventive maintenance completed (${sched.recurrence})`,
          changed_by: user.id,
        });
      }
    },
    onSuccess: () => {
      toast.success("Maintenance completed — machine service dates updated");
      queryClient.invalidateQueries({ queryKey: ["ms-schedules"] });
      queryClient.invalidateQueries({ queryKey: ["machines"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Maintenance"
        title="Maintenance Schedules"
        sub="Preventive maintenance calendar per machine — scheduled dates, type and assigned engineer."
        actions={
          !isAuditor ? (
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Schedule Maintenance
            </Button>
          ) : null
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Due This Week" value={String(dueThisWeek)} icon={Calendar} tone="warning" />
        <Kpi label="Overdue" value={String(overdue)} icon={Clock} tone="destructive" />
        <Kpi label="Completed" value={String(completed)} icon={CheckCircle2} tone="success" />
        <Kpi label="Total Schedules" value={String(schedules?.length ?? 0)} icon={Wrench} tone="primary" />
      </div>

      <div className="mt-4">
        <Panel title={`${(schedules ?? []).length} Maintenance Schedules`}>
          {(schedules ?? []).length === 0 ? (
            <EmptyState title="No maintenance schedules" sub="Schedule preventive maintenance for a machine." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Machine", "Recurrence", "Next Due", "Last Done", "Assigned", "Status", ""].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(schedules ?? []).map((s: any) => (
                    <tr key={s.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2">
                        <div className="font-medium">{s.machines?.name ?? "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{s.machines?.code}</div>
                      </td>
                      <td className="py-2.5 px-2 capitalize text-muted-foreground">{s.recurrence}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">{s.next_due?.slice(0, 10) ?? "—"}</td>
                      <td className="py-2.5 px-2 font-mono text-xs">{s.last_done ? safeDate(s.last_done) : "—"}</td>
                      <td className="py-2.5 px-2 text-muted-foreground text-xs">
                        {(profiles ?? []).find((p: any) => p.id === s.assigned_to)?.full_name ?? "—"}
                      </td>
                      <td className="py-2.5 px-2">
                        <StatusBadge status={s.status === "completed" ? "completed" : "scheduled"} />
                      </td>
                      <td className="py-2.5 px-2">
                        {!isAuditor && s.status !== "completed" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-success"
                            onClick={() => completeMutation.mutate(s)}
                            disabled={completeMutation.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Mark Completed
                          </Button>
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

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Schedule Maintenance</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Machine *</Label>
              <Select value={form.machine_id} onValueChange={(v) => setForm((f) => ({ ...f, machine_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select machine" />
                </SelectTrigger>
                <SelectContent>
                  {(machines ?? []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Recurrence</Label>
                <Select value={form.recurrence} onValueChange={(v) => setForm((f) => ({ ...f, recurrence: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Next Due *</Label>
                <Input type="date" min={new Date().toISOString().split("T")[0]} value={form.next_due} onChange={(e) => setForm((f) => ({ ...f, next_due: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Assigned Engineer</Label>
              <Select value={form.assigned_to} onValueChange={(v) => setForm((f) => ({ ...f, assigned_to: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select engineer (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {(profiles ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Input value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="e.g. replace spindle bearing" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
