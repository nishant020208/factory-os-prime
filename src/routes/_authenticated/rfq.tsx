import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { FileText, Send, CheckCircle2, Clock, Loader2, Reply } from "lucide-react";
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
import { toast } from "sonner";
import { useState } from "react";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rfq")({
  head: () => ({
    meta: [
      { title: "Request for Quotation — FactoryOS AI" },
      { name: "description", content: "RFQs sent to suppliers and their responses" },
    ],
  }),
  component: RfqPage,
});

function RfqPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isSupplier = roles.includes("supplier_portal");
  const [showNew, setShowNew] = useState(false);
  const [respondTo, setRespondTo] = useState<string | null>(null);
  const [form, setForm] = useState({ material_id: "", quantity: "1", notes: "" });
  const [respForm, setRespForm] = useState({ unit_price: "0", delivery_days: "7", notes: "" });

  const { data: rfqs, isLoading } = useQuery({
    queryKey: ["rfq-list", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("rfqs")
        .select("*, rfq_responses(*, suppliers(name))")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const { data: materials } = useQuery({
    queryKey: ["rfq-materials", companyId],
    queryFn: async () => (await supabase.from("materials").select("id, name, unit")).data ?? [],
    enabled: !!companyId && !isSupplier,
  });

  const { data: suppliers } = useQuery({
    queryKey: ["rfq-suppliers", companyId],
    queryFn: async () =>
      (await supabase.from("suppliers").select("id, name").eq("status", "active")).data ?? [],
    enabled: !!companyId && !isSupplier,
  });

  const sent = rfqs?.filter((r) => r.status === "sent").length ?? 0;
  const responses = rfqs?.reduce((s, r) => s + ((r as any).rfq_responses?.length ?? 0), 0) ?? 0;
  const closed = rfqs?.filter((r) => r.status === "closed").length ?? 0;

  const createRfq = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      if (!form.material_id) throw new Error("Select a material");
      const material = (materials ?? []).find((m: any) => m.id === form.material_id);
      const { error } = await supabase.from("rfqs").insert({
        company_id: companyId,
        rfq_number: `RFQ-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
        title: (material as any)?.name ?? "Material",
        material_id: form.material_id,
        quantity: Number(form.quantity) || 1,
        notes: form.notes || null,
        status: "draft",
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("RFQ created — add suppliers to send it");
      setShowNew(false);
      setForm({ material_id: "", quantity: "1", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const sendRfq = useMutation({
    mutationFn: async ({ rfqId, supplierIds }: { rfqId: string; supplierIds: string[] }) => {
      if (!supplierIds.length) throw new Error("Select at least one supplier");
      const { error } = await supabase
        .from("rfq_responses")
        .insert(supplierIds.map((sid) => ({ rfq_id: rfqId, supplier_id: sid })));
      if (error) throw error;
      const { error: upErr } = await supabase.from("rfqs").update({ status: "sent" }).eq("id", rfqId);
      if (upErr) throw upErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("RFQ sent to suppliers");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const respond = useMutation({
    mutationFn: async ({ rfqId }: { rfqId: string }) => {
      const { data: mySupplier } = await supabase.from("suppliers").select("id").eq("user_id", user!.id).maybeSingle();
      if (!mySupplier?.id) throw new Error("Supplier account not linked");
      const { error } = await supabase.from("rfq_responses").upsert(
        {
          rfq_id: rfqId,
          supplier_id: mySupplier.id,
          unit_price: Number(respForm.unit_price) || 0,
          delivery_days: Number(respForm.delivery_days) || 0,
          notes: respForm.notes || null,
          status: "pending",
        },
        { onConflict: "rfq_id,supplier_id" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("Quote submitted");
      setRespondTo(null);
      setRespForm({ unit_price: "0", delivery_days: "7", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const decide = useMutation({
    mutationFn: async ({ responseId, accept }: { responseId: string; accept: boolean }) => {
      const { error } = await supabase
        .from("rfq_responses")
        .update({ status: accept ? "accepted" : "declined" })
        .eq("id", responseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("Quote decision saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="rfq" />
      <PageHeader
        eyebrow={isSupplier ? "Supplier Portal" : "Procurement"}
        title="Request for Quotation"
        sub={
          isSupplier
            ? "RFQs addressed to your company — submit your best quote."
            : "Send RFQs to multiple suppliers, compare quotes and pick the best before committing to a PO."
        }
        actions={
          !isSupplier ? (
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNew(true)}>
              <FileText className="h-4 w-4 mr-1.5" />
              New RFQ
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total RFQs" value={String(rfqs?.length ?? 0)} icon={FileText} tone="primary" />
        <Kpi label="Sent" value={String(sent)} icon={Send} tone="info" />
        <Kpi label="Supplier Quotes" value={String(responses)} icon={Reply} tone="success" />
      </div>

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New RFQ</DialogTitle>
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
              <Label className="text-xs text-muted-foreground">Quantity *</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes / Specs</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Teak wood, kiln-dried, grade A"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createRfq.mutate()}
              disabled={createRfq.isPending}
            >
              {createRfq.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Create RFQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!respondTo} onOpenChange={(o) => !o && setRespondTo(null)}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Submit Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unit Price ($)</Label>
              <Input
                type="number"
                value={respForm.unit_price}
                onChange={(e) => setRespForm((f) => ({ ...f, unit_price: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Delivery (days)</Label>
              <Input
                type="number"
                value={respForm.delivery_days}
                onChange={(e) => setRespForm((f) => ({ ...f, delivery_days: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Input
                value={respForm.notes}
                onChange={(e) => setRespForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondTo(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => respondTo && respond.mutate({ rfqId: respondTo })}
              disabled={respond.isPending}
            >
              {respond.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Submit Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Panel title={`${rfqs?.length ?? 0} RFQs`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (rfqs ?? []).length === 0 ? (
          <EmptyState title="No RFQs yet" sub="Procurement creates RFQs and sends them to suppliers for quotes." />
        ) : (
          <div className="space-y-3">
            {(rfqs ?? []).map((rfq) => {
              const respList = (rfq as any).rfq_responses ?? [];
              return (
                <div key={rfq.id} className="rounded-xl bg-card/60 border border-white/5 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">{rfq.rfq_number ?? "RFQ"}</span>
                        <span className="text-sm font-medium">{rfq.title ?? "Material"}</span>
                        <span className="text-xs text-muted-foreground">× {Number(rfq.quantity).toLocaleString()}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {rfq.notes ?? "—"} · Raised {safeDate(rfq.created_at)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={rfq.status === "closed" ? "completed" : rfq.status === "sent" ? "active" : "pending"} />
                      {!isSupplier && rfq.status === "draft" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => {
                            const ids = (suppliers ?? []).map((s) => s.id);
                            sendRfq.mutate({ rfqId: rfq.id, supplierIds: ids });
                          }}
                          disabled={sendRfq.isPending}
                        >
                          <Send className="h-3 w-3 mr-1" /> Send to {suppliers?.length ?? 0} suppliers
                        </Button>
                      )}
                      {isSupplier && respList.length === 0 && (
                        <Button size="sm" className="h-7 text-xs" onClick={() => setRespondTo(rfq.id)}>
                          <Reply className="h-3 w-3 mr-1" /> Respond
                        </Button>
                      )}
                    </div>
                  </div>
                  {respList.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {respList.map((r: any) => (
                        <div key={r.id} className="rounded-lg bg-muted/30 border border-white/5 p-2.5 text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{r.suppliers?.name ?? "Supplier"}</span>
                            <StatusBadge status={r.status} />
                          </div>
                          <div className="text-muted-foreground mt-1">
                            ${Number(r.unit_price).toLocaleString()} / unit · {r.delivery_days ?? "—"} days
                          </div>
                          {!isSupplier && r.status === "pending" && (
                            <div className="flex gap-1.5 mt-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] text-success"
                                onClick={() => decide.mutate({ responseId: r.id, accept: true })}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" /> Accept
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-6 text-[10px] text-destructive"
                                onClick={() => decide.mutate({ responseId: r.id, accept: false })}
                              >
                                Decline
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
