import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Factory,
  Package,
  ShoppingCart,
  Loader2,
  CreditCard,
  UserCheck,
  Banknote,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { notifyProcurementTriggered } from "@/lib/notifications";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/production-planning")({
  head: () => ({
    meta: [
      { title: "Production Planning — FactoryOS AI" },
      {
        name: "description",
        content: "Check materials against BOM and warehouse stock, reserve, and start production on approved orders.",
      },
    ],
  }),
  component: ProductionPlanningPage,
});

interface BomLine {
  componentId: string;
  componentName: string;
  kind: "product" | "material";
  perUnit: number;
  unit: string;
}

function ProductionPlanningPage() {
  const queryClient = useQueryClient();
  const { companyId, user } = useAuth();

  // Real customer orders approved and ready for production planning.
  const { data: orders } = useQuery({
    queryKey: ["pp-orders", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select(
          `*,
          customers!left(name),
          sales_order_items(product_id, quantity, unit_price, products!left(name, unit_cost))`,
        )
        .in("status", [
          "approved",
          "material_reserved",
          "procurement_pending",
          "in_production",
        ])
        .order("created_at", { ascending: false });
      return (data ?? []).map((o: any) => {
        const item = o.sales_order_items?.[0];
        return {
          ...o,
          customer_name: o.customers?.name ?? "—",
          product_id: item?.product_id ?? null,
          product_name: item?.products?.name ?? "—",
          quantity: Number(item?.quantity ?? 1),
        };
      });
    },
    enabled: !!companyId,
  });

  // BOM per product + components.
  const { data: boms } = useQuery({
    queryKey: ["pp-boms", companyId],
    queryFn: async () =>
      (await supabase.from("bom").select("*, bom_items(*)")).data ?? [],
    enabled: !!companyId,
  });

  const { data: materials } = useQuery({
    queryKey: ["pp-materials", companyId],
    queryFn: async () =>
      (await supabase.from("materials").select("id, name, unit").eq("company_id", companyId!)).data ??
      [],
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ["pp-products", companyId],
    queryFn: async () =>
      (await supabase.from("products").select("id, name, unit").eq("company_id", companyId!)).data ??
      [],
    enabled: !!companyId,
  });

  // Real warehouse stock — raw material + finished goods rows.
  const { data: inventory } = useQuery({
    queryKey: ["pp-inventory", companyId],
    queryFn: async () =>
      (await supabase.from("inventory").select("*").eq("company_id", companyId!)).data ?? [],
    enabled: !!companyId,
  });

  // Operators for assignment — pull from whitelist (accepted production_operators)
  const { data: operators } = useQuery({
    queryKey: ["pp-operators", companyId],
    queryFn: async () => {
      // Get whitelisted production operators for this company
      const { data: wl } = await supabase
        .from("whitelist")
        .select("email")
        .eq("company_id", companyId!)
        .eq("role", "production_operator")
        .eq("status", "accepted");
      if (!wl?.length) return [];
      const emails = wl.map((w: any) => w.email);
      // Get profiles for those emails
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("company_id", companyId!)
        .in("email", emails);
      return profiles ?? [];
    },
    enabled: !!companyId,
  });

  // Machines for assignment context
  const { data: machines } = useQuery({
    queryKey: ["pp-machines", companyId],
    queryFn: async () =>
      (await supabase.from("machines").select("id, name, status").eq("company_id", companyId!)).data ??
      [],
    enabled: !!companyId,
  });

  // Resolve BOM lines for a product.
  const bomLinesFor = (productId: string | null): BomLine[] => {
    if (!productId) return [];
    const bom = (boms ?? []).find((b: any) => b.product_id === productId);
    if (!bom?.bom_items?.length) return [];
    return (bom.bom_items ?? []).map((it: any) => {
      const mat = (materials ?? []).find((m: any) => m.id === it.component_product_id);
      const prod = (products ?? []).find((p: any) => p.id === it.component_product_id);
      return {
        componentId: it.component_product_id,
        componentName: mat?.name ?? prod?.name ?? "—",
        kind: mat ? "material" : "product",
        perUnit: Number(it.quantity ?? 0),
        unit: mat?.unit ?? prod?.unit ?? "units",
      };
    });
  };

  // Stock on hand for a component (material or finished product).
  const stockFor = (componentId: string): number =>
    (inventory ?? []).reduce(
      (sum: number, r: any) =>
        (r.material_id === componentId || r.product_id === componentId) ? sum + Number(r.quantity ?? 0) : sum,
      0,
    );

  interface CheckedOrder {
    order: any;
    lines: { line: BomLine; required: number; stock: number; sufficient: boolean }[];
    allSufficient: boolean;
    missing: string[];
  }

  const checked = useMemo<CheckedOrder[]>(() => {
    return (orders ?? []).map((o: any) => {
      const lines = bomLinesFor(o.product_id).map((line) => {
        const required = line.perUnit * o.quantity;
        const stock = stockFor(line.componentId);
        return { line, required, stock, sufficient: stock >= required };
      });
      const missing = lines
        .filter((l) => !l.sufficient)
        .map((l) => `${l.line.componentName} (need ${l.required}, have ${l.stock})`);
      return {
        order: o,
        lines,
        allSufficient: lines.length === 0 || lines.every((l) => l.sufficient),
        missing,
      };
    });
  }, [orders, boms, materials, products, inventory]);

  // Advance payment request mutation
  const advancePaymentMutation = useMutation({
    mutationFn: async ({ order, percentage }: { order: any; percentage: number }) => {
      if (!companyId) throw new Error("Not authenticated");
      const totalAmount = Number(order.total_amount ?? 0);
      const advanceAmount = (totalAmount * percentage) / 100;

      const { error } = await supabase
        .from("sales_orders")
        .update({
          advance_payment_percent: percentage,
          advance_payment_status: "requested",
          advance_qr_url: `upi://pay?pa=demo@upi&pn=ABCManufacturing&am=${advanceAmount}`,
          balance_due: totalAmount - advanceAmount,
        })
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp-orders"] });
      toast.success("Advance payment request sent to customer");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Payment confirmation mutation
  const confirmPaymentMutation = useMutation({
    mutationFn: async (order: any) => {
      if (!companyId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("sales_orders")
        .update({
          advance_payment_status: "confirmed",
        })
        .eq("id", order.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp-orders"] });
      toast.success("Payment confirmed — operator can be assigned now");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Operator assignment mutation
  const assignOperatorMutation = useMutation({
    mutationFn: async ({ order, operatorId }: { order: any; operatorId: string }) => {
      if (!companyId) throw new Error("Not authenticated");

      // Create or update work order with assigned operator
      const { data: existing } = await supabase
        .from("work_orders")
        .select("id")
        .eq("wo_number", `WO-${order.so_number}`)
        .eq("company_id", companyId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("work_orders")
          .update({ operator_id: operatorId, status: "in_progress", assigned_by: operatorId })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("work_orders").insert({
          company_id: companyId,
          wo_number: `WO-${order.so_number}`,
          quantity: order.quantity,
          status: "in_progress",
          operator_id: operatorId,
          assigned_by: operatorId,
          due_date: order.due_date,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp-orders"] });
      toast.success("Operator assigned — work order created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const reserveMutation = useMutation({
    mutationFn: async (order: any) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const now = new Date().toISOString().slice(0, 10);
      const qty = Number(order.quantity ?? 1);

      // 1) Create the production order (the real row Warehouse/Quality read).
      const { data: prodOrder, error: poErr } = await supabase
        .from("production_orders")
        .insert({
          company_id: companyId,
          order_number: `PRD-${order.so_number}`,
          sales_order_id: order.id,
          product_id: order.product_id,
          quantity: qty,
          status: "in_production",
          priority: order.priority ?? "medium",
          start_date: now,
          due_date: order.due_date ?? null,
          progress: 0,
        })
        .select("id")
        .single();
      if (poErr) throw poErr;

      // 2) Record the planning row (schedule source for Plant Manager view).
      const { error: planErr } = await supabase.from("production_planning").insert({
        company_id: companyId,
        sales_order_id: order.id,
        customer_order_id: null,
        order_number: order.so_number,
        status: "material_reserved",
        priority: order.priority ?? "medium",
        quantity: qty,
        start_date: now,
        due_date: order.due_date ?? null,
        created_by: user.id,
      });
      if (planErr) throw planErr;

      // 3) Advance the order to in_production.
      const { error: soErr } = await supabase
        .from("sales_orders")
        .update({ status: "in_production", progress: 10 })
        .eq("id", order.id);
      if (soErr) throw soErr;

      return prodOrder.id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp-orders"] });
      queryClient.invalidateQueries({ queryKey: ["pm-schedule"] });
      toast.success("Production started — create & assign Work Orders in the Work Orders tab");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const procureMutation = useMutation({
    mutationFn: async (c: CheckedOrder) => {
      if (!companyId) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("sales_orders")
        .update({ status: "procurement_pending" })
        .eq("id", c.order.id);
      if (error) throw error;
      const materialName = c.missing[0] ?? "required materials";
      await notifyProcurementTriggered(companyId, c.order.so_number, materialName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp-orders"] });
      toast.success("Procurement branch triggered — Procurement Manager notified");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const awaiting = (orders ?? []).filter((o: any) => o.status === "approved").length;
  const reserved = (orders ?? []).filter((o: any) => o.status === "material_reserved").length;
  const procPending = (orders ?? []).filter((o: any) => o.status === "procurement_pending").length;
  const inProd = (orders ?? []).filter((o: any) => o.status === "in_production").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Production"
        title="Production Planning"
        sub="Approved orders → real BOM material check against live warehouse stock → reserve materials and start production, or trigger the procurement branch."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Awaiting Start" value={String(awaiting)} icon={Calendar} tone="warning" />
        <Kpi label="Materials Reserved" value={String(reserved)} icon={Package} tone="success" />
        <Kpi label="Procurement Pending" value={String(procPending)} icon={ShoppingCart} tone="info" />
        <Kpi label="In Production" value={String(inProd)} icon={Factory} tone="primary" />
      </div>

      {(checked ?? []).map((c) => (
        <OrderPanel
          key={c.order.id}
          c={c}
          reserveMutation={reserveMutation}
          procureMutation={procureMutation}
          advancePaymentMutation={advancePaymentMutation}
          confirmPaymentMutation={confirmPaymentMutation}
          assignOperatorMutation={assignOperatorMutation}
          operators={operators ?? []}
          machines={machines ?? []}
        />
      ))}

      {checked.length === 0 && (
        <EmptyState
          title="No orders to plan"
          sub="Approved orders appear here after Company Admin approval — the material check runs against the real BOM and warehouse stock."
        />
      )}
    </div>
  );
}

function OrderPanel({
  c,
  reserveMutation,
  procureMutation,
  advancePaymentMutation,
  confirmPaymentMutation,
  assignOperatorMutation,
  operators,
  machines,
}: {
  c: any;
  reserveMutation: any;
  procureMutation: any;
  advancePaymentMutation: any;
  confirmPaymentMutation: any;
  assignOperatorMutation: any;
  operators: any[];
  machines: any[];
}) {
  const [advancePercent, setAdvancePercent] = useState(30);
  const [selectedOperator, setSelectedOperator] = useState("");

  const paymentStatus = c.order.advance_payment_status;
  const isPaymentConfirmed = paymentStatus === "confirmed";
  const isPaymentRequested = paymentStatus === "requested" || paymentStatus === "paid_pending";
  const canAssignOperator = c.order.status === "in_production" && isPaymentConfirmed;

  return (
    <Panel
      title={c.order.so_number}
      right={<StatusBadge status={c.order.status} />}
      className="mb-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-sm text-muted-foreground">
          {c.order.customer_name} · {c.order.product_name} × {c.order.quantity} · Due{" "}
          {c.order.due_date ? new Date(c.order.due_date).toLocaleDateString() : "—"}
        </div>
        <div className="flex gap-2">
          {c.order.status === "approved" && (
            <>
              <Button
                size="sm"
                className="h-8"
                onClick={() => reserveMutation.mutate(c.order)}
                disabled={reserveMutation.isPending || !c.allSufficient}
                title={
                  c.allSufficient
                    ? "Reserve materials and start production"
                    : "Insufficient stock — trigger procurement first"
                }
              >
                {reserveMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                ) : (
                  <Factory className="h-3.5 w-3.5 mr-1.5" />
                )}
                Reserve & Start
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 border-amber-500/30 text-amber-400"
                onClick={() => procureMutation.mutate(c)}
                disabled={procureMutation.isPending || c.allSufficient || c.missing.length === 0}
              >
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                Trigger Procurement
              </Button>
            </>
          )}
          {c.order.status === "procurement_pending" && (
            <span className="text-xs text-amber-400 inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Awaiting GRN — order resumes automatically once materials are received
            </span>
          )}
          {c.order.status === "material_reserved" && (
            <span className="text-xs text-success inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reserved — create Work Orders
            </span>
          )}
          {c.order.status === "in_production" && (
            <span className="text-xs text-info inline-flex items-center gap-1">
              <Factory className="h-3.5 w-3.5" />
              In production
            </span>
          )}
        </div>
      </div>

      {/* BOM Table */}
      <div className="overflow-x-auto mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
              {["Component", "Type", "Per Unit", "Required", "On Hand", "Status"].map((h) => (
                <th key={h} className="py-2 px-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {c.lines.length === 0 && (
              <tr>
                <td colSpan={6} className="py-3 px-2 text-muted-foreground text-xs">
                  No BOM defined for this product — add one in the BOM tab to run the material check.
                </td>
              </tr>
            )}
            {c.lines.map((l: any) => (
              <tr key={l.line.componentId} className="border-b border-white/5 last:border-0">
                <td className="py-2 px-2 font-medium">{l.line.componentName}</td>
                <td className="py-2 px-2 text-xs text-muted-foreground uppercase">{l.line.kind}</td>
                <td className="py-2 px-2 tabular-nums">
                  {l.line.perUnit} {l.line.unit}
                </td>
                <td className="py-2 px-2 tabular-nums">{l.required}</td>
                <td className="py-2 px-2 tabular-nums">{l.stock}</td>
                <td className="py-2 px-2">
                  {l.sufficient ? (
                    <StatusBadge status="sufficient" />
                  ) : (
                    <StatusBadge status="insufficient" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Advance Payment Section — only for in_production orders */}
      {c.order.status === "in_production" && (
        <div className="border-t border-white/5 pt-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium">Advance Payment</span>
            {paymentStatus && (
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                isPaymentConfirmed
                  ? "bg-green-500/20 text-green-400"
                  : isPaymentRequested
                  ? "bg-yellow-500/20 text-yellow-400"
                  : "bg-muted text-muted-foreground"
              }`}>
                {isPaymentConfirmed ? "Confirmed" : isPaymentRequested ? "Awaiting Payment" : paymentStatus}
              </span>
            )}
          </div>

          {!paymentStatus && (
            <div className="flex items-center gap-3">
              <label className="text-xs text-muted-foreground">Advance %</label>
              <input
                type="number"
                min={10}
                max={100}
                value={advancePercent}
                onChange={(e) => setAdvancePercent(Number(e.target.value))}
                className="w-16 h-7 px-2 text-sm bg-background border border-white/10 rounded"
              />
              <span className="text-xs text-muted-foreground">
                = ₹{((Number(c.order.total_amount ?? 0) * advancePercent) / 100).toLocaleString("en-IN")}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() =>
                  advancePaymentMutation.mutate({ order: c.order, percentage: advancePercent })
                }
                disabled={advancePaymentMutation.isPending}
              >
                <Banknote className="h-3 w-3 mr-1" />
                Request Advance
              </Button>
            </div>
          )}

          {isPaymentRequested && (
            <Button
              size="sm"
              className="h-7 text-xs bg-green-600 hover:bg-green-700"
              onClick={() => confirmPaymentMutation.mutate(c.order)}
              disabled={confirmPaymentMutation.isPending}
            >
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Confirm Payment Received
            </Button>
          )}
        </div>
      )}

      {/* Operator Assignment Section — only after payment confirmed */}
      {canAssignOperator && (
        <div className="border-t border-white/5 pt-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <UserCheck className="h-4 w-4 text-purple-400" />
            <span className="text-sm font-medium">Assign Operator</span>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="h-8 px-2 text-sm bg-background border border-white/10 rounded flex-1 max-w-xs"
            >
              <option value="">Select operator…</option>
              {operators.map((op: any) => (
                <option key={op.id} value={op.id}>
                  {op.full_name ?? op.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <Button
              size="sm"
              className="h-8"
              disabled={!selectedOperator || assignOperatorMutation.isPending}
              onClick={() =>
                assignOperatorMutation.mutate({
                  order: c.order,
                  operatorId: selectedOperator,
                })
              }
            >
              {assignOperatorMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              )}
              Assign
            </Button>
          </div>
          {operators.length === 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              No operators available — add operators in HR first
            </p>
          )}
        </div>
      )}

      {/* Show payment-required notice when in_production but no payment yet */}
      {c.order.status === "in_production" && !isPaymentConfirmed && (
        <div className="border-t border-white/5 pt-3 mt-3">
          <span className="text-xs text-amber-400 inline-flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" />
            {paymentStatus
              ? "Payment pending — operator assignment unlocks after payment confirmation"
              : "Request advance payment before assigning operators"}
          </span>
        </div>
      )}
    </Panel>
  );
}
