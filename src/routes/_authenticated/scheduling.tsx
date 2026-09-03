import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Plus, Trash2, Loader2, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/scheduling")({
  head: () => ({
    meta: [
      { title: "Scheduling — FactoryOS AI" },
      { name: "description", content: "Shift and department scheduling with real operator assignment." },
    ],
  }),
  component: SchedulingPage,
});

function SchedulingPage() {
  const queryClient = useQueryClient();
  const { companyId, user } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    department_id: "",
    shift: "morning",
    shift_date: new Date().toISOString().slice(0, 10),
    operator_ids: [] as string[],
    notes: "",
  });

  const { data: schedules } = useQuery({
    queryKey: ["scheduling-list", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("shift_schedules")
        .select("*, departments!left(name)")
        .eq("company_id", companyId!)
        .order("shift_date", { ascending: false })
        .limit(60);
      return (data ?? []).map((s: any) => ({
        ...s,
        department_name: s.departments?.name ?? "—",
        operators: (s.operator_ids ?? []) as string[],
      }));
    },
    enabled: !!companyId,
  });

  const { data: departments } = useQuery({
    queryKey: ["scheduling-depts", companyId],
    queryFn: async () =>
      (await supabase.from("departments").select("*").eq("company_id", companyId!).order("name"))
        .data ?? [],
    enabled: !!companyId,
  });

  // Real production operators (same list the Work Orders page uses).
  const { data: operators } = useQuery({
    queryKey: ["scheduling-ops", companyId],
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
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      if (!form.department_id) throw new Error("Select a department");
      const { error } = await supabase.from("shift_schedules").insert({
        company_id: companyId,
        plant_id: null,
        department_id: form.department_id,
        shift: form.shift,
        shift_date: form.shift_date,
        operator_ids: form.operator_ids,
        notes: form.notes || null,
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling-list"] });
      toast.success("Shift scheduled");
      setOpen(false);
      setForm({ department_id: "", shift: "morning", shift_date: new Date().toISOString().slice(0, 10), operator_ids: [], notes: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("shift_schedules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scheduling-list"] });
      toast.success("Shift removed");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const toggleOperator = (id: string) =>
    setForm((f) => ({
      ...f,
      operator_ids: f.operator_ids.includes(id)
        ? f.operator_ids.filter((o) => o !== id)
        : [...f.operator_ids, id],
    }));

  const scheduled = schedules?.length ?? 0;
  const nextUp =
    (schedules ?? []).filter((s: any) => s.shift_date >= new Date().toISOString().slice(0, 10))
      .length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Production"
        title="Scheduling"
        sub="Department shift schedules with real operator assignment — the same operators the Work Orders tab assigns."
        actions={
          <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Schedule Shift
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Kpi label="Scheduled Shifts" value={String(scheduled)} icon={Calendar} tone="primary" />
        <Kpi label="Upcoming" value={String(nextUp)} icon={Calendar} tone="info" />
        <Kpi label="Operators Available" value={String(operators?.length ?? 0)} icon={Users} tone="success" />
      </div>

      <Panel title={`${scheduled} shifts`}>
        {schedules?.length ? (
          <div className="divide-y divide-white/5">
            {(schedules ?? []).map((s: any) => (
              <div key={s.id} className="py-3 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.department_name}</span>
                    <StatusBadge status={s.shift} />
                    <span className="text-xs text-muted-foreground">
                      {new Date(s.shift_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {s.operators.length
                      ? s.operators.map((id: string) => {
                          const op = (operators ?? []).find((o: any) => o.id === id);
                          return op?.full_name ?? "—";
                        }).join(", ")
                      : "No operators assigned"}
                    {s.notes ? ` · ${s.notes}` : ""}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 text-destructive"
                  onClick={() => removeMutation.mutate(s.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No shifts scheduled" sub="Schedule a shift to assign operators per department and date." />
        )}
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Schedule Shift
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs">Department *</Label>
              <Select
                value={form.department_id}
                onValueChange={(v) => setForm((f) => ({ ...f, department_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Shift</Label>
              <Select value={form.shift} onValueChange={(v) => setForm((f) => ({ ...f, shift: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Date</Label>
              <Input
                type="date"
                value={form.shift_date}
                onChange={(e) => setForm((f) => ({ ...f, shift_date: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Operators</Label>
              <div className="flex flex-wrap gap-1.5">
                {(operators ?? []).map((op: any) => {
                  const active = form.operator_ids.includes(op.id);
                  return (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => toggleOperator(op.id)}
                      className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                        active
                          ? "bg-primary/15 border-primary/40 text-primary"
                          : "border-white/10 text-muted-foreground hover:border-white/30"
                      }`}
                    >
                      {op.full_name}
                    </button>
                  );
                })}
                {!operators?.length && (
                  <span className="text-xs text-muted-foreground">No production operators yet.</span>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Overtime for the finishing rush"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending || !form.department_id}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Plus className="h-4 w-4 mr-1.5" />}
              Save Shift
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
