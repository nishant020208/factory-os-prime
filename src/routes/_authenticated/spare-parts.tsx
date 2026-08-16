import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Boxes, Plus, Loader2, Wrench, AlertTriangle, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/spare-parts")({
  head: () => ({
    meta: [
      { title: "Spare Parts — FactoryOS AI" },
      { name: "description", content: "Spare parts inventory tied to machines." },
    ],
  }),
  component: SparePartsPage,
});

function SparePartsPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [showForm, setShowForm] = useState(false);
  const [showUse, setShowUse] = useState<any | null>(null);
  const [useQty, setUseQty] = useState("1");
  const [form, setForm] = useState({ name: "", part_code: "", quantity: "0", reorder_threshold: "5", unit_cost: "0" });

  const { data: parts } = useQuery({
    queryKey: ["sp-parts", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("spare_parts")
          .select("*")
          .eq("company_id", companyId!)
          .order("name")
      ).data ?? [],
    enabled: !!companyId,
  });

  const lowStock = (parts ?? []).filter(
    (p: any) => Number(p.quantity ?? 0) <= Number(p.reorder_threshold ?? 0),
  ).length;
  const totalQty = (parts ?? []).reduce((s: number, p: any) => s + Number(p.quantity ?? 0), 0);
  const totalValue = (parts ?? []).reduce(
    (s: number, p: any) => s + Number(p.quantity ?? 0) * Number(p.unit_cost ?? 0),
    0,
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!form.name.trim()) throw new Error("Name required");
      const { error } = await supabase.from("spare_parts").insert({
        company_id: companyId,
        name: form.name.trim(),
        part_code: form.part_code.trim() || null,
        quantity: parseInt(form.quantity) || 0,
        reorder_threshold: parseInt(form.reorder_threshold) || 0,
        unit_cost: parseFloat(form.unit_cost) || 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spare part added");
      setShowForm(false);
      setForm({ name: "", part_code: "", quantity: "0", reorder_threshold: "5", unit_cost: "0" });
      queryClient.invalidateQueries({ queryKey: ["sp-parts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const logUseMutation = useMutation({
    mutationFn: async () => {
      if (!showUse || !user) throw new Error("No part selected");
      const qty = parseInt(useQty) || 1;
      if (qty <= 0) throw new Error("Quantity must be positive");
      const remaining = Math.max(0, Number(showUse.quantity ?? 0) - qty);
      const { error } = await supabase
        .from("spare_parts")
        .update({ quantity: remaining, updated_at: new Date().toISOString() })
        .eq("id", showUse.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Usage logged — quantity deducted");
      setShowUse(null);
      setUseQty("1");
      queryClient.invalidateQueries({ queryKey: ["sp-parts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("spare_parts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Spare part removed");
      queryClient.invalidateQueries({ queryKey: ["sp-parts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Maintenance"
        title="Spare Parts"
        sub="Spare parts inventory for machine repairs — belts, blades, motors."
        actions={
          !isAuditor ? (
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1.5" />
              Add Part
            </Button>
          ) : null
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Parts" value={String(parts?.length ?? 0)} icon={Boxes} tone="primary" />
        <Kpi label="Total Qty" value={String(totalQty)} icon={Wrench} tone="info" />
        <Kpi label="Low Stock" value={String(lowStock)} icon={AlertTriangle} tone="destructive" />
        <Kpi label="Stock Value" value={fmtMoney(totalValue)} icon={Boxes} tone="success" />
      </div>

      <div className="mt-4">
        <Panel title={`${(parts ?? []).length} Spare Parts`}>
          {(parts ?? []).length === 0 ? (
            <EmptyState title="No spare parts" sub="Add spare parts used in machine repairs." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Part", "Code", "Qty", "Reorder At", "Unit Cost", "Status", ""].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(parts ?? []).map((p: any) => {
                    const low = Number(p.quantity ?? 0) <= Number(p.reorder_threshold ?? 0);
                    return (
                      <tr key={p.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2.5 px-2 font-medium">{p.name}</td>
                        <td className="py-2.5 px-2 font-mono text-xs text-muted-foreground">{p.part_code ?? "—"}</td>
                        <td className="py-2.5 px-2 tabular-nums">{p.quantity}</td>
                        <td className="py-2.5 px-2 tabular-nums text-muted-foreground">{p.reorder_threshold}</td>
                        <td className="py-2.5 px-2 font-mono text-xs">${Number(p.unit_cost ?? 0).toLocaleString()}</td>
                        <td className="py-2.5 px-2">
                          {low ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-destructive">
                              <AlertTriangle className="h-3 w-3" /> Low stock
                            </span>
                          ) : (
                            <span className="text-[10px] text-success">In stock</span>
                          )}
                        </td>
                        <td className="py-2.5 px-2">
                          {!isAuditor && (
                            <div className="flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs"
                                onClick={() => {
                                  setShowUse(p);
                                  setUseQty("1");
                                }}
                              >
                                <Wrench className="h-3 w-3 mr-1" />
                                Log Usage
                              </Button>
                              <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive" onClick={() => deleteMutation.mutate(p.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Add part dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add Spare Part</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Drive belt 3m" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Part Code</Label>
                <Input value={form.part_code} onChange={(e) => setForm((f) => ({ ...f, part_code: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Unit Cost ($)</Label>
                <Input type="number" value={form.unit_cost} onChange={(e) => setForm((f) => ({ ...f, unit_cost: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <Input type="number" value={form.quantity} onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Reorder Threshold</Label>
                <Input type="number" value={form.reorder_threshold} onChange={(e) => setForm((f) => ({ ...f, reorder_threshold: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Part
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log usage dialog */}
      <Dialog open={!!showUse} onOpenChange={(o) => !o && setShowUse(null)}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle>Log Spare Part Usage</DialogTitle>
          </DialogHeader>
          {showUse && (
            <div className="space-y-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{showUse.name}</span> · In stock: {showUse.quantity}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quantity Used</Label>
                <Input type="number" value={useQty} onChange={(e) => setUseQty(e.target.value)} min="1" max={showUse.quantity} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowUse(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => logUseMutation.mutate()}
              disabled={logUseMutation.isPending || !useQty || parseInt(useQty) <= 0}
            >
              {logUseMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Log Usage
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
