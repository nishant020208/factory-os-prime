import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { notifyBatchFailed, notifyQualityPassed } from "@/lib/notifications";
import { toast } from "sonner";
import { useState } from "react";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/final-inspection")({
  head: () => ({
    meta: [
      { title: "Final Inspection — FactoryOS AI" },
      { name: "description", content: "Final product quality inspection before dispatch." },
    ],
  }),
  component: FinalInspectionPage,
});

const CHECKLIST = [
  "Joinery / structural integrity",
  "Wood grain & finish quality",
  "Polish / lacquer evenness",
  "Fabric stitching (if upholstered)",
  "Hardware alignment (hinges, slides)",
  "Dimensional accuracy",
];

const DEFECT_CATEGORIES = [
  "Surface scratch/dent",
  "Uneven polish/finish",
  "Wobbly joints",
  "Fabric stitching defect",
  "Hardware misalignment",
  "Color mismatch",
];

function FinalInspectionPage() {
  const queryClient = useQueryClient();
  const { companyId, user } = useAuth();
  const [inspectWo, setInspectWo] = useState<any | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [notes, setNotes] = useState("");
  const [defectCategory, setDefectCategory] = useState(DEFECT_CATEGORIES[0]);

  // Batches ready for inspection: work orders at 100% with no final inspection yet
  const { data: queue, isLoading: loadingQueue } = useQuery({
    queryKey: ["fi-queue", companyId],
    queryFn: async () => {
      const { data: wos } = await supabase
        .from("work_orders")
        .select("id, wo_number, operation, status, progress_percent, quantity, department_id, production_order_id, operator_id, assigned_by, created_at")
        .eq("company_id", companyId!)
        .gte("progress_percent", 100)
        .order("created_at", { ascending: false });
      const { data: inspected } = await supabase
        .from("quality_inspections")
        .select("production_order_id, result")
        .eq("company_id", companyId!);
      const inspectedIds = new Set((inspected ?? []).map((i) => i.production_order_id));
      return (wos ?? []).filter((w) => !inspectedIds.has(w.production_order_id));
    },
    enabled: !!companyId,
  });

  const { data: inspections, isLoading: loadingInsp } = useQuery({
    queryKey: ["fi-inspections", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("quality_inspections")
          .select("*")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const total = inspections?.length ?? 0;
  const passed = inspections?.filter((i) => i.result === "pass").length ?? 0;
  const failed = inspections?.filter((i) => i.result === "fail").length ?? 0;
  const yieldRate = total ? Math.round((passed / total) * 1000) / 10 : null;

  const submitInspection = useMutation({
    mutationFn: async () => {
      if (!companyId || !user || !inspectWo) throw new Error("Not authenticated");
      const failCount = CHECKLIST.filter((c) => checks[c] === false).length;
      const result = failCount === 0 ? "pass" : "fail";

      // 1) Record the inspection — the DB trigger auto-creates Finished Goods on pass
      const { data: insp, error: inspErr } = await supabase
        .from("quality_inspections")
        .insert({
          company_id: companyId,
          inspection_number: `FI-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
          inspection_type: "final",
          production_order_id: inspectWo.production_order_id ?? null,
          product_id: null,
          inspector_id: user.id,
          result,
          defects_found: failCount,
          quantity_checked: inspectWo.quantity ?? 1,
          notes: notes || null,
        })
        .select("id")
        .single();
      if (inspErr) throw inspErr;

      if (result === "pass") {
        await notifyQualityPassed(companyId, inspectWo.wo_number ?? "Batch", inspectWo.id);
      } else {
        // 2) Fail → create NCR + CAPA, notify Production Manager + Operator
        // Collect specific failed parameters for the NCR
        const failedParams = CHECKLIST.filter((c) => checks[c] === false).map((c) => ({
          parameter_name: c,
          category: "final_checklist",
          notes: `Checklist item failed: ${c}`,
        }));

        const { data: ncr, error: ncrErr } = await supabase
          .from("ncr")
          .insert({
            company_id: companyId,
            ncr_number: `NCR-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
            work_order_id: inspectWo.id,
            inspection_id: insp.id,
            batch_number: inspectWo.wo_number ?? null,
            defect_category: defectCategory,
            description: notes || `${failCount} checklist item(s) failed: ${failedParams.map((p) => p.parameter_name).join(', ')}`,
            severity: failCount >= 3 ? "high" : "medium",
            status: "open",
            assigned_to: inspectWo.operator_id ?? null,
            created_by: user.id,
            failed_parameters: failedParams,
          })
          .select("id")
          .single();
        if (ncrErr) throw ncrErr;
        const { error: capaErr } = await supabase.from("capa").insert({
          company_id: companyId,
          capa_number: `CAPA-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
          ncr_id: ncr.id,
          corrective_action: `Rework batch ${inspectWo.wo_number ?? ""} for: ${defectCategory}`,
          preventive_action: "Pending root-cause review",
          assigned_to: inspectWo.operator_id ?? null,
          due_date: null,
          status: "open",
          created_by: user.id,
        });
        if (capaErr) throw capaErr;
        await notifyBatchFailed(companyId, inspectWo.wo_number ?? "Batch", notes || defectCategory, inspectWo.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Inspection recorded");
      setInspectWo(null);
      setChecks({});
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="final-inspection" />
      <PageHeader
        eyebrow="Quality"
        title="Final Inspection"
        sub="Last-stop quality gate before products ship — batches arrive automatically once a work order reaches 100%."
        actions={<ModuleCopilot moduleName="final-inspection" />}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Awaiting Inspection" value={String(queue?.length ?? 0)} icon={ClipboardCheck} tone="warning" />
        <Kpi label="Passed" value={String(passed)} icon={CheckCircle2} tone="success" />
        <Kpi label="Failed" value={String(failed)} icon={AlertTriangle} tone="destructive" />
        <Kpi label="First-Pass Yield" value={yieldRate === null ? "—" : `${yieldRate}%`} icon={ShieldCheck} tone="info" />
      </div>

      {/* Inspection dialog */}
      <Dialog open={!!inspectWo} onOpenChange={(o) => !o && setInspectWo(null)}>
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Inspect Work Order {inspectWo?.wo_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-xs text-muted-foreground">
              {inspectWo?.operation} · Qty {Number(inspectWo?.quantity ?? 1).toLocaleString()} · Ready {safeDate(inspectWo?.created_at ?? "")}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">QC Checklist — mark each item</Label>
              {CHECKLIST.map((c) => (
                <div
                  key={c}
                  className="flex items-center justify-between rounded-lg bg-muted/30 border border-white/5 px-3 py-2 text-sm"
                >
                  <span>{c}</span>
                  <div className="flex gap-1.5">
                    <Button
                      size="sm"
                      variant={checks[c] === false ? "outline" : "default"}
                      className={`h-7 text-xs ${checks[c] === true ? "bg-success/20 text-success border-success/30" : ""}`}
                      onClick={() => setChecks((s) => ({ ...s, [c]: true }))}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Pass
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className={`h-7 text-xs ${checks[c] === false ? "bg-destructive/20 text-destructive border-destructive/30" : ""}`}
                      onClick={() => setChecks((s) => ({ ...s, [c]: false }))}
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" /> Fail
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes / defect description</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Inspection notes…" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Defect category (used when failed)</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={defectCategory}
                onChange={(e) => setDefectCategory(e.target.value)}
              >
                {DEFECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInspectWo(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => submitInspection.mutate()}
              disabled={submitInspection.isPending || !inspectWo}
            >
              {submitInspection.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Submit Result
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`${queue?.length ?? 0} Batches Awaiting Inspection`}>
          {loadingQueue ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : (queue ?? []).length === 0 ? (
            <EmptyState title="Queue is clear" sub="Batches appear here when a work order hits 100%." />
          ) : (
            <div className="divide-y divide-white/5">
              {(queue ?? []).map((wo) => (
                <div key={wo.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <div className="font-medium">{wo.wo_number}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {wo.operation} · Qty {Number(wo.quantity ?? 1).toLocaleString()} · {safeDate(wo.created_at)}
                    </div>
                  </div>
                  <Button size="sm" className="h-8 text-xs" onClick={() => setInspectWo(wo)}>
                    <ClipboardCheck className="h-3.5 w-3.5 mr-1" /> Inspect
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={`${total} Inspections Recorded`}>
          {loadingInsp ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : total === 0 ? (
            <EmptyState title="No inspections yet" sub="Completed inspections appear here." />
          ) : (
            <div className="divide-y divide-white/5">
              {(inspections ?? []).map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <div>
                    <span className="font-mono text-xs">{i.inspection_number}</span>
                    <div className="text-[11px] text-muted-foreground">
                      {i.defects_found ?? 0} defects / {Number(i.quantity_checked ?? 0).toLocaleString()} checked ·{" "}
                      {safeDate(i.created_at)}
                    </div>
                  </div>
                  <StatusBadge status={i.result} />
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
