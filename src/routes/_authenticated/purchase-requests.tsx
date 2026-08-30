import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, ShoppingCart, CheckCircle2, Clock, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar } from "@/components/module-status";
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
import { notifyInsufficientStock } from "@/lib/notifications";
import { toast } from "sonner";
import { useState } from "react";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/purchase-requests")({
  head: () => ({
    meta: [
      { title: "Purchase Requests — FactoryOS AI" },
      { name: "description", content: "Internal requests to procurement" },
    ],
  }),
  component: PurchaseRequestsPage,
});

function PurchaseRequestsPage() {
  const queryClient = useQueryClient();
  const { companyId, user } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [showConvert, setShowConvert] = useState<string | null>(null);
  const [form, setForm] = useState({ material_id: "", quantity: "1", notes: "" });
  const [poForm, setPoForm] = useState({ supplier_id: "", total_amount: "0", expected_date: "" });

  const { data: requisitions, isLoading } = useQuery({
    queryKey: ["pr-list", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_requisitions")
        .select("*, materials(name)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: materials } = useQuery({
    queryKey: ["pr-materials", companyId],
    queryFn: async () => (await supabase.from("materials").select("id, name, unit")).data ?? [],
    enabled: !!companyId,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["pr-suppliers", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("suppliers")
          .select("id, name")
          .eq("status", "active")
          .not("user_id", "is", null)  // Only suppliers with linked portal accounts
      ).data ?? [],
    enabled: !!companyId,
  });

  const pending = requisitions?.filter((r) => r.status === "pending").length ?? 0;
  const converted = requisitions?.filter((r) => r.status === "converted").length ?? 0;

  const createReq = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      if (!form.material_id) throw new Error("Select a material");
      const { error } = await supabase.from("purchase_requisitions").insert({
        company_id: companyId,
        pr_number: `PR-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
        material_id: form.material_id,
        quantity: Number(form.quantity) || 1,
        status: "pending",
        notes: form.notes || null,
        created_by: user.id,
      });
      if (error) throw error;
      const material = (materials ?? []).find((m: any) => m.id === form.material_id);
      await notifyInsufficientStock(companyId, (material as any)?.name ?? "Material", "PR");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pr-list"] });
      toast.success("Purchase requisition created");
      setShowNew(false);
      setForm({ material_id: "", quantity: "1", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertToPO = useMutation({
    mutationFn: async () => {
      if (!showConvert) throw new Error("Missing requisition");
      if (!poForm.supplier_id) throw new Error("Select a supplier");
      const req = (requisitions ?? []).find((r) => r.id === showConvert) as any;
      const { data: po, error: poErr } = await supabase
        .from("purchase_orders")
        .insert({
          company_id: companyId!,
          po_number: `PO-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
          supplier_id: poForm.supplier_id,
          requisition_id: showConvert,
          status: "sent",
          total_amount: Number(poForm.total_amount) || 0,
          expected_date: poForm.expected_date || null,
          created_by: user!.id,
        })
        .select("id")
        .single();
      if (poErr) throw poErr;
      const { error: upErr } = await supabase
        .from("purchase_requisitions")
        .update({ status: "converted" })
        .eq("id", showConvert);
      if (upErr) throw upErr;
      return { poId: po.id, number: req?.pr_number ?? "PR" };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries();
      toast.success(`Requisition ${r.number} converted to a PO`);
      setShowConvert(null);
      setPoForm({ supplier_id: "", total_amount: "0", expected_date: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="purchase-requests" />
      <PageHeader
        eyebrow="Procurement"
        title="Purchase Requisitions"
        sub="Internal requests for materials — raised by low-stock triggers or manually, then converted into Purchase Orders."
        actions={
          <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNew(true)}>
            <FilePlus2 className="h-4 w-4 mr-1.5" />
            New Requisition
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total Requisitions" value={String(requisitions?.length ?? 0)} icon={FilePlus2} tone="primary" />
        <Kpi label="Pending" value={String(pending)} icon={Clock} tone="warning" />
        <Kpi label="Converted to PO" value={String(converted)} icon={CheckCircle2} tone="success" />
      </div>

      {/* New requisition dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New Purchase Requisition</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Material *</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.material_id}
                onChange={(e) => setForm((f) => ({ ...f, material_id: e.target.value }))}
              >
                <option value="">Select material…</option>
                {(materials ?? []).map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit ?? "unit"})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantity Needed *</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Triggered by low stock alert"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createReq.mutate()}
              disabled={createReq.isPending}
            >
              {createReq.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Create Requisition
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to PO dialog */}
      <Dialog open={!!showConvert} onOpenChange={(o) => !o && setShowConvert(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Convert to Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Supplier *</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={poForm.supplier_id}
                onChange={(e) => setPoForm((f) => ({ ...f, supplier_id: e.target.value }))}
              >
                <option value="">Select supplier…</option>
                {(suppliers ?? []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Total Amount ($)</Label>
              <Input
                type="number"
                value={poForm.total_amount}
                onChange={(e) => setPoForm((f) => ({ ...f, total_amount: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expected Delivery</Label>
              <Input
                type="date"
                value={poForm.expected_date}
                onChange={(e) => setPoForm((f) => ({ ...f, expected_date: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConvert(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => convertToPO.mutate()}
              disabled={convertToPO.isPending}
            >
              {convertToPO.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Create PO
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Panel title={`${requisitions?.length ?? 0} Requisitions`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (requisitions ?? []).length === 0 ? (
          <EmptyState title="No requisitions yet" sub="Create one, or let a low-stock alert raise it automatically." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["PR #", "Material", "Qty Needed", "Notes", "Raised", "Status", "Action"].map((h) => (
                    <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(requisitions ?? []).map((r) => (
                  <TableRow key={r.id} className="border-white/5">
                    <TableCell className="font-mono text-xs font-medium">{r.pr_number}</TableCell>
                    <TableCell className="text-sm">{(r as any).materials?.name ?? "—"}</TableCell>
                    <TableCell className="tabular-nums">{Number(r.quantity).toLocaleString()}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                      {r.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{safeDate(r.created_at)}</TableCell>
                    <TableCell>
                      <StatusBadge status={r.status === "converted" ? "completed" : "pending"} />
                    </TableCell>
                    <TableCell>
                      {r.status !== "converted" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setShowConvert(r.id)}
                        >
                          <ArrowRight className="h-3 w-3 mr-1" />
                          Convert to PO
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">Converted</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
