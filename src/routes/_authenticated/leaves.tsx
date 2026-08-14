import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Users, Clock, CheckCircle2, XCircle, Plus, Loader2 } from "lucide-react";
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
import { notifyLeaveRequestSubmitted } from "@/lib/notifications";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({
    meta: [
      { title: "Leaves — FactoryOS AI" },
      { name: "description", content: "Employee leave requests, approvals and balance tracking." },
    ],
  }),
  component: LeavesPage,
});

const LEAVE_TYPES = ["Annual", "Sick", "Personal", "Casual", "Unpaid"];

function LeavesPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [showNew, setShowNew] = useState(false);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; leave: any | null; reason: string }>({
    open: false,
    leave: null,
    reason: "",
  });
  const [form, setForm] = useState({
    employee_id: "",
    leave_type: "Annual",
    start_date: "",
    end_date: "",
    reason: "",
  });

  // Real leave requests — same table employees use, scoped by RLS.
  const { data: leaves } = useQuery({
    queryKey: ["leaves", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("leaves")
          .select("*, profiles!left(full_name, email)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: profiles } = useQuery({
    queryKey: ["leave-profiles", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("company_id", companyId!)
          .order("full_name")
      ).data ?? [],
    enabled: !!companyId,
  });

  const today = new Date().toISOString().slice(0, 10);
  const pending = (leaves ?? []).filter((l: any) => l.status === "pending").length;
  const approved = (leaves ?? []).filter((l: any) => l.status === "approved").length;
  const onLeaveToday = (leaves ?? []).filter(
    (l: any) =>
      l.status === "approved" &&
      l.start_date <= today &&
      l.end_date >= today,
  ).length;
  const totalDays = (leaves ?? [])
    .filter((l: any) => l.status === "approved")
    .reduce((s: number, l: any) => {
      const days =
        (new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) / 86400000 + 1;
      return s + Math.max(1, days);
    }, 0);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !form.employee_id || !form.start_date || !form.end_date)
        throw new Error("Employee and dates are required");
      const { data: inserted, error } = await supabase
        .from("leaves")
        .insert({
          company_id: companyId,
          employee_id: form.employee_id,
          leave_type: form.leave_type,
          start_date: form.start_date,
          end_date: form.end_date,
          reason: form.reason || null,
          status: "pending",
        })
        .select("id")
        .single();
      if (error) throw error;
      const emp = (profiles ?? []).find((p: any) => p.id === form.employee_id);
      // Targeted to the HR Manager role (HR-only receivers, never broadcast).
      await notifyLeaveRequestSubmitted(
        companyId,
        emp?.full_name ?? "An employee",
        form.leave_type,
        inserted.id,
      );
    },
    onSuccess: () => {
      toast.success("Leave request created");
      setShowNew(false);
      setForm({ employee_id: "", leave_type: "Annual", start_date: "", end_date: "", reason: "" });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const approveMutation = useMutation({
    mutationFn: async (leave: any) => {
      if (!user) throw new Error("Not authenticated");
      // The DB trigger trg_leave_decision_side_effects writes the attendance
      // rows (on_leave for every covered date) and notifies the specific
      // employee (to_user = their profiles.id) — single source of truth, so
      // the client only flips the status.
      const { data, error } = await supabase
        .from("leaves")
        .update({ status: "approved", approver_id: user.id, resolved_at: new Date().toISOString() })
        .eq("id", leave.id)
        .select();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Leave approved — attendance updated");
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
      queryClient.invalidateQueries({ queryKey: ["att-records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async () => {
      if (!rejectDialog.leave || !user) return;
      const { data, error } = await supabase
        .from("leaves")
        .update({
          status: "rejected",
          approver_id: user.id,
          resolved_at: new Date().toISOString(),
          rejection_reason: rejectDialog.reason || null,
        })
        .eq("id", rejectDialog.leave.id)
        .select();
      // trg_leave_decision_side_effects notifies the employee with the
      // rejection reason (to_user) — client only flips the status.
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Leave request rejected");
      setRejectDialog({ open: false, leave: null, reason: "" });
      queryClient.invalidateQueries({ queryKey: ["leaves"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="HR"
        title="Leaves"
        sub="Leave requests, approvals and balance management."
        actions={
          !isAuditor ? (
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New Leave Request
            </Button>
          ) : null
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Pending Requests" value={String(pending)} icon={Clock} tone="warning" />
        <Kpi label="Approved" value={String(approved)} icon={CheckCircle2} tone="success" />
        <Kpi label="On Leave Today" value={String(onLeaveToday)} icon={Calendar} tone="info" />
        <Kpi label="Approved Days" value={String(totalDays)} icon={Users} tone="primary" />
      </div>

      <div className="mt-4">
        <Panel title={`${(leaves ?? []).length} Leave Requests`}>
          {(leaves ?? []).length === 0 ? (
            <EmptyState title="No leave requests yet" sub="New requests appear here." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Employee", "Type", "From", "To", "Days", "Status", ""].map((h) => (
                      <th
                        key={h}
                        className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(leaves ?? []).map((l: any) => {
                    const days =
                      (new Date(l.end_date).getTime() - new Date(l.start_date).getTime()) /
                        86400000 +
                      1;
                    return (
                      <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2.5 px-2 font-medium">{l.profiles?.full_name ?? "—"}</td>
                        <td className="py-2.5 px-2 text-muted-foreground">{l.leave_type}</td>
                        <td className="py-2.5 px-2 font-mono text-xs">{l.start_date}</td>
                        <td className="py-2.5 px-2 font-mono text-xs">{l.end_date}</td>
                        <td className="py-2.5 px-2 tabular-nums">{Math.max(1, days)}</td>
                        <td className="py-2.5 px-2">
                          <StatusBadge status={l.status} />
                        </td>
                        <td className="py-2.5 px-2">
                          {!isAuditor && l.status === "pending" && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-success"
                                disabled={approveMutation.isPending}
                                onClick={() => approveMutation.mutate(l)}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-destructive"
                                onClick={() => setRejectDialog({ open: true, leave: l, reason: "" })}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Reject
                              </Button>
                            </div>
                          )}
                          {l.rejection_reason && (
                            <span className="text-[11px] text-destructive">
                              {l.rejection_reason}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* New leave dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>New Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Employee *</Label>
              <Select value={form.employee_id} onValueChange={(v) => setForm((f) => ({ ...f, employee_id: v }))}>
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
              <Label className="text-xs text-muted-foreground">Leave Type</Label>
              <Select value={form.leave_type} onValueChange={(v) => setForm((f) => ({ ...f, leave_type: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LEAVE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Start Date *</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">End Date *</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason</Label>
              <Input
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="Optional"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => setRejectDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject Leave Request</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-sm">
              {rejectDialog.leave?.profiles?.full_name ?? "Employee"} ·{" "}
              {rejectDialog.leave?.leave_type}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason (optional)</Label>
              <Input
                value={rejectDialog.reason}
                onChange={(e) => setRejectDialog((d) => ({ ...d, reason: e.target.value }))}
                placeholder="Sent to the employee with the rejection notice"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, leave: null, reason: "" })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              Reject Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
