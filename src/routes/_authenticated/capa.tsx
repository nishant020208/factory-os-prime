import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  Loader2,
  FileWarning,
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
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/capa")({
  head: () => ({
    meta: [
      { title: "CAPA — FactoryOS AI" },
      { name: "description", content: "Corrective and Preventive Actions tracking and management." },
    ],
  }),
  component: CAPAPage,
});

const DEFECT_CATEGORIES = [
  "Surface scratch/dent",
  "Uneven polish/finish",
  "Wobbly joints",
  "Fabric stitching defect",
  "Hardware misalignment",
  "Color mismatch",
];

function CAPAPage() {
  const queryClient = useQueryClient();
  const { companyId, user } = useAuth();
  const [showNewNcr, setShowNewNcr] = useState(false);
  const [showNewCapa, setShowNewCapa] = useState(false);
  const [closeCapa, setCloseCapa] = useState<string | null>(null);
  const [ncrForm, setNcrForm] = useState({
    batch_number: "",
    defect_category: DEFECT_CATEGORIES[0],
    severity: "medium",
    description: "",
  });
  const [capaForm, setCapaForm] = useState({
    ncr_id: "",
    corrective_action: "",
    preventive_action: "",
    due_date: "",
  });
  const [resolutionId, setResolutionId] = useState("");

  const { data: ncrs, isLoading: loadingNcr } = useQuery({
    queryKey: ["capa-ncrs", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("ncr")
          .select("*")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: capas, isLoading: loadingCapa } = useQuery({
    queryKey: ["capa-list", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("capa")
          .select("*, ncr(ncr_number, defect_category)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  // Passed inspections — the only valid resolution for closing a CAPA
  const { data: passedInspections } = useQuery({
    queryKey: ["capa-passed", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("quality_inspections")
          .select("id, inspection_number")
          .eq("company_id", companyId!)
          .eq("result", "pass")
      ).data ?? [],
    enabled: !!companyId && !!closeCapa,
  });

  const open = ncrs?.filter((n) => n.status === "open").length ?? 0;
  const openCapas = capas?.filter((c) => c.status !== "closed").length ?? 0;
  const closedCapas = capas?.filter((c) => c.status === "closed").length ?? 0;

  const createNcr = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      if (!ncrForm.batch_number.trim()) throw new Error("Batch / work order reference required");
      const { error } = await supabase.from("ncr").insert({
        company_id: companyId,
        ncr_number: `NCR-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
        batch_number: ncrForm.batch_number,
        defect_category: ncrForm.defect_category,
        severity: ncrForm.severity,
        description: ncrForm.description || null,
        status: "open",
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capa-ncrs"] });
      toast.success("NCR raised");
      setShowNewNcr(false);
      setNcrForm({ batch_number: "", defect_category: DEFECT_CATEGORIES[0], severity: "medium", description: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createCapa = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      if (!capaForm.ncr_id) throw new Error("Link this CAPA to an NCR");
      if (!capaForm.corrective_action.trim()) throw new Error("Corrective action is required");
      const { error } = await supabase.from("capa").insert({
        company_id: companyId,
        capa_number: `CAPA-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
        ncr_id: capaForm.ncr_id,
        corrective_action: capaForm.corrective_action,
        preventive_action: capaForm.preventive_action || null,
        due_date: capaForm.due_date || null,
        status: "open",
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("CAPA created and linked to NCR");
      setShowNewCapa(false);
      setCapaForm({ ncr_id: "", corrective_action: "", preventive_action: "", due_date: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateCapa = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      if (status === "closed" && !resolutionId)
        throw new Error("CAPA can only be closed against a passed re-inspection");
      const patch =
        status === "closed"
          ? { status, resolved_inspection_id: resolutionId }
          : { status };
      const { error } = await supabase.from("capa").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capa-list"] });
      toast.success("CAPA updated");
      setCloseCapa(null);
      setResolutionId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const closeNcr = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ncr").update({ status: "closed" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["capa-ncrs"] });
      toast.success("NCR closed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="capa" />
      <PageHeader
        eyebrow="Quality"
        title="NCR & CAPA"
        sub="Non-Conformance Reports and their Corrective & Preventive Actions — every failure is tracked to a real resolution."
        actions={
          <>
            <ModuleCopilot moduleName="capa" />
            <Button variant="outline" onClick={() => setShowNewNcr(true)}>
              <FileWarning className="h-4 w-4 mr-1.5" />
              Raise NCR
            </Button>
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNewCapa(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              New CAPA
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Open NCRs" value={String(open)} icon={AlertTriangle} tone="warning" />
        <Kpi label="Open CAPAs" value={String(openCapas)} icon={Clock} tone="info" />
        <Kpi label="CAPAs Closed" value={String(closedCapas)} icon={CheckCircle2} tone="success" />
        <Kpi label="Total NCRs" value={String(ncrs?.length ?? 0)} icon={ShieldCheck} tone="primary" />
      </div>

      {/* Raise NCR dialog */}
      <Dialog open={showNewNcr} onOpenChange={setShowNewNcr}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Raise Non-Conformance Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Batch / Work Order *</Label>
              <Input
                value={ncrForm.batch_number}
                onChange={(e) => setNcrForm((f) => ({ ...f, batch_number: e.target.value }))}
                placeholder="WO-2026-012"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Defect Category *</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ncrForm.defect_category}
                onChange={(e) => setNcrForm((f) => ({ ...f, defect_category: e.target.value }))}
              >
                {DEFECT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Severity</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={ncrForm.severity}
                onChange={(e) => setNcrForm((f) => ({ ...f, severity: e.target.value }))}
              >
                {["low", "medium", "high", "critical"].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Description</Label>
              <Input
                value={ncrForm.description}
                onChange={(e) => setNcrForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="What went wrong…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewNcr(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createNcr.mutate()}
              disabled={createNcr.isPending}
            >
              {createNcr.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Raise NCR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New CAPA dialog */}
      <Dialog open={showNewCapa} onOpenChange={setShowNewCapa}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>New CAPA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Linked NCR *</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={capaForm.ncr_id}
                onChange={(e) => setCapaForm((f) => ({ ...f, ncr_id: e.target.value }))}
              >
                <option value="">Select NCR…</option>
                {(ncrs ?? []).map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.ncr_number} — {n.defect_category}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Corrective Action *</Label>
              <Input
                value={capaForm.corrective_action}
                onChange={(e) => setCapaForm((f) => ({ ...f, corrective_action: e.target.value }))}
                placeholder="e.g. Resend batch to Finishing for repolish"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Preventive Action</Label>
              <Input
                value={capaForm.preventive_action}
                onChange={(e) => setCapaForm((f) => ({ ...f, preventive_action: e.target.value }))}
                placeholder="e.g. Recheck spray booth calibration"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Due Date</Label>
              <Input
                type="date"
                value={capaForm.due_date}
                onChange={(e) => setCapaForm((f) => ({ ...f, due_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCapa(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createCapa.mutate()}
              disabled={createCapa.isPending}
            >
              {createCapa.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Create CAPA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close CAPA dialog */}
      <Dialog open={!!closeCapa} onOpenChange={(o) => !o && setCloseCapa(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Close CAPA</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="text-xs text-muted-foreground">
              A CAPA can only be closed against a <b>passed re-inspection</b> — select the inspection that proved the
              rework succeeded.
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Passed Re-Inspection *</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={resolutionId}
                onChange={(e) => setResolutionId(e.target.value)}
              >
                <option value="">Select passed inspection…</option>
                {(passedInspections ?? []).map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.inspection_number}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseCapa(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => closeCapa && updateCapa.mutate({ id: closeCapa, status: "closed" })}
              disabled={updateCapa.isPending}
            >
              {updateCapa.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Close CAPA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`${ncrs?.length ?? 0} Non-Conformance Reports`}>
          {loadingNcr ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : (ncrs ?? []).length === 0 ? (
            <EmptyState title="No NCRs" sub="Failed inspections raise an NCR automatically." />
          ) : (
            <div className="divide-y divide-white/5">
              {(ncrs ?? []).map((n) => (
                <div key={n.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{n.ncr_number}</span>
                      <StatusBadge status={n.status === "closed" ? "completed" : n.status === "in_rework" ? "in_progress" : "pending"} />
                    </div>
                    <div className="text-sm font-medium mt-1">{n.defect_category}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {n.batch_number ?? "—"} · {n.severity} · {safeDate(n.created_at)}
                    </div>
                    {n.description && (
                      <div className="text-xs text-muted-foreground mt-1 italic">"{n.description}"</div>
                    )}
                  </div>
                  {n.status !== "closed" && (
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => closeNcr.mutate(n.id)}>
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Close
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={`${capas?.length ?? 0} CAPA Register`}>
          {loadingCapa ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
            </div>
          ) : (capas ?? []).length === 0 ? (
            <EmptyState title="No CAPAs" sub="Create one linked to an NCR to start tracking corrective actions." />
          ) : (
            <div className="divide-y divide-white/5">
              {(capas ?? []).map((c) => {
                const ncrLink = c.ncr as unknown as { ncr_number?: string; defect_category?: string } | null;
                return (
                  <div key={c.id} className="flex items-start justify-between gap-3 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{c.capa_number}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full border border-white/10 bg-muted/50">
                          {ncrLink?.ncr_number ?? "No NCR"}
                        </span>
                      </div>
                      <div className="text-sm font-medium mt-1">{c.corrective_action}</div>
                      {c.preventive_action && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          Preventive: {c.preventive_action}
                        </div>
                      )}
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {ncrLink?.defect_category ?? "—"} ·{" "}
                        {c.due_date ? `Due ${new Date(c.due_date).toLocaleDateString()}` : "No due date"} ·{" "}
                        {safeDate(c.created_at)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <StatusBadge status={c.status} />
                      {c.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-6 text-[10px]"
                          onClick={() => updateCapa.mutate({ id: c.id, status: "in_progress" })}
                        >
                          Start
                        </Button>
                      )}
                      {c.status === "in_progress" && (
                        <Button size="sm" className="h-6 text-[10px]" onClick={() => setCloseCapa(c.id)}>
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
