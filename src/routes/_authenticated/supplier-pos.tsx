import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Truck,
  FileText,
  MessageSquare,
  QrCode,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { fmtMoney } from "@/lib/currency";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { useSupplier } from "@/hooks/use-supplier";
import { toast } from "sonner";
import { useState } from "react";
import {
  notifySupplierPOResponse,
  notifySupplierShipped,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/supplier-pos")({
  head: () => ({
    meta: [
      { title: "Purchase Orders — FactoryOS AI" },
      { name: "description", content: "POs you have received from the buyer" },
    ],
  }),
  component: SupplierPosPage,
});

// Supplier portal: ONLY receive, accept/reject/modify POs — NEVER create them
function SupplierPosPage() {
  const queryClient = useQueryClient();
  const { companyId, roles, user } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [respondDialog, setRespondDialog] = useState<{
    open: boolean;
    poId: string;
    action: "accept" | "reject" | "modify";
  }>({ open: false, poId: "", action: "accept" });
  const [respondNotes, setRespondNotes] = useState("");
  const [updatingPo, setUpdatingPo] = useState<string | null>(null);

  // Dispatch dialog — shown once a PO is accepted
  const [dispatchDialog, setDispatchDialog] = useState<{
    open: boolean;
    poId: string;
    poNumber: string;
  }>({ open: false, poId: "", poNumber: "" });
  const [dispatchForm, setDispatchForm] = useState({
    dispatch_date: "",
    carrier: "",
    vehicle_number: "",
    expected_arrival: "",
    tracking_number: "",
  });
  const [dispatching, setDispatching] = useState(false);

  const { mySupplier } = useSupplier();
  const supplierId = mySupplier?.id ?? null;

  const { data } = useQuery({
    queryKey: ["supplier-pos", companyId, supplierId],
    queryFn: async () => {
      if (!supplierId) return [];
      const { data } = await supabase
        .from("purchase_orders")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!supplierId,
  });

  const { data: deliveries } = useQuery({
    queryKey: ["supplier-deliveries", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_deliveries")
          .select("*")
          .eq("supplier_id", supplierId ?? "")
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!supplierId,
  });

  const respondMutation = useMutation({
    mutationFn: async ({
      poId,
      action,
      notes,
    }: {
      poId: string;
      action: "accept" | "reject" | "modify";
      notes: string;
    }) => {
      setUpdatingPo(poId);
      const po = data?.find((p) => p.id === poId);
      const newStatus =
        action === "accept"
          ? "accepted"
          : action === "reject"
            ? "rejected"
            : "modification_requested";
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: newStatus, supplier_note: notes || null })
        .eq("id", poId)
        .eq("supplier_id", supplierId ?? "");
      if (error) throw error;

      // Notify the Procurement Manager who created it (targeted, never broadcast)
      const createdBy = (po as any)?.created_by ?? null;
      await notifySupplierPOResponse(
        companyId ?? "",
        (po as any)?.po_number ?? "PO",
        mySupplier?.name ?? "Supplier",
        action,
        poId,
        createdBy,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      toast.success("Response recorded — buyer has been notified");
      setRespondDialog({ open: false, poId: "", action: "accept" });
      setRespondNotes("");
      setUpdatingPo(null);
    },
    onError: (err: any) => {
      toast.error(err.message);
      setUpdatingPo(null);
    },
  });

  const dispatchMutation = useMutation({
    mutationFn: async ({
      poId,
      form,
    }: {
      poId: string;
      form: typeof dispatchForm;
    }) => {
      setDispatching(true);
      const po = data?.find((p) => p.id === poId);
      if (!po) throw new Error("PO not found");

      // 1) Insert inbound delivery record
      const { error: delErr } = await supabase.from("supplier_deliveries").insert({
        company_id: companyId!,
        po_id: poId,
        supplier_id: supplierId ?? null,
        dispatch_date: form.dispatch_date || null,
        carrier: form.carrier || null,
        vehicle_number: form.vehicle_number || null,
        expected_arrival: form.expected_arrival || null,
        tracking_number: form.tracking_number || null,
        status: "dispatched",
      });
      if (delErr) throw delErr;

      // 2) Mark PO as dispatched
      const { error: poErr } = await supabase
        .from("purchase_orders")
        .update({ status: "dispatched", carrier: form.carrier || null, tracking_number: form.tracking_number || null })
        .eq("id", poId)
        .eq("supplier_id", supplierId ?? "");
      if (poErr) throw poErr;

      // 3) Auto-generate the Shipment-Inbound QR (token → URL)
      const { data: qr, error: qrErr } = await supabase
        .from("qr_codes")
        .insert({
          company_id: companyId!,
          entity_type: "purchase_order",
          entity_id: poId,
          type: "inbound_shipment",
          status: "active",
          qr_data: poId,
          label: (po as any).po_number ?? "PO",
          sub_label: `Inbound: ${form.carrier ?? "Carrier"} · ${form.tracking_number ?? "—"}`,
        })
        .select("token")
        .single();
      if (qrErr) throw qrErr;

      const scanUrl = `${window.location.origin}/scan?t=${qr.token}`;

      // 4) Notify Procurement (creator) + Warehouse
      const createdBy = (po as any)?.created_by ?? null;
      await notifySupplierShipped(
        companyId ?? "",
        (po as any)?.po_number ?? "PO",
        mySupplier?.name ?? "Supplier",
        poId,
        createdBy,
        scanUrl,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-deliveries"] });
      toast.success("Shipment dispatched — inbound QR generated");
      setDispatchDialog({ open: false, poId: "", poNumber: "" });
      setDispatchForm({
        dispatch_date: "",
        carrier: "",
        vehicle_number: "",
        expected_arrival: "",
        tracking_number: "",
      });
      setDispatching(false);
    },
    onError: (err: any) => {
      toast.error(err.message);
      setDispatching(false);
    },
  });

  const totalOpen = data?.filter((p) => ["sent", "pending"].includes(p.status)).length ?? 0;
  const totalAccepted = data?.filter((p) => ["accepted", "in_progress"].includes(p.status)).length ?? 0;
  const totalDispatched = data?.filter((p) => p.status === "dispatched").length ?? 0;
  const totalFulfilled = data?.filter((p) => p.status === "received").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="supplier-pos" />
      <PageHeader
        eyebrow="Supplier Portal"
        title="Purchase Orders Received"
        sub="POs issued to you. You can Accept, Reject, or Request Modification — you cannot create POs."
        actions={<ModuleCopilot moduleName="supplier-pos" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Awaiting Response" value={String(totalOpen)} icon={ShoppingCart} tone="primary" />
        <Kpi label="Accepted" value={String(totalAccepted)} icon={CheckCircle2} tone="success" />
        <Kpi label="Dispatched" value={String(totalDispatched)} icon={Truck} tone="info" />
        <Kpi label="Received / Fulfilled" value={String(totalFulfilled)} icon={FileText} tone="primary" />
      </div>

      <Panel title={`${data?.length ?? 0} Purchase Orders — Respond Only`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {["PO #", "Amount", "Expected", "Status", "Actions"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data ?? []).map((po) => {
                const canRespond = ["sent", "pending", "modification_requested"].includes(po.status);
                const canDispatch = ["accepted", "in_progress"].includes(po.status);
                return (
                  <TableRow key={po.id} className="border-white/5">
                    <TableCell className="font-medium">{po.po_number ?? po.id.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-xs">
                      {fmtMoney(po.total_amount)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={po.status} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {!isAuditor && canRespond && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-success"
                              onClick={() =>
                                setRespondDialog({ open: true, poId: po.id, action: "accept" })
                              }
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Accept
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-destructive"
                              onClick={() =>
                                setRespondDialog({ open: true, poId: po.id, action: "reject" })
                              }
                            >
                              <XCircle className="h-3 w-3 mr-1" />
                              Reject
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-warning"
                              onClick={() =>
                                setRespondDialog({ open: true, poId: po.id, action: "modify" })
                              }
                            >
                              <MessageSquare className="h-3 w-3 mr-1" />
                              Modify
                            </Button>
                          </>
                        )}
                        {!isAuditor && canDispatch && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-info"
                            onClick={() =>
                              setDispatchDialog({
                                open: true,
                                poId: po.id,
                                poNumber: po.po_number ?? po.id.slice(0, 8),
                              })
                            }
                          >
                            <Truck className="h-3 w-3 mr-1" />
                            Shipment Details
                          </Button>
                        )}
                        {(deliveries ?? []).some((d: any) => d.po_id === po.id) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-emerald-400"
                            onClick={() => {
                              const qr = supabase.from("qr_codes").select("token").eq("entity_id", po.id).eq("type", "inbound_shipment").maybeSingle();
                              qr.then(({ data: d }) => {
                                if (d?.token)
                                  window.open(`${window.location.origin}/scan?t=${d.token}`, "_blank");
                                else toast.info("Inbound QR not found");
                              });
                            }}
                          >
                            <QrCode className="h-3 w-3 mr-1" />
                            View QR
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(data ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-12">
                    No purchase orders yet. When the buyer sends you a PO, it will appear here.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>

      {/* Respond Dialog */}
      <Dialog
        open={respondDialog.open}
        onOpenChange={(o) => setRespondDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>
              {respondDialog.action === "accept"
                ? "Accept PO"
                : respondDialog.action === "reject"
                  ? "Reject PO"
                  : "Request Modification"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">
              {respondDialog.action === "accept"
                ? "Add any notes (optional)"
                : "Please provide a reason *"}
            </Label>
            <Textarea
              value={respondNotes}
              onChange={(e) => setRespondNotes(e.target.value)}
              placeholder={
                respondDialog.action === "accept"
                  ? "Confirming acceptance..."
                  : respondDialog.action === "reject"
                    ? "Explain why you're rejecting..."
                    : "Describe what needs to change..."
              }
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRespondDialog((d) => ({ ...d, open: false }))}
            >
              Cancel
            </Button>
            <Button
              className={
                respondDialog.action === "accept"
                  ? "bg-success"
                  : respondDialog.action === "reject"
                    ? "bg-destructive"
                    : "bg-warning"
              }
              onClick={() =>
                respondMutation.mutate({
                  poId: respondDialog.poId,
                  action: respondDialog.action,
                  notes: respondNotes,
                })
              }
              disabled={updatingPo === respondDialog.poId}
            >
              {updatingPo === respondDialog.poId ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {respondDialog.action === "accept"
                    ? "Accept PO"
                    : respondDialog.action === "reject"
                      ? "Reject PO"
                      : "Request Modification"}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dispatch / Shipment Details Dialog */}
      <Dialog
        open={dispatchDialog.open}
        onOpenChange={(o) => setDispatchDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-primary" />
              Shipment Details — {dispatchDialog.poNumber}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Dispatch Date *</Label>
                <Input
                  type="date"
                  value={dispatchForm.dispatch_date}
                  onChange={(e) =>
                    setDispatchForm((f) => ({ ...f, dispatch_date: e.target.value }))
                  }
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Expected Arrival</Label>
                <Input
                  type="date"
                  value={dispatchForm.expected_arrival}
                  onChange={(e) =>
                    setDispatchForm((f) => ({ ...f, expected_arrival: e.target.value }))
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Courier / Transport Name</Label>
              <Input
                value={dispatchForm.carrier}
                onChange={(e) => setDispatchForm((f) => ({ ...f, carrier: e.target.value }))}
                placeholder="e.g. TransIndia Logistics"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Vehicle Number</Label>
              <Input
                value={dispatchForm.vehicle_number}
                onChange={(e) => setDispatchForm((f) => ({ ...f, vehicle_number: e.target.value }))}
                placeholder="e.g. KL-01-AB-2345"
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tracking Number</Label>
              <Input
                value={dispatchForm.tracking_number}
                onChange={(e) =>
                  setDispatchForm((f) => ({ ...f, tracking_number: e.target.value }))
                }
                placeholder="e.g. TRK-TEAK-002"
                className="h-9 text-xs"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Submitting marks this PO as <strong>Dispatched</strong> and auto-generates the
              Shipment-Inbound QR the warehouse scans to receive the goods.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDispatchDialog((d) => ({ ...d, open: false }))}
            >
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() =>
                dispatchMutation.mutate({ poId: dispatchDialog.poId, form: dispatchForm })
              }
              disabled={
                dispatching ||
                !dispatchForm.dispatch_date ||
                !dispatchForm.carrier.trim() ||
                !dispatchForm.tracking_number.trim()
              }
            >
              {dispatching ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Truck className="h-4 w-4 mr-1" />
              )}
              Mark Dispatched
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
