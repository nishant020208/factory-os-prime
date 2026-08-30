import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Clock,
  Loader2,
  Package,
  Wrench,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Kpi, PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { toast } from "sonner";

type WorkOrder = any;
const active = (status: string) => !["completed", "cancelled", "closed"].includes(status);

export function OperatorWorkOrders() {
  const { companyId, user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<WorkOrder | null>(null);
  const { data: orders = [], isLoading } = useQuery({
    queryKey: ["operator-work-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("*, machines!work_orders_machine_id_fkey(name, status)")
        .eq("operator_id", user!.id)
        .order("due_date");
      if (error) throw error;
      return data ?? [];
    },
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ["operator-work-orders", user?.id] });
  const [uploading, setUploading] = useState(false);
  const update = useMutation({
    mutationFn: async ({
      order,
      progress,
      checklist,
      imageUrl,
    }: {
      order: WorkOrder;
      progress?: number;
      checklist?: any[];
      imageUrl?: string | null;
    }) => {
      const nextProgress = progress ?? order.progress_percent;
      const patch: any = {};
      // If progress is changing, require image and set pending approval
      if (progress !== undefined && progress !== order.progress_percent) {
        if (!imageUrl && !order.progress_image_url) {
          throw new Error("Upload a photo of your work before updating progress");
        }
        patch.progress_pending = true;
        patch.progress_image_url = imageUrl ?? order.progress_image_url;
        // Store the proposed progress but don't confirm it yet
        patch.notes = `Progress update: ${nextProgress}% (pending approval)`;
      } else {
        // Checklist-only update (no progress change) — allow directly
        if (nextProgress >= 100 && !order.end_time) patch.end_time = new Date().toISOString();
        patch.progress_percent = nextProgress;
        patch.status = nextProgress >= 100 ? "completed" : nextProgress > 0 ? "in_progress" : order.status;
      }
      if (checklist) patch.checklist = checklist;
      const { error } = await supabase.from("work_orders").update(patch).eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Work order updated");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const open = orders.filter((o: any) => active(o.status));
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="My Shift"
        title="My Work Orders"
        sub="Only work explicitly assigned to you is shown here."
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Kpi label="Active" value={String(open.length)} icon={ClipboardList} tone="primary" />
        <Kpi
          label="Completed"
          value={String(orders.filter((o: any) => o.status === "completed").length)}
          icon={CheckCircle2}
          tone="success"
        />
        <Kpi
          label="Blocked"
          value={String(orders.filter((o: any) => o.status === "blocked").length)}
          icon={AlertTriangle}
          tone="warning"
        />
      </div>
      <div className="grid grid-cols-1 xl:grid-cols-[1.1fr_.9fr] gap-4">
        <Panel title="Assigned work">
          {isLoading ? (
            <Loader2 className="animate-spin m-8" />
          ) : (
            <div className="space-y-2">
              {orders.map((o: any) => (
                <button
                  key={o.id}
                  onClick={() => setSelected(o)}
                  className="w-full text-left rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition-colors"
                >
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{o.wo_number}</span>
                    <StatusBadge status={o.status} />
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {o.operation ?? "Production"} · Due {o.due_date ?? "Not scheduled"}
                  </div>
                  {o.machines && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <Wrench className="h-3 w-3 text-blue-400" />
                      <span className="text-xs text-blue-400">
                        {o.machines.name}
                        <span className={"ml-1 " + (o.machines.status === "operational" ? "text-green-400" : o.machines.status === "down" ? "text-red-400" : "text-amber-400")}>
                          ({o.machines.status})
                        </span>
                      </span>
                    </div>
                  )}
                  <Progress className="mt-3" value={o.progress_percent} />
                  <div className="text-xs text-muted-foreground mt-1">
                    {o.progress_percent}% complete
                  </div>
                </button>
              ))}
              {!orders.length && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No work orders are assigned to you.
                </p>
              )}
            </div>
          )}
        </Panel>
        <Panel title={selected ? selected.wo_number : "Work order detail"}>
          {selected ? (
            <WorkOrderDetail order={selected} save={update.mutate} pending={update.isPending} />
          ) : (
            <p className="py-8 text-sm text-muted-foreground">
              Select an assigned work order to review its checklist, materials and manager notes.
            </p>
          )}
        </Panel>
      </div>
    </div>
  );
}

function WorkOrderDetail({
  order,
  save,
  pending,
}: {
  order: WorkOrder;
  save: (v: any) => void;
  pending: boolean;
}) {
  const [custom, setCustom] = useState(String(order.progress_percent));
  const [progressImage, setProgressImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const checklist = Array.isArray(order.checklist) ? order.checklist : [];
  const materials = Array.isArray(order.materials) ? order.materials : [];
  // Open issues reported on this work order (visible via reported_by = me).
  const { data: openTickets = [] } = useQuery({
    queryKey: ["operator-open-tickets", order.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("maintenance_tickets")
        .select("id,ticket_number,issue_type,status")
        .eq("work_order_id", order.id)
        .in("status", ["open", "in_progress", "pending"]);
      if (error) throw error;
      return data ?? [];
    },
  });
  const setStep = (index: number, checked: boolean) => {
    const next = checklist.map((s: any, i: number) =>
      i === index ? { ...s, completed: checked } : s,
    );
    const complete = next.length
      ? Math.round((next.filter((s: any) => s.completed).length / next.length) * 100)
      : order.progress_percent;
    save({ order, checklist: next, progress: Math.max(order.progress_percent, complete) });
  };
  return (
    <div className="space-y-5">
      {order.status === "blocked" && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-amber-400">
          <div className="flex items-center gap-1.5 font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            Blocked by an open issue
          </div>
          <p className="mt-1 text-xs text-amber-400/80">
            {openTickets.length
              ? `${openTickets.map((t: any) => t.issue_type).join(", ")} issue${openTickets.length > 1 ? "s" : ""} reported. You'll be notified when it's resolved — update progress below to resume.`
              : "An issue was reported on this work order. You'll be notified when it's resolved — update progress below to resume."}
          </p>
        </div>
      )}
      <div>
        <div className="flex items-center justify-between">
          <span className="font-medium">{order.operation ?? "Production task"}</span>
          <StatusBadge status={order.status} />
        </div>
        {order.machines && (
          <div className="flex items-center gap-2 mt-1.5">
            <Wrench className="h-3.5 w-3.5 text-blue-400" />
            <span className="text-sm text-blue-400">
              {order.machines.name}
              <span className={"ml-1 " + (order.machines.status === "operational" ? "text-green-400" : order.machines.status === "down" ? "text-red-400" : "text-amber-400")}>
                ({order.machines.status})
              </span>
            </span>
          </div>
        )}
        <p className="text-sm text-muted-foreground mt-1">
          {order.notes || "No additional manager notes."}
        </p>
      </div>
      {order.design_image_url && (
        <img
          src={order.design_image_url}
          alt="Reference design"
          className="max-h-48 rounded-lg border"
        />
      )}
      <div>
        <Label>Task checklist</Label>
        <div className="mt-2 space-y-2">
          {checklist.map((step: any, i: number) => (
            <label key={i} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={!!step.completed}
                onCheckedChange={(v) => setStep(i, v === true)}
                disabled={pending}
              />
              {step.label}
            </label>
          ))}
          {!checklist.length && (
            <p className="text-sm text-muted-foreground">
              No checklist has been set for this stage.
            </p>
          )}
        </div>
      </div>
      <div>
        <Label>Allocated materials</Label>
        <div className="mt-2 space-y-1 text-sm">
          {materials.map((m: any, i: number) => (
            <div key={i} className="flex gap-2">
              <Package className="h-4 w-4" />
              {m.name} · {m.quantity} {m.unit ?? ""}
            </div>
          ))}
          {!materials.length && (
            <p className="text-muted-foreground">No material allocation recorded.</p>
          )}
        </div>
      </div>
      <div>
        <Label>Progress</Label>
        <Progress className="mt-2" value={order.progress_percent} />
        {order.progress_pending && (
          <div className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-sm text-amber-400">
            <div className="flex items-center gap-1.5 font-medium">
              <Clock className="h-3.5 w-3.5" />
              Progress update pending manager approval
            </div>
            {order.progress_image_url && (
              <img src={order.progress_image_url} alt="Work progress" className="mt-2 max-h-32 rounded-lg border" />
            )}
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
          {[25, 50, 75, 100].map((n) => (
            <Button
              key={n}
              variant="outline"
              size="sm"
              disabled={pending || n < order.progress_percent || order.progress_pending}
              onClick={() => save({ order, progress: n, imageUrl: progressImage })}
            >
              {n}%
            </Button>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <Input
            aria-label="Custom progress"
            type="number"
            min="0"
            max="100"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            disabled={order.progress_pending}
          />
          <Button
            disabled={pending || order.progress_pending}
            onClick={() =>
              save({
                order,
                progress: Math.max(order.progress_percent, Math.min(100, Number(custom))),
                imageUrl: progressImage,
              })
            }
          >
            Update
          </Button>
        </div>
        {!order.progress_pending && (
          <div className="mt-2">
            <Label className="text-xs text-muted-foreground">Upload work photo (required for progress update)</Label>
            <Input
              type="file"
              accept="image/*"
              className="mt-1"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const fileName = `progress/${order.id}/${Date.now()}_${file.name}`;
                  const { data, error } = await supabase.storage
                    .from("documents")
                    .upload(fileName, file);
                  if (error) throw error;
                  const { data: urlData } = supabase.storage.from("documents").getPublicUrl(data.path);
                  setProgressImage(urlData.publicUrl);
                } catch (err: any) {
                  toast.error("Upload failed: " + err.message);
                } finally {
                  setUploading(false);
                }
              }}
            />
            {progressImage && (
              <img src={progressImage} alt="Preview" className="mt-2 max-h-24 rounded-lg border" />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function OperatorIssueReporting() {
  const { companyId, user } = useAuth();
  const qc = useQueryClient();
  const [workOrderId, setWorkOrderId] = useState("");
  const [type, setType] = useState("machine");
  const [description, setDescription] = useState("");
  const { data: orders = [] } = useQuery({
    queryKey: ["operator-issue-orders", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_orders")
        .select("id,wo_number,machine_id")
        .eq("operator_id", user!.id)
        .neq("status", "completed");
      if (error) throw error;
      return data ?? [];
    },
  });
  const submit = useMutation({
    mutationFn: async () => {
      const wo = orders.find((o: any) => o.id === workOrderId);
      if (!wo || !companyId || !user) throw new Error("Select one of your work orders");
      const { error } = await supabase
        .from("maintenance_tickets")
        .insert({
          company_id: companyId,
          work_order_id: wo.id,
          machine_id: wo.machine_id,
          issue_description: description,
          priority: "medium",
          status: "open",
          reported_by: user.id,
          issue_type: type,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Issue reported and routed to the responsible person");
      setDescription("");
      setWorkOrderId("");
      qc.invalidateQueries({ queryKey: ["operator-work-orders"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="max-w-2xl mx-auto">
      <PageHeader
        eyebrow="My Shift"
        title="Report Issue"
        sub="Machine issues route to Maintenance, material issues to Warehouse, and general issues to Production."
      />
      <Panel title="New issue">
        <div className="space-y-4">
          <div>
            <Label>Work order</Label>
            <Select value={workOrderId} onValueChange={setWorkOrderId}>
              <SelectTrigger>
                <SelectValue placeholder="Select your work order" />
              </SelectTrigger>
              <SelectContent>
                {orders.map((o: any) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.wo_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Issue type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="machine">Machine issue · Maintenance</SelectItem>
                <SelectItem value="material">Material shortage / defect · Warehouse</SelectItem>
                <SelectItem value="general">Other / general · Production Manager</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what is stopping the work."
            />
          </div>
          <Button
            onClick={() => submit.mutate()}
            disabled={!workOrderId || !description.trim() || submit.isPending}
          >
            {submit.isPending ? (
              "Submitting…"
            ) : (
              <>
                <Wrench className="h-4 w-4 mr-1" />
                Report issue
              </>
            )}
          </Button>
        </div>
      </Panel>
    </div>
  );
}

export function OperatorAttendance() {
  const { companyId, user } = useAuth();
  const qc = useQueryClient();
  const today = new Date().toISOString().slice(0, 10);
  const { data: records = [] } = useQuery({
    queryKey: ["operator-attendance", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance")
        .select("*")
        .eq("employee_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const todayRecord = records.find((r: any) => r.date === today);
  const action = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) return;
      if (!todayRecord) {
        const { error } = await supabase
          .from("attendance")
          .insert({
            company_id: companyId,
            employee_id: user.id,
            date: today,
            check_in: new Date().toISOString(),
            status: "present",
          });
        if (error) throw error;
      } else {
        const start = todayRecord.check_in ? new Date(todayRecord.check_in).getTime() : Date.now();
        const { error } = await supabase
          .from("attendance")
          .update({
            check_out: new Date().toISOString(),
            hours_worked: Math.round((Date.now() - start) / 360000) / 10,
          })
          .eq("id", todayRecord.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(todayRecord ? "Checked out" : "Checked in");
      qc.invalidateQueries({ queryKey: ["operator-attendance"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="max-w-4xl mx-auto">
      <PageHeader
        eyebrow="My Shift"
        title="My Attendance"
        sub="Your own check-in/out history."
        actions={
          <Button
            onClick={() => action.mutate()}
            disabled={!!todayRecord?.check_out || action.isPending}
          >
            {todayRecord ? (todayRecord.check_out ? "Shift completed" : "Check out") : "Check in"}
          </Button>
        }
      />
      <Panel title="Attendance history">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2">Date</th>
                <th className="text-left p-2">Check in</th>
                <th className="text-left p-2">Check out</th>
                <th className="text-left p-2">Hours</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r: any) => (
                <tr key={r.id} className="border-b">
                  <td className="p-2">{r.date}</td>
                  <td className="p-2">
                    {r.check_in ? new Date(r.check_in).toLocaleTimeString() : "—"}
                  </td>
                  <td className="p-2">
                    {r.check_out ? new Date(r.check_out).toLocaleTimeString() : "—"}
                  </td>
                  <td className="p-2">{r.hours_worked ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
