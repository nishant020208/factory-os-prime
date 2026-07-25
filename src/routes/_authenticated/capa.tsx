import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, AlertTriangle, CheckCircle2, Clock, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/capa")({
  head: () => ({ meta: [
    { title: "CAPA — FactoryOS AI" },
    { name: "description", content: "Corrective and Preventive Actions tracking and management." },
  ]}),
  component: CAPAPage,
});

const CAPAS = [
  { id: "CAPA-2026-001", title: "Weld porosity on Al Housing batch", root_cause: "Shielding gas flow rate below spec", type: "Corrective", status: "completed", due: "2026-06-15", owner: "Sarah Chen" },
  { id: "CAPA-2026-002", title: "Dimensional drift on Ti Brackets", root_cause: "Tool wear beyond replacement interval", type: "Corrective", status: "in_progress", due: "2026-07-30", owner: "James Miller" },
  { id: "CAPA-2026-003", title: "Prevent coolant contamination", root_cause: "Preventive — no incident yet", type: "Preventive", status: "planned", due: "2026-08-15", owner: "Mike Johnson" },
  { id: "CAPA-2026-004", title: "Solder joint anomaly on CB-X1", root_cause: "Reflow profile needs optimization", type: "Corrective", status: "in_progress", due: "2026-07-15", owner: "Lisa Wang" },
];

function CAPAPage() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [capaType, setCapaType] = useState("Corrective");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const { error } = await supabase.from("approvals").insert({
        company_id: companyId,
        entity: "capa",
        status: "pending",
        notes: `[${capaType}] ${title}`,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("CAPA created"); setShowNew(false); queryClient.invalidateQueries(); },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = CAPAS.filter(c => c.status !== "completed").length;
  const completed = CAPAS.filter(c => c.status === "completed").length;
  const corrective = CAPAS.filter(c => c.type === "Corrective").length;
  const preventive = CAPAS.filter(c => c.type === "Preventive").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="capa" />
      <PageHeader eyebrow="Quality" title="CAPA" sub="Corrective and Preventive Actions — root cause analysis and resolution tracking."
        actions={<><Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1.5" />New CAPA</Button><ModuleCopilot moduleName="capa" /></>} />
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>New CAPA</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Title / Description</Label><Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Describe the corrective or preventive action" /></div>
            <div className="space-y-1.5"><Label>Type</Label><select className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={capaType} onChange={e => setCapaType(e.target.value)}><option value="Corrective">Corrective</option><option value="Preventive">Preventive</option></select></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!title || createMutation.isPending} className="bg-[image:var(--gradient-primary)]">Create CAPA</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Open CAPAs" value={String(open)} icon={AlertTriangle} tone="warning" />
        <Kpi label="Completed" value={String(completed)} icon={CheckCircle2} tone="success" />
        <Kpi label="Corrective" value={String(corrective)} icon={ShieldCheck} tone="info" />
        <Kpi label="Preventive" value={String(preventive)} icon={Clock} tone="primary" />
      </div>
      <div className="mt-4">
        <Panel title="CAPA Register">
          <div className="divide-y divide-white/5">
            {CAPAS.map(c => (
              <div key={c.id} className="py-4 px-2">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{c.id}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full border border-white/10 bg-muted/50">{c.type}</span>
                    </div>
                    <div className="font-medium text-sm mt-1">{c.title}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">Root cause: {c.root_cause}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">Owner: {c.owner} · Due: {c.due}</div>
                  </div>
                  <StatusBadge status={c.status} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
