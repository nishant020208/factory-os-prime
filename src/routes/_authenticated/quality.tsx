import { createFileRoute } from "@tanstack/react-router";
import { ModuleStatusBar } from "@/components/module-status";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, AlertOctagon, ClipboardCheck, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/quality")({
  head: () => ({ meta: [
    { title: "Quality — FactoryOS AI" },
    { name: "description", content: "Incoming, in-process and final quality inspection with NCR and CAPA." },
  ]}),
  component: QualityPage,
});

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
    onSuccess: () => { toast.success("Inspection created"); setShowNew(false); queryClient.invalidateQueries({ queryKey: ["q-inspections"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  // Real quality inspections — scoped by RLS to this company only.
  const { data: inspections } = useQuery({
    queryKey: ["q-inspections"],
    queryFn: async () =>
      (await supabase.from("quality_inspections")
        .select("*")
        .order("created_at", { ascending: false })).data ?? [],
  });

  const { data: prodOrders } = useQuery({
    queryKey: ["q-prod"],
    queryFn: async () => (await supabase.from("production_orders").select("status")).data ?? [],
  });

  const inProgress = prodOrders?.filter((p: any) => p.status === "in_progress").length ?? 0;

  // Real KPIs computed from the live inspections.
  const stats = useMemo(() => {
    const rows = inspections ?? [];
    const total = rows.length;
    const passed = rows.filter(r => r.result === "pass").length;
    const failed = rows.filter(r => r.result === "fail").length;
    const totalChecked = rows.reduce((s, r) => s + Number(r.quantity_checked ?? 0), 0);
    const totalDefects = rows.reduce((s, r) => s + Number(r.defects_found ?? 0), 0);
    return {
      firstPassYield: total ? (passed / total) * 100 : null,
      defectRate: totalChecked ? (totalDefects / totalChecked) * 100 : null,
      openNCRs: rows.filter(r => r.result === "pending" || r.result === "fail").length,
      failed,
      total,
    };
  }, [inspections]);

  // Real weekly trend — last 12 weeks bucketed from inspection created_at.
  const trend = useMemo(() => {
    const rows = inspections ?? [];
    const weeks: { w: string; yield: number }[] = [];
    const now = Date.now();
    for (let i = 11; i >= 0; i--) {
      const start = now - (i + 1) * 7 * 86400000;
      const end = now - i * 7 * 86400000;
      const inWeek = rows.filter(r => {
        const t = new Date(r.created_at).getTime();
        return t >= start && t < end;
      });
      const pass = inWeek.filter(r => r.result === "pass").length;
      weeks.push({
        w: `W${12 - i}`,
        yield: inWeek.length ? Math.round((pass / inWeek.length) * 1000) / 10 : 100,
      });
    }
    return weeks;
  }, [inspections]);

  const fmt = (v: number | null, suffix = "%") => (v === null ? "—" : `${v.toFixed(1)}${suffix}`);

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="quality" />
      <PageHeader
        eyebrow="Quality"
        title="Quality Management"
        sub="Inspections, non-conformance reports and CAPA workflows."
        actions={
          <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNew(true)}>
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
        <Kpi label="First-Pass Yield" value={fmt(stats.firstPassYield)} icon={ShieldCheck} tone="success" />
        <Kpi label="Defect Rate" value={fmt(stats.defectRate)} icon={AlertOctagon} tone="warning" />
        <Kpi label="Open NCRs" value={String(stats.openNCRs)} icon={ClipboardCheck} tone="info" />
        <Kpi label="Orders in QC" value={String(inProgress)} icon={ShieldCheck} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Yield · last 12 weeks">
            {(inspections ?? []).length === 0 ? (
              <EmptyState title="No inspections yet" sub="Record your first inspection to see yield trends." />
            ) : (
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
                    <YAxis domain={[0, 100]} stroke="rgba(255,255,255,0.4)" fontSize={10} />
                    <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                    <Area type="monotone" dataKey="yield" stroke="oklch(0.72 0.19 145)" fill="url(#qy)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Panel>
        </div>
        <Panel title="Inspection Summary" right={<span className="text-[10px] text-primary">{stats.total} total</span>}>
          <div className="space-y-3">
            {(inspections ?? []).length === 0 ? (
              <EmptyState title="No data yet" sub="Inspections recorded here will summarize automatically." />
            ) : (
              <>
                {[
                  { t: "Passed inspections", c: inspections?.filter(r => r.result === "pass").length ?? 0 },
                  { t: "Failed inspections", c: stats.failed },
                  { t: "Pending review", c: inspections?.filter(r => r.result === "pending").length ?? 0 },
                ].map((r, i) => (
                  <div key={i} className="rounded-xl bg-card/60 border border-white/5 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{r.t}</span>
                      <span className="font-semibold tabular-nums">{r.c}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Inspections">
          {(inspections ?? []).length === 0 ? (
            <EmptyState title="No inspections yet" sub="New inspections appear here, scoped to your company only." />
          ) : (
            <div className="divide-y divide-white/5">
              {(inspections ?? []).map((n: any) => (
                <div key={n.id} className="grid grid-cols-1 sm:grid-cols-[auto_1fr_auto_auto_auto] items-center gap-2 sm:gap-3 py-3 text-sm">
                  <div className="font-mono text-xs">{n.inspection_number}</div>
                  <div>
                    <div className="capitalize">{String(n.inspection_type).replace(/_/g, " ")}</div>
                    <div className="text-[11px] text-muted-foreground">{n.defects_found ?? 0} defects / {n.quantity_checked ?? 0} checked · {safeDate(n.created_at)}</div>
                  </div>
                  <StatusBadge status={n.result} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
