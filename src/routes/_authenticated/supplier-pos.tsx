import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, CheckCircle2, XCircle, Send, Eye, Truck, FileText, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/supplier-pos")({
  head: () => ({ meta: [
    { title: "Purchase Orders — FactoryOS AI" },
    { name: "description", content: "POs you have received from the buyer" },
  ]}),
  component: SupplierPosPage,
});

// Supplier portal: ONLY receive, accept/reject/modify POs — NEVER create them
function SupplierPosPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [respondDialog, setRespondDialog] = useState<{ open: boolean; poId: string; action: "accept" | "reject" | "modify" }>({ open: false, poId: "", action: "accept" });
  const [respondNotes, setRespondNotes] = useState("");
  const [updatingPo, setUpdatingPo] = useState<string | null>(null);

  const { data } = useQuery({
    queryKey: ["supplier-pos", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: shipments } = useQuery({
    queryKey: ["supplier-shipments", companyId],
    queryFn: async () => (await supabase.from("shipments").select("*").order("created_at", { ascending: false })).data ?? [],
  });

  const respondMutation = useMutation({
    mutationFn: async ({ poId, action, notes }: { poId: string; action: string; notes: string }) => {
      setUpdatingPo(poId);
      const newStatus = action === "accept" ? "in_progress" : action === "reject" ? "cancelled" : "modification_requested";
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: newStatus })
        .eq("id", poId);
      if (error) throw error;

      // Log the action
      await supabase.from("audit_logs").insert({
        company_id: companyId,
        action: `po_${action}`,
        entity: "purchase_orders",
        entity_id: poId,
        metadata: { notes },
      } as any);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      toast.success("Response recorded");
      setRespondDialog({ open: false, poId: "", action: "accept" });
      setRespondNotes("");
      setUpdatingPo(null);
    },
    onError: (err: any) => { toast.error(err.message); setUpdatingPo(null); },
  });

  const updateShipmentMutation = useMutation({
    mutationFn: async ({ poId, tracking, carrier, shippedDate }: { poId: string; tracking: string; carrier: string; shippedDate: string }) => {
      // Check if shipment exists for this PO
      const existing = shipments?.find((s: any) => s.sales_order_id === poId);
      if (existing) {
        const { error } = await supabase.from("shipments").update({
          tracking_number: tracking,
          carrier,
          shipped_date: shippedDate || null,
          status: "in_transit",
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shipments").insert({
          company_id: companyId!,
          shipment_number: `SHIP-${Date.now().toString().slice(-6)}`,
          carrier,
          tracking_number: tracking,
          status: "in_transit",
          shipped_date: shippedDate || null,
        });
        if (error) throw error;
      }
      toast.success("Shipment details updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalOpen = data?.filter(p => p.status === "sent" || p.status === "pending").length ?? 0;
  const totalAccepted = data?.filter(p => p.status === "in_progress").length ?? 0;
  const totalFulfilled = data?.filter(p => p.status === "received").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="supplier-pos" />
      <PageHeader
        eyebrow="Supplier Portal"
        title="Purchase Orders"
        sub="POs received. You can Accept, Reject, or Request Modification — but you cannot create POs."
        actions={<ModuleCopilot moduleName="supplier-pos" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Open / Pending" value={String(totalOpen)} icon={ShoppingCart} tone="primary" />
        <Kpi label="Accepted" value={String(totalAccepted)} icon={CheckCircle2} tone="success" />
        <Kpi label="Fulfilled" value={String(totalFulfilled)} icon={Truck} tone="info" />
        <Kpi label="Total POs" value={String(data?.length ?? 0)} icon={FileText} tone="primary" />
      </div>

      <Panel title={`${data?.length ?? 0} Purchase Orders — Respond Only`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {["PO #", "Amount", "Expected", "Status", "Actions"].map(h => (
                  <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">{h}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((po) => (
                <TableRow key={po.id} className="border-white/5">
                  <TableCell className="font-medium">{po.po_number ?? po.id.slice(0, 8)}</TableCell>
                  <TableCell className="font-mono text-xs">${Number(po.total_amount ?? 0).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "—"}
                  </TableCell>
                  <TableCell><StatusBadge status={po.status} /></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {(po.status === "sent" || po.status === "pending") && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-success"
                            onClick={() => setRespondDialog({ open: true, poId: po.id, action: "accept" })}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" />Accept
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive"
                            onClick={() => setRespondDialog({ open: true, poId: po.id, action: "reject" })}
                          >
                            <XCircle className="h-3 w-3 mr-1" />Reject
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-warning"
                            onClick={() => setRespondDialog({ open: true, poId: po.id, action: "modify" })}
                          >
                            <MessageSquare className="h-3 w-3 mr-1" />Modify
                          </Button>
                        </>
                      )}
                      {po.status === "in_progress" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-info"
                          onClick={() => {
                            const tracking = prompt("Enter tracking number:");
                            if (tracking) updateShipmentMutation.mutate({ poId: po.id, tracking, carrier: "Default", shippedDate: new Date().toISOString() });
                          }}
                        >
                          <Truck className="h-3 w-3 mr-1" />Update Shipment
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No purchase orders yet. When a buyer sends you a PO, it will appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* Respond Dialog */}
      <Dialog open={respondDialog.open} onOpenChange={(o) => setRespondDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {respondDialog.action === "accept" ? "Accept PO" : respondDialog.action === "reject" ? "Reject PO" : "Request Modification"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">
              {respondDialog.action === "accept" ? "Add any notes (optional)" : "Please provide a reason *"}
            </Label>
            <Textarea
              value={respondNotes}
              onChange={(e) => setRespondNotes(e.target.value)}
              placeholder={
                respondDialog.action === "accept" ? "Confirming acceptance..." :
                respondDialog.action === "reject" ? "Explain why you're rejecting..." :
                "Describe what needs to change..."
              }
              rows={3}
            />
            {respondDialog.action === "modify" && (
              <div className="text-xs text-muted-foreground">
                Your modification request will be sent back to the buyer for review.
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRespondDialog(d => ({ ...d, open: false }))}>Cancel</Button>
            <Button
              className={
                respondDialog.action === "accept" ? "bg-success" :
                respondDialog.action === "reject" ? "bg-destructive" : "bg-warning"
              }
              onClick={() => respondMutation.mutate({ poId: respondDialog.poId, action: respondDialog.action, notes: respondNotes })}
              disabled={updatingPo === respondDialog.poId}
            >
              {respondDialog.action === "accept" ? "Accept PO" : respondDialog.action === "reject" ? "Reject PO" : "Request Modification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
