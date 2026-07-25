import { createFileRoute } from "@tanstack/react-router";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, AlertOctagon, ClipboardCheck, ArrowUpRight, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/quality")({
  head: () => ({ meta: [
    { title: "Quality — FactoryOS AI" },
    { name: "description", content: "Incoming, in-process and final quality inspection with NCR and CAPA." },
  ]}),
  component: QualityPage,
});

const trend = Array.from({ length: 12 }, (_, i) => ({ w: `W${i + 1}`, defects: 12 - Math.round(i / 2) + Math.round(Math.random() * 3), yield: 96 + Math.random() * 3 }));

// Demo NCR data (no quality_records table exists yet — using realistic demo)
const DEMO_NCR = [
  { id: "NCR-2026-014", title: "Dimensional out of spec", product: "SKU-A1004 Servo Motor", severity: "critical", status: "pending", opened: "2d ago" },
  { id: "NCR-2026-013", title: "Surface finish defect", product: "SKU-A1001 Ti Bracket", severity: "high", status: "in_progress", opened: "3d ago" },
  { id: "NCR-2026-012", title: "Weld porosity", product: "SKU-A1002 Al Housing", severity: "high", status: "in_progress", opened: "5d ago" },
  { id: "NCR-2026-011", title: "Solder joint anomaly", product: "SKU-A1005 Control Board", severity: "medium", status: "completed", opened: "1w ago" },
];

function QualityPage() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [formData, setFormData] = useState({ inspection_number: "", inspection_type: "final", defects_found: "0", quantity_checked: "100" });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const { error } = await supabase.from("quality_inspections").insert({
        company_id: companyId,
        inspection_number: formData.inspection_number || `QI-${Date.now()}`,
        inspection_type: formData.inspection_type,
        result: "pending",
        defects_found: Number(formData.defects_found),
        quantity_checked: Number(formData.quantity_checked),
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Inspection created"); setShowNew(false); queryClient.invalidateQueries({ queryKey: ["q-prod"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // We use production data for context
  const { data: machines } = useQuery({
    queryKey: ["q-machines"],
    queryFn: async () => (await supabase.from("machines").select("*")).data ?? [],
  });

  // Use existing production_orders as proxy for quality inspection scope
  const { data: prodOrders } = useQuery({
    queryKey: ["q-prod"],
    queryFn: async () => (await supabase.from("production_orders").select("*")).data ?? [],
  });

  const inProgress = prodOrders?.filter((p: any) => p.status === "in_progress").length ?? 0;

  const openNCRs = DEMO_NCR.filter(n => n.status !== "completed").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Quality"
        title="Quality Management"
        sub="Inspections, non-conformance reports and CAPA workflows."
        actions={
          <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => toast.info("NCR form — coming soon with full CRUD")}>
            <Plus className="h-4 w-4 mr-1.5" />New Inspection
          </Button>
        }
      />
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>New Quality Inspection</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Inspection #</Label><Input value={formData.inspection_number} onChange={e => setFormData(d => ({...d, inspection_number: e.target.value}))} placeholder="QI-2026-009" /></div>
            <div className="space-y-1.5"><Label>Type</Label><Select value={formData.inspection_type} onValueChange={v => setFormData(d => ({...d, inspection_type: v}))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="incoming">Incoming</SelectItem><SelectItem value="in_process">In-Process</SelectItem><SelectItem value="final">Final</SelectItem></SelectContent></Select></div>
            <div className="space-y-1.5"><Label>Quantity Checked</Label><Input type="number" value={formData.quantity_checked} onChange={e => setFormData(d => ({...d, quantity_checked: e.target.value}))} /></div>
            <div className="space-y-1.5"><Label>Defects Found</Label><Input type="number" value={formData.defects_found} onChange={e => setFormData(d => ({...d, defects_found: e.target.value}))} /></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending} className="bg-[image:var(--gradient-primary)]">Create Inspection</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="First-Pass Yield" value="97.8%" delta="+0.4%" icon={ShieldCheck} tone="success" />
        <Kpi label="Defect Rate" value="0.82%" delta="-0.3%" icon={AlertOctagon} tone="warning" />
        <Kpi label="Open NCRs" value={String(openNCRs)} icon={ClipboardCheck} tone="info" />
        <Kpi label="Orders in QC" value={String(inProgress)} icon={ShieldCheck} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Yield & defects · last 12 weeks">
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="qy" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="w" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="yield" stroke="oklch(0.72 0.19 145)" fill="url(#qy)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
        <Panel title="AI Defect Prediction" right={<span className="text-[10px] text-primary">Vision-ready</span>}>
          <div className="space-y-3">
            {[
              { t: "Predicted micro-crack on Ti Bracket batch B-2287", c: 88 },
              { t: "Housing dimensional drift approaching upper limit", c: 76 },
              { t: "Solder joint anomaly on CB-X1 · sample 42", c: 82 },
            ].map((r, i) => (
              <div key={i} className="rounded-xl bg-card/60 border border-white/5 p-3">
                <div className="flex items-center justify-between text-[10px] text-primary"><span>Copilot</span><span>{r.c}% conf.</span></div>
                <div className="mt-1 text-sm">{r.t}</div>
                <button className="mt-2 text-[11px] text-primary flex items-center gap-1 hover:underline">Review <ArrowUpRight className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Non-Conformance Reports">
          <div className="divide-y divide-white/5">
            {DEMO_NCR.map((n) => (
              <div key={n.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto] items-center gap-2 sm:gap-3 py-3 text-sm">
                <div className="font-mono text-xs">{n.id}</div>
                <div>
                  <div>{n.title}</div>
                  <div className="text-[11px] text-muted-foreground">{n.product}</div>
                </div>
                <StatusBadge status={n.severity} />
                <StatusBadge status={n.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
