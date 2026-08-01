import { createFileRoute } from "@tanstack/react-router";
import { ModuleStatusBar } from "@/components/module-status";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, AlertCircle, TrendingUp, Plus, Clock, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => ({ meta: [
    { title: "Maintenance — FactoryOS AI" },
    { name: "description", content: "Preventive, corrective and AI-driven predictive maintenance." },
  ]}),
  component: MaintenancePage,
});

function MaintenancePage() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [machineName, setMachineName] = useState("");
  const [woType, setWoType] = useState("Preventive");

  // Real maintenance tickets — scoped by RLS to this company only.
  const { data: tickets } = useQuery({
    queryKey: ["maint-tickets"],
    queryFn: async () =>
      (await supabase.from("maintenance_tickets")
        .select("*, machines(name, code)")
        .order("created_at", { ascending: false })).data ?? [],
  });

  // Real breakdowns for MTBF / MTTR computation.
  const { data: breakdowns } = useQuery({
    queryKey: ["maint-breakdowns"],
    queryFn: async () =>
      (await supabase.from("machine_breakdowns")
        .select("downtime_start, downtime_end, cause")
        .order("downtime_start", { ascending: false })).data ?? [],
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const { error } = await supabase.from("maintenance_tickets").insert({
        company_id: companyId,
        ticket_number: `MT-${Date.now()}`,
        issue_description: `${machineName || "Machine"} — ${woType.toLowerCase()} maintenance`,
        priority: "medium",
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Maintenance ticket created"); setShowNew(false); setMachineName(""); queryClient.invalidateQueries({ queryKey: ["maint-tickets"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const { data: machines } = useQuery({
    queryKey: ["maint-machines"],
    queryFn: async () => (await supabase.from("machines").select("*").order("name")).data ?? [],
  });

  const down = machines?.filter((m) => m.status === "down" || m.status === "maintenance").length ?? 0;
  const operational = machines?.filter((m) => m.status === "operational").length ?? 0;

  // MTTR = avg resolved downtime (hours); MTBF = avg gap between breakdown starts.
  const resolvedBreaks = (breakdowns ?? []).filter((b: any) => b.downtime_start && b.downtime_end) as Array<{ downtime_start: string; downtime_end: string }>;
  const mttrH = resolvedBreaks.length
    ? resolvedBreaks.reduce((s, b) => s + (new Date(b.downtime_end).getTime() - new Date(b.downtime_start).getTime()) / 3600000, 0) / resolvedBreaks.length
    : null;
  const sortedStarts = (breakdowns ?? [])
    .filter((b: any) => b.downtime_start)
    .map((b: any) => new Date(b.downtime_start).getTime())
    .sort((a, b) => a - b);
  let mtbfH: number | null = null;
  if (sortedStarts.length >= 2) {
    let gapSum = 0;
    for (let i = 1; i < sortedStarts.length; i++) gapSum += sortedStarts[i] - sortedStarts[i - 1];
    mtbfH = gapSum / (sortedStarts.length - 1) / 3600000;
  }
  const fmt = (h: number | null) => (h === null ? "—" : `${h >= 100 ? Math.round(h) : h.toFixed(1)} h`);

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="maintenance" />
      <PageHeader
        eyebrow="Reliability"
        title="Maintenance"
        sub="Preventive, corrective and AI-driven predictive maintenance across every asset."
        actions={
          <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNew(true)}>
            <Plus className="h-4 w-4 mr-1.5" />New Work Order
          </Button>
        }
      />
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>New Maintenance Work Order</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Machine</Label><Input value={machineName} onChange={e => setMachineName(e.target.value)} placeholder="CNC Mill Alpha-1" /></div>
            <div className="space-y-1.5"><Label>Type</Label><Select value={woType} onValueChange={setWoType}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Preventive">Preventive</SelectItem><SelectItem value="Corrective">Corrective</SelectItem><SelectItem value="Predictive">Predictive</SelectItem></SelectContent></Select></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-[image:var(--gradient-primary)]">Create Work Order</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="MTBF" value={fmt(mtbfH)} icon={TrendingUp} tone="success" />
        <Kpi label="MTTR" value={fmt(mttrH)} icon={Wrench} tone="info" />
        <Kpi label="Operational" value={`${operational}/${machines?.length ?? 0}`} icon={Activity} tone="primary" />
        <Kpi label="Down / Maint" value={String(down)} icon={AlertCircle} tone="warning" />
      </div>

      <div className="mt-4">
        <Panel title="Maintenance Work Orders">
          {(tickets ?? []).length === 0 ? (
            <EmptyState title="No maintenance tickets yet" sub="New tickets appear here. Create one with New Work Order." />
          ) : (
            <div className="divide-y divide-white/5">
              {(tickets ?? []).map((w: any) => (
                <div key={w.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] items-center gap-2 sm:gap-3 py-3 text-sm">
                  <div className="font-mono text-xs">{w.ticket_number ?? w.id.slice(0, 8)}</div>
                  <div>
                    <div>{w.machines?.name ?? w.issue_description}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{w.issue_description}</div>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {safeDate(w.created_at)}
                  </div>
                  <StatusBadge status={w.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Machine Status">
          {(machines ?? []).length === 0 ? (
            <EmptyState title="No machines yet" sub="Machine status appears here once machines are added." />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {(machines ?? []).map((m) => (
                <div key={m.id} className="rounded-xl bg-card/60 border border-white/5 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{m.name}</div>
                      <div className="text-[11px] text-muted-foreground">{m.code} · {m.type ?? "—"}</div>
                    </div>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="mt-2 h-1.5 rounded-full bg-white/5 overflow-hidden">
                    <div className={`h-full rounded-full ${Number(m.utilization) > 80 ? "bg-success" : Number(m.utilization) > 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${Math.min(Number(m.utilization ?? 0), 100)}%` }} />
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground text-right">{Math.round(Number(m.utilization ?? 0))}% utilization</div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
