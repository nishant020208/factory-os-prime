import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ListTodo,
  Cog,
  Users,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Plus,
  UserCheck,
  Ban,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
// Assignment and 100% completion notifications are fired by the database
// triggers (trg_operator_work_order_notify) with precise to_user targeting —
// never duplicated or broadcast from the client.
import { notifyQualityPassed, notifyBatchFailed } from "@/lib/notifications";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/work-orders")({
  head: () => ({
    meta: [
      { title: "Work Orders — FactoryOS AI" },
      {
        name: "description",
        content: "Work orders with operator assignment, progress tracking and machine status.",
      },
    ],
  }),
  component: WorkOrdersPage,
});

function WorkOrdersPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [showAssign, setShowAssign] = useState<{ open: boolean; woId: string }>({
    open: false,
    woId: "",
  });
  const [assignOp, setAssignOp] = useState("");
  const [formData, setFormData] = useState({
    wo_number: "",
    production_order_id: "",
    operation: "",
    machine_id: "",
    quantity: "100",
  });

  const isProductionManager =
    roles.includes("production_manager") || roles.includes("company_admin");
  const isOperator = roles.includes("production_operator");

  // Fetch work orders
  const { data: workOrders } = useQuery({
    queryKey: ["work-orders", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("*, machines!left(name, status), profiles!left(full_name)")
        .order("created_at", { ascending: false });
      return (data ?? []).map((wo: any) => ({
        ...wo,
        machine_name: wo.machines?.name ?? "—",
        machine_status: wo.machines?.status ?? "—",
        operator_name: wo.profiles?.full_name ?? "Unassigned",
      }));
    },
  });

  // Fetch production orders
  const { data: prodOrders } = useQuery({
    queryKey: ["wo-prod-orders", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("production_orders")
          .select("id, order_number")
          .eq("company_id", companyId!)
      ).data ?? [],
  });

  // Fetch machines (exclude those under maintenance)
  const { data: machines } = useQuery({
    queryKey: ["wo-machines", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("machines")
          .select("id, name, status")
          .eq("company_id", companyId!)
          .order("name")
      ).data ?? [],
  });

  // Fetch operators (production operators from user_roles)
  const { data: operators } = useQuery({
    queryKey: ["wo-operators", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("user_id, profiles!inner(full_name)")
        .eq("company_id", companyId!)
        .eq("role", "production_operator");
      return (data ?? []).map((r: any) => ({
        id: r.user_id,
        full_name: r.profiles?.full_name ?? "Unknown",
      }));
    },
  });

  // Create work order mutation
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      const machine = machines?.find((m: any) => m.id === formData.machine_id);
      if (machine?.status === "maintenance" || machine?.status === "down") {
        throw new Error(
          `Machine "${machine.name}" is ${machine.status} — cannot assign work orders`,
        );
      }
      const { error } = await supabase.from("work_orders").insert({
        company_id: companyId,
        wo_number: formData.wo_number || `WO-${Date.now().toString().slice(-6)}`,
        production_order_id: formData.production_order_id || null,
        machine_id: formData.machine_id || null,
        operation: formData.operation || null,
        quantity: parseInt(formData.quantity) || 100,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success("Work order created");
      setShowNew(false);
      setFormData({
        wo_number: "",
        production_order_id: "",
        operation: "",
        machine_id: "",
        quantity: "100",
      });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Assign operator mutation
  const assignMutation = useMutation({
    mutationFn: async () => {
      if (!assignOp) throw new Error("Select an operator");
      const { error } = await supabase
        .from("work_orders")
        .update({
          operator_id: assignOp,
          status: "in_progress",
        })
        .eq("id", showAssign.woId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      // The database trigger fires the targeted "work order assigned"
      // notification to the specific operator (to_user).
      toast.success("Operator assigned — notification sent");
      setShowAssign({ open: false, woId: "" });
      setAssignOp("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Update progress mutation (operator action)
  const updateProgressMutation = useMutation({
    mutationFn: async ({ woId, progress }: { woId: string; progress: number }) => {
      const newStatus = progress >= 100 ? "completed" : "in_progress";
      const { error } = await (supabase.from("work_orders") as any)
        .update({
          progress_percent: progress,
          status: newStatus,
          end_time: progress >= 100 ? new Date().toISOString() : null,
        })
        .eq("id", woId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      // The database trigger fires the targeted "work order complete"
      // notification to the production manager who assigned it (to_user).
      toast.success("Progress updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const blockedMachines =
    machines?.filter((m: any) => m.status === "maintenance" || m.status === "down") ?? [];
  const pending = workOrders?.filter((w: any) => w.status === "pending").length ?? 0;
  const inProgress = workOrders?.filter((w: any) => w.status === "in_progress").length ?? 0;
  const completed = workOrders?.filter((w: any) => w.status === "completed").length ?? 0;
  const total = workOrders?.length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="work-orders" />
      <PageHeader
        eyebrow="Production"
        title="Work Orders"
        sub="Machine-level work orders with operator assignment, progress tracking and departmental routing."
        actions={
          <div className="flex items-center gap-2">
            <ModuleCopilot moduleName="work-orders" />
            {isProductionManager && (
              <Button
                className="bg-[image:var(--gradient-primary)] shadow-glow"
                onClick={() => setShowNew(true)}
              >
                <Plus className="h-4 w-4 mr-1.5" />
                New Work Order
              </Button>
            )}
          </div>
        }
      />

      {/* Blocked machines alert */}
      {blockedMachines.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 mb-4 flex items-center gap-2">
          <Ban className="h-4 w-4 text-amber-400 shrink-0" />
          <span className="text-sm text-amber-400">
            {blockedMachines.length} machine{blockedMachines.length > 1 ? "s" : ""} under
            maintenance — new work orders blocked:{" "}
            {blockedMachines.map((m: any) => m.name).join(", ")}
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Total" value={String(total)} icon={ListTodo} tone="primary" />
        <Kpi label="Pending" value={String(pending)} icon={Clock} tone="warning" />
        <Kpi label="In Progress" value={String(inProgress)} icon={Cog} tone="info" />
        <Kpi label="Completed" value={String(completed)} icon={CheckCircle2} tone="success" />
      </div>

      {/* Progress Approval Section */}
      {isProductionManager && (
        <ProgressApprovalSection companyId={companyId} workOrders={workOrders ?? []} />
      )}

      <Panel title={`${total} Work Orders`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {[
                  "WO #",
                  "Operation",
                  "Machine",
                  "Operator",
                  "Qty",
                  "Progress",
                  "Status",
                  "Actions",
                ].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(workOrders ?? []).map((wo: any) => (
                <TableRow key={wo.id} className="border-white/5">
                  <TableCell className="font-medium font-mono text-xs">{wo.wo_number}</TableCell>
                  <TableCell>{wo.operation ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <span>{wo.machine_name}</span>
                      {wo.machine_status === "maintenance" && <StatusBadge status="maintenance" />}
                    </div>
                  </TableCell>
                  <TableCell>
                    {wo.operator_id ? (
                      <span className="flex items-center gap-1">
                        <UserCheck className="h-3 w-3 text-success" />
                        {wo.operator_name}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {Number(wo.quantity ?? 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2 w-28">
                      <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                        <div
                          className="h-full bg-[image:var(--gradient-primary)]"
                          style={{ width: `${wo.progress_percent ?? 0}%` }}
                        />
                      </div>
                      <span className="tabular-nums text-xs w-8 text-right">
                        {Math.round(Number(wo.progress_percent ?? 0))}%
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={wo.status} />
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      {isProductionManager && !wo.operator_id && wo.status === "pending" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs"
                          onClick={() => setShowAssign({ open: true, woId: wo.id })}
                        >
                          <Users className="h-3 w-3 mr-1" />
                          Assign
                        </Button>
                      )}
                      {isOperator && wo.operator_id === user?.id && wo.status !== "completed" && (
                        <div className="flex gap-1">
                          {[25, 50, 75, 100].map((pct) => (
                            <Button
                              key={pct}
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs"
                              onClick={() =>
                                updateProgressMutation.mutate({ woId: wo.id, progress: pct })
                              }
                              disabled={updateProgressMutation.isPending}
                            >
                              {pct}%
                            </Button>
                          ))}
                        </div>
                      )}
                      {roles.includes("quality_inspector") &&
                        wo.status === "completed" &&
                        wo.progress >= 100 && (
                          <div className="flex gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-success"
                              onClick={async () => {
                                if (!companyId) return;
                                await supabase
                                  .from("work_orders")
                                  .update({ status: "quality_passed" })
                                  .eq("id", wo.id);
                                queryClient.invalidateQueries({ queryKey: ["work-orders"] });
                                notifyQualityPassed(companyId, wo.wo_number, wo.id);
                                toast.success(`${wo.wo_number} passed — Warehouse notified`);
                              }}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Pass
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={async () => {
                                const reason = prompt("Rejection notes:");
                                if (!reason || !companyId) return;
                                await (supabase.from("work_orders") as any)
                                  .update({ status: "quality_failed", rejection_notes: reason })
                                  .eq("id", wo.id);
                                queryClient.invalidateQueries({ queryKey: ["work-orders"] });
                                notifyBatchFailed(companyId, wo.wo_number, reason, wo.id);
                                toast.error(`${wo.wo_number} failed — operator notified`);
                              }}
                            >
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Fail
                            </Button>
                          </div>
                        )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* New Work Order Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>New Work Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">WO Number</Label>
              <Input
                value={formData.wo_number}
                onChange={(e) => setFormData((f) => ({ ...f, wo_number: e.target.value }))}
                placeholder="WO-2026-0001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Production Order</Label>
              <Select
                value={formData.production_order_id}
                onValueChange={(v) => setFormData((f) => ({ ...f, production_order_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select production order" />
                </SelectTrigger>
                <SelectContent>
                  {(prodOrders ?? []).map((po: any) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.order_number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operation</Label>
              <Input
                value={formData.operation}
                onChange={(e) => setFormData((f) => ({ ...f, operation: e.target.value }))}
                placeholder="CNC Milling"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Machine *</Label>
              <Select
                value={formData.machine_id}
                onValueChange={(v) => setFormData((f) => ({ ...f, machine_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select machine" />
                </SelectTrigger>
                <SelectContent>
                  {(machines ?? []).map((m: any) => (
                    <SelectItem
                      key={m.id}
                      value={m.id}
                      disabled={m.status === "maintenance" || m.status === "down"}
                    >
                      {m.name}{" "}
                      {m.status === "maintenance"
                        ? "(Maintenance)"
                        : m.status === "down"
                          ? "(Down)"
                          : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Quantity</Label>
              <Input
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData((f) => ({ ...f, quantity: e.target.value }))}
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
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Plus className="h-4 w-4 mr-1.5" />
              )}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Operator Dialog */}
      <Dialog
        open={showAssign.open}
        onOpenChange={(o) => setShowAssign((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Assign Operator</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs">Select Operator</Label>
            <Select value={assignOp} onValueChange={setAssignOp}>
              <SelectTrigger>
                <SelectValue placeholder="Choose operator" />
              </SelectTrigger>
              <SelectContent>
                {(operators ?? []).map((op: any) => (
                  <SelectItem key={op.id} value={op.id}>
                    {op.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAssign({ open: false, woId: "" })}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => assignMutation.mutate()}
              disabled={!assignOp}
            >
              <UserCheck className="h-4 w-4 mr-1.5" />
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ProgressApprovalSection({ companyId, workOrders }: { companyId: string | null; workOrders: any[] }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const pendingApprovals = workOrders.filter((wo: any) => wo.progress_pending);

  const approveMutation = useMutation({
    mutationFn: async ({ wo, approved }: { wo: any; approved: boolean }) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const patch: any = {
        progress_pending: false,
        progress_approved_by: user.id,
        progress_approved_at: new Date().toISOString(),
      };
      if (approved) {
        // Extract progress from notes ("Progress update: 75% (pending approval)")
        const match = wo.notes?.match(/Progress update: (\d+)%/);
        const newProgress = match ? parseInt(match[1]) : wo.progress_percent;
        patch.progress_percent = newProgress;
        patch.status = newProgress >= 100 ? "completed" : "in_progress";
        if (newProgress >= 100 && !wo.end_time) patch.end_time = new Date().toISOString();
      } else {
        // Rejected — clear the pending update
        patch.progress_image_url = null;
        patch.notes = null;
      }
      const { error } = await supabase.from("work_orders").update(patch).eq("id", wo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work-orders"] });
      toast.success("Progress update processed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  if (!pendingApprovals.length) return null;

  return (
    <Panel title="Pending Progress Approvals" className="mb-4 border-amber-500/30">
      <div className="space-y-3">
        {pendingApprovals.map((wo: any) => (
          <div key={wo.id} className="flex flex-wrap items-start gap-4 p-3 rounded-lg border border-white/10 bg-white/5">
            <div className="flex-1 min-w-[200px]">
              <div className="font-medium text-sm">{wo.wo_number}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                {wo.operation ?? "Production"} · Operator: {wo.profiles?.full_name ?? "Unknown"}
              </div>
              {wo.notes && (
                <div className="text-xs text-blue-400 mt-1">{wo.notes}</div>
              )}
            </div>
            {wo.progress_image_url && (
              <img
                src={wo.progress_image_url}
                alt="Work progress"
                className="h-24 w-24 object-cover rounded-lg border"
              />
            )}
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-8 bg-green-600 hover:bg-green-700"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ wo, approved: true })}
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-red-500/30 text-red-400"
                disabled={approveMutation.isPending}
                onClick={() => approveMutation.mutate({ wo, approved: false })}
              >
                Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
