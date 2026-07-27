import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ClipboardPen, CheckCircle2, DollarSign, QrCode, Percent, Calculator, RefreshCw, ArrowRight, ShoppingCart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { notifyAdvancePaymentQRGenerated } from "@/lib/notifications";
import { getCustomerUserId } from "@/lib/customer-lookup";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/approved-orders")({
  head: () => ({ meta: [
    { title: "Approved Orders — FactoryOS AI" },
    { name: "description", content: "Confirm materials and set advance payment for approved customer orders." },
  ]}),
  component: ApprovedOrdersPage,
});

function ApprovedOrdersPage() {
  const queryClient = useQueryClient();
  const { companyId, user } = useAuth();
  const navigate = useNavigate();
  const [confirmDialog, setConfirmDialog] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });
  const [advancePercent, setAdvancePercent] = useState("20");
  const [materialId, setMaterialId] = useState("");
  const [quantity, setQuantity] = useState("0");
  const [qrDialog, setQrDialog] = useState<{ open: boolean; order: any | null }>({ open: false, order: null });

  const { data: orders } = useQuery({
    queryKey: ["approved-orders", companyId],
    queryFn: async () => (await supabase
      .from("customer_orders")
      .select("*, customers!left(business_name, email)")
      .eq("company_id", companyId)
      .in("status", ["approved", "material_confirmed", "awaiting_advance_payment", "advance_paid"])
      .order("created_at", { ascending: false })
    ).data ?? [],
    enabled: !!companyId,
  });

  const { data: materials } = useQuery({
    queryKey: ["ao-materials", companyId],
    queryFn: async () => (await supabase.from("materials").select("*").eq("company_id", companyId).eq("is_active", true).order("name")).data ?? [],
    enabled: !!companyId,
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user || !confirmDialog.order) throw new Error("Not authenticated");
      const order = confirmDialog.order;
      const orderTotal = Number(order.order_total ?? 0);
      const percent = Number(advancePercent) || 20;
      const advanceAmount = orderTotal * (percent / 100);
      const balanceDue = orderTotal - advanceAmount;

      // Generate QR code data
      const qrData = JSON.stringify({
        type: "advance_payment",
        order: order.order_number,
        amount: advanceAmount,
        company: companyId.slice(0, 8),
      });
      const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(JSON.stringify(qrData))}`;

      const { error } = await supabase
        .from("customer_orders")
        .update({
          material_id: materialId || order.material_id,
          quantity: Number(quantity) || order.quantity,
          advance_payment_percent: percent,
          advance_amount: advanceAmount,
          balance_due: balanceDue,
          advance_qr_url: qrUrl,
          status: "awaiting_advance_payment",
        })
        .eq("id", order.id);
      if (error) throw error;

      // Notify customer using role-targeted helper
      const customerUserId = await getCustomerUserId(order.customer_id);
      await notifyAdvancePaymentQRGenerated(companyId, order.order_number, customerUserId ?? "", advanceAmount);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approved-orders"] });
      toast.success("Material confirmed and advance payment requested");
      setConfirmDialog({ open: false, order: null });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const markAdvancePaid = useMutation({
    mutationFn: async (orderId: string) => {
      const { error } = await supabase
        .from("customer_orders")
        .update({ advance_payment_status: "paid", status: "advance_paid" })
        .eq("id", orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["approved-orders"] });
      toast.success("Advance payment marked as paid — production can start");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pendingConfirm = (orders ?? []).filter((o: any) => o.status === "approved").length;
  const awaitingPayment = (orders ?? []).filter((o: any) => o.status === "awaiting_advance_payment").length;
  const paid = (orders ?? []).filter((o: any) => o.status === "advance_paid").length;
  const totalValue = (orders ?? []).reduce((s: number, o: any) => s + Number(o.order_total ?? 0), 0);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Production"
        title="Approved Orders"
        sub="Confirm materials, set advance payment, and manage approved customer orders."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Pending Confirm" value={String(pendingConfirm)} icon={ClipboardPen} tone="warning" />
        <Kpi label="Awaiting Payment" value={String(awaitingPayment)} icon={DollarSign} tone="info" />
        <Kpi label="Advance Paid" value={String(paid)} icon={CheckCircle2} tone="success" />
        <Kpi label="Total Value" value={`$${(totalValue / 1000).toFixed(0)}k`} icon={ShoppingCart} tone="primary" />
      </div>

      <Panel title={`${orders?.length ?? 0} approved orders`}>
        <div className="divide-y divide-white/5">
          {(orders ?? []).map((o: any) => {
            const total = Number(o.order_total ?? 0);
            const percent = Number(o.advance_payment_percent ?? 20);
            const advance = total * (percent / 100);
            return (
              <div key={o.id} className="grid grid-cols-[1fr_auto_auto_auto] gap-4 py-4 items-center">
                <div>
                  <div className="font-medium">{o.order_number}</div>
                  <div className="text-xs text-muted-foreground">
                    {o.customers?.business_name ?? "—"} · ${total.toFixed(2)}
                  </div>
                  {o.status === "awaiting_advance_payment" && o.advance_qr_url && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs mt-1 text-primary"
                      onClick={() => setQrDialog({ open: true, order: o })}
                    >
                      <QrCode className="h-3 w-3 mr-1" />View QR
                    </Button>
                  )}
                </div>
                <StatusBadge status={o.status} />
                <div className="text-xs text-right">
                  <div>Advance: ${advance.toFixed(0)}</div>
                  <div className="text-muted-foreground">({percent}%)</div>
                </div>
                <div className="flex gap-2">
                  {o.status === "approved" && (
                    <Button size="sm" className="h-8" onClick={() => {
                      setAdvancePercent(String(o.advance_payment_percent ?? 20));
                      setMaterialId(o.material_id || "");
                      setQuantity(String(o.quantity ?? 0));
                      setConfirmDialog({ open: true, order: o });
                    }}>
                      <Calculator className="h-3.5 w-3.5 mr-1" />Confirm
                    </Button>
                  )}
                  {o.status === "awaiting_advance_payment" && (
                    <Button size="sm" variant="outline" className="h-8" onClick={() => markAdvancePaid.mutate(o.id)}>
                      <DollarSign className="h-3.5 w-3.5 mr-1" />Mark Paid
                    </Button>
                  )}
                  {o.status === "advance_paid" && (
                    <span className="text-xs text-success flex items-center gap-1">
                      <CheckCircle2 className="h-4 w-4" />Ready
                    </span>
                  )}
                </div>
              </div>
            );
          })}
          {(orders ?? []).length === 0 && (
            <div className="text-sm text-muted-foreground py-8 text-center">No approved orders to confirm.</div>
          )}
        </div>
      </Panel>

      {/* Confirm Dialog */}
      <Dialog open={confirmDialog.open} onOpenChange={(o) => setConfirmDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader><DialogTitle>Confirm Material & Advance Payment</DialogTitle></DialogHeader>
          {confirmDialog.order && (
            <div className="space-y-4 py-2">
              <div className="text-sm">
                <span className="text-muted-foreground">Order:</span> {confirmDialog.order.order_number}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Material</Label>
                <select
                  value={materialId}
                  onChange={(e) => setMaterialId(e.target.value)}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="">Select material...</option>
                  {(materials ?? []).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.name} (${Number(m.unit_cost).toFixed(2)}/{m.unit})</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Quantity</Label>
                <Input type="number" value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">
                  Advance Payment % <span className="text-muted-foreground">(default: 20%)</span>
                </Label>
                <div className="flex items-center gap-3">
                  <Input type="number" value={advancePercent} onChange={(e) => setAdvancePercent(e.target.value)} className="w-24" min="0" max="100" />
                  <Percent className="h-4 w-4 text-muted-foreground" />
                </div>
              </div>
              <div className="rounded-xl bg-card/60 border border-white/5 p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Order Total</span>
                  <span className="font-medium">${Number(confirmDialog.order.order_total ?? 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Advance ({Number(advancePercent)}%)</span>
                  <span className="font-medium text-primary">
                    ${(Number(confirmDialog.order.order_total ?? 0) * Number(advancePercent) / 100).toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-white/5 pt-2 flex justify-between text-sm">
                  <span className="font-medium">Balance Due</span>
                  <span className="font-medium">
                    ${(Number(confirmDialog.order.order_total ?? 0) * (1 - Number(advancePercent) / 100)).toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog({ open: false, order: null })}>Cancel</Button>
            <Button onClick={() => confirmMutation.mutate()} disabled={!materialId} className="bg-[image:var(--gradient-primary)]">
              <CheckCircle2 className="h-4 w-4 mr-1.5" />Confirm & Request Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QR Code Dialog */}
      <Dialog open={qrDialog.open} onOpenChange={(o) => setQrDialog(d => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[360px]">
          <DialogHeader><DialogTitle>Advance Payment QR</DialogTitle></DialogHeader>
          {qrDialog.order && qrDialog.order.advance_qr_url && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="bg-white rounded-xl p-4">
                <img src={qrDialog.order.advance_qr_url} alt="Payment QR" className="w-48 h-48" />
              </div>
              <div className="text-center">
                <div className="font-medium">{qrDialog.order.order_number}</div>
                <div className="text-sm text-muted-foreground">
                  Advance: ${(Number(qrDialog.order.order_total ?? 0) * Number(qrDialog.order.advance_payment_percent ?? 20) / 100).toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
