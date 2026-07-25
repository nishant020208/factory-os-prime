import { createFileRoute } from "@tanstack/react-router";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wrench, AlertCircle, TrendingUp, Plus, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => ({ meta: [
    { title: "Maintenance — FactoryOS AI" },
    { name: "description", content: "Preventive, corrective and AI-driven predictive maintenance." },
  ]}),
  component: MaintenancePage,
});

// Demo work orders — no maintenance_orders table exists yet
const DEMO_WORK_ORDERS = [
  { id: "WO-2026-0087", machine: "CNC Mill Alpha-1", type: "Preventive", due: "In 2 days", status: "planned", ai: 94 },
  { id: "WO-2026-0086", machine: "Robotic Assembly R-7", type: "Corrective", due: "In progress", status: "in_progress", ai: null },
  { id: "WO-2026-0085", machine: "Injection Molder IM-3", type: "Predictive", due: "In 5 days", status: "planned", ai: 82 },
  { id: "WO-2026-0084", machine: "Laser Cutter LC-9", type: "Preventive", due: "In 12 days", status: "planned", ai: 71 },
];

function MaintenancePage() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [machineName, setMachineName] = useState("");
  const [woType, setWoType] = useState("Preventive");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const { error } = await supabase.from("work_orders").insert({
        company_id: companyId,
        wo_number: `WO-${Date.now()}`,
        operation: woType,
        quantity: 1,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Work order created"); setShowNew(false); queryClient.invalidateQueries({ queryKey: ["maint-machines"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const { data: machines } = useQuery({
    queryKey: ["maint-machines"],
    queryFn: async () => (await supabase.from("machines").select("*").order("name")).data ?? [],
  });

  const down = machines?.filter((m) => m.status === "down" || m.status === "maintenance").length ?? 0;
  const operational = machines?.filter((m) => m.status === "operational").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
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
        <Kpi label="MTBF" value="428 h" delta="+12h" icon={TrendingUp} tone="success" />
        <Kpi label="MTTR" value="1.8 h" delta="-0.4h" icon={Wrench} tone="info" />
        <Kpi label="Operational" value={`${operational}/${machines?.length ?? 0}`} icon={Wrench} tone="primary" />
        <Kpi label="Down / Maint" value={String(down)} icon={AlertCircle} tone="warning" />
      </div>

      <div className="mt-4">
        <Panel title="Maintenance Work Orders">
          <div className="divide-y divide-white/5">
            {DEMO_WORK_ORDERS.map((w) => (
              <div key={w.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 sm:gap-3 py-3 text-sm">
                <div className="font-mono text-xs">{w.id}</div>
                <div>
                  <div>{w.machine}</div>
                  <div className="text-[11px] text-muted-foreground">{w.type}</div>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {w.due}
                </div>
                <StatusBadge status={w.status} />
                {w.ai !== null && (
                  <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">AI · {w.ai}%</span>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Machine Status">
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
        </Panel>
      </div>
    </div>
  );
}
