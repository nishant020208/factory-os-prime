import { createFileRoute, Link } from "@tanstack/react-router";
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
  Layers,
  Plus,
  Trash2,
  Save,
  RotateCcw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { notifyAutoRfqCreated } from "@/lib/notifications";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/production-planning")({
  head: () => ({
    meta: [
      { title: "Production Planning — FactoryOS AI" },
      {
        name: "description",
        content:
          "Check materials against BOM and warehouse stock, reserve, and start production on approved orders.",
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

/** One editable material row on an order's planning card. */
interface ManualRow {
  componentId: string;
  perUnit: number;
}

/** A resolved row — real material/product metadata plus live stock math. */
interface ResolvedLine {
  row: ManualRow;
  componentId: string;
  componentName: string;
  kind: "product" | "material";
  perUnit: number;
  unit: string;
  required: number;
  stock: number;
  sufficient: boolean;
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
        .in("status", ["approved", "material_reserved", "procurement_pending", "in_production"])
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
    queryFn: async () => (await supabase.from("bom").select("*, bom_items(*)")).data ?? [],
    enabled: !!companyId,
  });

  const { data: materials } = useQuery({
    queryKey: ["pp-materials", companyId],
    queryFn: async () =>
      (await supabase.from("materials").select("id, name, unit").eq("company_id", companyId!))
        .data ?? [],
    enabled: !!companyId,
  });

  const { data: products } = useQuery({
    queryKey: ["pp-products", companyId],
    queryFn: async () =>
      (await supabase.from("products").select("id, name, unit").eq("company_id", companyId!))
        .data ?? [],
    enabled: !!companyId,
  });

  // Real warehouse stock — raw material + finished goods rows. RLS scopes
  // this to the Production Manager's own plant's warehouses, so On Hand is
  // the correct plant's live stock.
  const { data: inventory } = useQuery({
    queryKey: ["pp-inventory", companyId],
    queryFn: async () =>
      (await supabase.from("inventory").select("*").eq("company_id", companyId!)).data ?? [],
    enabled: !!companyId,
  });

  // Operators for assignment — pull from user_roles (production_operator)
  // joined to profiles. user_roles is the authoritative source of active
  // roles; whitelist is invite-management data that production managers
  // cannot read under RLS, which made this list empty.
  const { data: operators } = useQuery({
    queryKey: ["pp-operators", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("company_id", companyId)
        .eq("role", "production_operator");
      if (!roles?.length) return [];
      const ids = roles.map((r) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, email")
        .eq("company_id", companyId)
        .in("id", ids);
      return profiles ?? [];
    },
    enabled: !!companyId,
  });

  // Machines for assignment context
  const { data: machines } = useQuery({
    queryKey: ["pp-machines", companyId],
    queryFn: async () =>
      (await supabase.from("machines").select("id, name, status").eq("company_id", companyId!))
        .data ?? [],
    enabled: !!companyId,
  });

  // ────────────────────────────────────────────────────────────────────
  // Part 1 — order-specific editable material list. Each order's rows are
  // pre-filled from the product's BOM template (auto-BOM) but stay fully
  // editable: add/remove rows, change per-unit quantities, then either run
  // the stock check with THIS list or save it back as the standard BOM.
  // ────────────────────────────────────────────────────────────────────
  const [manualRows, setManualRows] = useState<Record<string, ManualRow[]>>({});

  // Resolve BOM template lines for a product (auto-BOM starting point).
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

  // Rows shown for an order: the manual edits if the PM touched them,
  // otherwise the auto-BOM template as a pre-filled starting point.
  const rowsFor = (order: any): ManualRow[] => {
    const manual = manualRows[order.id];
    if (manual) return manual;
    return bomLinesFor(order.product_id).map((l) => ({
      componentId: l.componentId,
      perUnit: l.perUnit,
    }));
  };

  // Available stock for a component — on-hand minus reserved, quarantined, damaged.
  const stockFor = (componentId: string): number =>
    (inventory ?? []).reduce(
      (sum: number, r: any) => {
        if (r.material_id !== componentId && r.product_id !== componentId) return sum;
        const onHand = Number(r.quantity ?? 0);
        const reserved = Number(r.reserved_quantity ?? 0);
        const quarantined = Number(r.quarantined_quantity ?? 0);
        const damaged = Number(r.damaged_qty ?? 0);
        return sum + Math.max(0, onHand - reserved - quarantined - damaged);
      },
      0,
    );

  // Resolve editable rows against real catalog + live stock data.
  const computeLines = (order: any, rows: ManualRow[]): ResolvedLine[] =>
    rows.map((r) => {
      const mat = (materials ?? []).find((m: any) => m.id === r.componentId);
      const prod = (products ?? []).find((p: any) => p.id === r.componentId);
      const componentId = r.componentId;
      const perUnit = Number(r.perUnit) || 0;
      const required = perUnit * (Number(order.quantity) || 1);
      const stock = componentId ? stockFor(componentId) : 0;
      return {
        row: r,
        componentId,
        componentName: mat?.name ?? prod?.name ?? "—",
        kind: mat ? "material" : "product",
        perUnit,
        unit: mat?.unit ?? prod?.unit ?? "units",
        required,
        stock,
        sufficient: componentId ? stock >= required : false,
      };
    });

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
    mutationFn: async ({
      order,
      operatorId,
      machineId,
      operation,
    }: {
      order: any;
      operatorId: string;
      machineId?: string | null;
      operation?: string | null;
    }) => {
      if (!companyId) throw new Error("Not authenticated");

      // Create or update work order with assigned operator + machine
      const { data: existing } = await supabase
        .from("work_orders")
        .select("id")
        .eq("wo_number", `WO-${order.so_number}`)
        .eq("company_id", companyId)
        .single();

      if (existing) {
        const { error } = await supabase
          .from("work_orders")
          .update({
            operator_id: operatorId,
            status: "in_progress",
            assigned_by: user?.id ?? operatorId,
            machine_id: machineId || null,
            operation: operation || null,
          })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("work_orders").insert({
          company_id: companyId,
          wo_number: `WO-${order.so_number}`,
          quantity: order.quantity,
          status: "in_progress",
          operator_id: operatorId,
          assigned_by: user?.id ?? operatorId,
          due_date: order.due_date,
          machine_id: machineId || null,
          operation: operation || null,
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

  // Reserve materials & start production — driven by the PM's material list
  // (template-prefilled or manually edited), NOT a decorative table.
  const reserveMutation = useMutation({
    mutationFn: async ({ order, rows }: { order: any; rows: ManualRow[] }) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const lines = computeLines(order, rows);
      if (lines.length === 0) throw new Error("Add at least one component to the material list");
      if (!lines.every((l) => l.sufficient))
        throw new Error("Insufficient stock — trigger procurement first");

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

  // Save the PM's material list as the standard BOM template for the product.
  const saveTemplateMutation = useMutation({
    mutationFn: async ({ order, rows }: { order: any; rows: ManualRow[] }) => {
      if (!companyId) throw new Error("Not authenticated");
      const valid = rows.filter((r) => r.componentId);
      if (valid.length === 0) throw new Error("Add at least one component first");

      const { data: existing } = await supabase
        .from("bom")
        .select("id")
        .eq("company_id", companyId)
        .eq("product_id", order.product_id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      let bomId = existing?.id;
      if (!bomId) {
        const { data, error } = await supabase
          .from("bom")
          .insert({
            company_id: companyId,
            product_id: order.product_id,
            version: "v1",
            status: "active",
            notes: `Standard BOM for ${order.product_name} — saved from Production Planning`,
          })
          .select("id")
          .single();
        if (error) throw error;
        bomId = data.id;
      }

      await supabase.from("bom_items").delete().eq("bom_id", bomId);
      const { error } = await supabase.from("bom_items").insert(
        valid.map((r) => {
          const mat = (materials ?? []).find((m: any) => m.id === r.componentId);
          const prod = (products ?? []).find((p: any) => p.id === r.componentId);
          return {
            company_id: companyId,
            bom_id: bomId,
            component_product_id: r.componentId,
            quantity: Number(r.perUnit) || 0,
            unit: mat?.unit ?? prod?.unit ?? "pcs",
          };
        }),
      );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pp-boms"] });
      queryClient.invalidateQueries({ queryKey: ["bom-rows"] });
      toast.success("Saved as the standard BOM for this product");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Trigger Procurement — raises PRs AND auto-creates RFQs for every shortfall.
  const procureMutation = useMutation({
    mutationFn: async ({ order, rows }: { order: any; rows: ManualRow[] }) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const lines = computeLines(order, rows);

      // Shortfall components (raw materials only — that's what gets procured).
      const shortfallLines = lines.filter(
        (l) => l.componentId && !l.sufficient && l.kind === "material",
      );
      const requested: string[] = [];
      const rfqNumbers: string[] = [];
      let seq = 0;

      for (const l of shortfallLines) {
        const qty = Math.max(1, Math.ceil(l.required - l.stock));

        // 1) Purchase requisition (existing Procurement Manager workflow).
        const existingPr = await supabase
          .from("purchase_requisitions")
          .select("id")
          .eq("company_id", companyId)
          .eq("material_id", l.componentId)
          .ilike("notes", `%${order.so_number}%`)
          .neq("status", "converted")
          .maybeSingle();
        if (!existingPr.data?.id) {
          const { error } = await supabase.from("purchase_requisitions").insert({
            company_id: companyId,
            pr_number: `PR-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`,
            material_id: l.componentId,
            quantity: qty,
            status: "pending",
            notes: `Production shortage for order ${order.so_number} (${order.product_name}) — raised by Production Manager. Order ${qty} ${l.unit} of ${l.componentName}.`,
            created_by: user.id,
          });
          if (error) throw error;
        }

        // 2) Auto-RFQ — shortfall quantity only, status draft = "Pending
        //    Review / Needs Supplier Selection". Procurement still explicitly
        //    picks which supplier(s) to send it to (their judgment call).
        const existingRfq = await supabase
          .from("rfqs")
          .select("id")
          .eq("company_id", companyId)
          .eq("material_id", l.componentId)
          .eq("source_order_id", order.id)
          .neq("status", "converted")
          .maybeSingle();
        if (!existingRfq.data?.id) {
          const rfqNumber = `RFQ-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}${seq ? `-${seq}` : ""}`;
          seq += 1;
          // Target delivery = order due date minus a 7-day lead-time buffer.
          const deadline = order.due_date
            ? new Date(new Date(order.due_date).getTime() - 7 * 86400000).toISOString().slice(0, 10)
            : null;
          const { error } = await supabase.from("rfqs").insert({
            company_id: companyId,
            rfq_number: rfqNumber,
            title: l.componentName,
            material_id: l.componentId,
            quantity: qty,
            status: "draft",
            notes: `Auto-generated: shortfall for ${order.so_number} (${order.product_name}). Shortfall ${qty} ${l.unit} of ${l.componentName} — raised by Production Manager.`,
            response_deadline: deadline,
            auto_generated: true,
            source_order_id: order.id,
            created_by: user.id,
          });
          if (error) throw error;
          rfqNumbers.push(rfqNumber);
        }

        requested.push(`${l.componentName} ×${qty}`);
      }

      const { error } = await supabase
        .from("sales_orders")
        .update({ status: "procurement_pending" })
        .eq("id", order.id);
      if (error) throw error;
      const materialName =
        requested.length > 0
          ? requested.join(", ")
          : (lines[0]?.componentName ?? "required materials");
      await notifyAutoRfqCreated(companyId, order.so_number, requested, rfqNumbers);

      // File an audit entry so the shortage → RFQ trigger leaves a trail
      // (viewable by Auditor / Company Admin). Never blocks the flow.
      try {
        await supabase.from("audit_logs").insert({
          company_id: companyId,
          user_id: user.id,
          action: "material_shortage_auto_rfq",
          entity: "sales_orders",
          entity_id: order.id,
          metadata: {
            so_number: order.so_number,
            product: order.product_name,
            materials_short: requested,
            rfq_numbers: rfqNumbers,
            order_status: "procurement_pending",
          },
        });
      } catch (auditErr) {
        console.warn("Audit log skipped:", auditErr);
      }
    },
    onSuccess: (_d, c) => {
      queryClient.invalidateQueries({ queryKey: ["pp-orders"] });
      queryClient.invalidateQueries({ queryKey: ["pr-list"] });
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success(
        "Procurement raised — requisitions + auto-RFQ(s) created and Procurement Manager notified",
      );
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
        sub="Approved orders → editable material list (pre-filled from the product BOM) checked live against plant warehouse stock → reserve & start, or auto-raise RFQs for what's short."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Awaiting Start" value={String(awaiting)} icon={Calendar} tone="warning" />
        <Kpi label="Materials Reserved" value={String(reserved)} icon={Package} tone="success" />
        <Kpi
          label="Procurement Pending"
          value={String(procPending)}
          icon={ShoppingCart}
          tone="info"
        />
        <Kpi label="In Production" value={String(inProd)} icon={Factory} tone="primary" />
      </div>

      {(orders ?? []).map((o: any) => (
        <OrderPanel
          key={o.id}
          order={o}
          rows={rowsFor(o)}
          hasManual={!!manualRows[o.id]}
          onRowsChange={(rows: ManualRow[]) => setManualRows((m) => ({ ...m, [o.id]: rows }))}
          onResetTemplate={() =>
            setManualRows((m) => {
              const next = { ...m };
              delete next[o.id];
              return next;
            })
          }
          materials={materials ?? []}
          products={products ?? []}
          computeLines={(rows: ManualRow[]) => computeLines(o, rows)}
          reserveMutation={reserveMutation}
          procureMutation={procureMutation}
          saveTemplateMutation={saveTemplateMutation}
          advancePaymentMutation={advancePaymentMutation}
          confirmPaymentMutation={confirmPaymentMutation}
          assignOperatorMutation={assignOperatorMutation}
          operators={operators ?? []}
          machines={machines ?? []}
        />
      ))}

      {(orders ?? []).length === 0 && (
        <EmptyState
          title="No orders to plan"
          sub="Approved orders appear here after Company Admin approval — the material check runs against the real BOM and warehouse stock."
        />
      )}
    </div>
  );
}

function OrderPanel({
  order,
  rows,
  hasManual,
  onRowsChange,
  onResetTemplate,
  materials,
  products,
  computeLines,
  reserveMutation,
  procureMutation,
  saveTemplateMutation,
  advancePaymentMutation,
  confirmPaymentMutation,
  assignOperatorMutation,
  operators,
  machines,
}: {
  order: any;
  rows: ManualRow[];
  hasManual: boolean;
  onRowsChange: (rows: ManualRow[]) => void;
  onResetTemplate: () => void;
  materials: any[];
  products: any[];
  computeLines: (rows: ManualRow[]) => ResolvedLine[];
  reserveMutation: any;
  procureMutation: any;
  saveTemplateMutation: any;
  advancePaymentMutation: any;
  confirmPaymentMutation: any;
  assignOperatorMutation: any;
  operators: any[];
  machines: any[];
}) {
  const [advancePercent, setAdvancePercent] = useState(30);
  const [selectedOperator, setSelectedOperator] = useState("");
  const [selectedMachine, setSelectedMachine] = useState("");
  const [operationName, setOperationName] = useState("Carpentry");

  const lines = computeLines(rows);
  const validLines = lines.filter((l) => l.componentId);
  const allSufficient = validLines.length > 0 && validLines.every((l) => l.sufficient);
  const missing = validLines
    .filter((l) => !l.sufficient)
    .map((l) => `${l.componentName} (need ${l.required}, have ${l.stock})`);

  const updateRow = (index: number, patch: Partial<ManualRow>) => {
    onRowsChange(rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  };

  const paymentStatus = order.advance_payment_status;
  const isPaymentConfirmed = paymentStatus === "confirmed";
  const isPaymentRequested = paymentStatus === "requested" || paymentStatus === "paid_pending";
  const canAssignOperator = order.status === "in_production" && isPaymentConfirmed;

  return (
    <Panel title={order.so_number} right={<StatusBadge status={order.status} />} className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <div className="text-sm text-muted-foreground">
          {order.customer_name} · {order.product_name} × {order.quantity} · Due{" "}
          {order.due_date ? new Date(order.due_date).toLocaleDateString() : "—"}
        </div>
        <div className="flex gap-2 flex-wrap">
          {order.status === "approved" && (
            <>
              {lines.length === 0 && (
                <Link
                  to="/bom"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/15 bg-white/5 px-3 text-sm text-muted-foreground hover:border-white/30 hover:text-foreground"
                  title="Pick the raw materials that go into this product"
                >
                  <Layers className="h-3.5 w-3.5" />
                  Define BOM
                </Link>
              )}
              <Button
                size="sm"
                className="h-8"
                onClick={() => reserveMutation.mutate({ order, rows })}
                disabled={reserveMutation.isPending || !allSufficient}
                title={
                  allSufficient
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
                onClick={() => procureMutation.mutate({ order, rows })}
                disabled={procureMutation.isPending || allSufficient || missing.length === 0}
              >
                <ShoppingCart className="h-3.5 w-3.5 mr-1.5" />
                Trigger Procurement
              </Button>
            </>
          )}
          {order.status === "procurement_pending" && (
            <span className="text-xs text-amber-400 inline-flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />
              Awaiting GRN — order resumes automatically once materials are received
            </span>
          )}
          {order.status === "material_reserved" && (
            <span className="text-xs text-success inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Reserved — create Work Orders
            </span>
          )}
          {order.status === "in_production" && (
            <span className="text-xs text-info inline-flex items-center gap-1">
              <Factory className="h-3.5 w-3.5" />
              In production
            </span>
          )}
        </div>
      </div>

      {/* Editable Material List */}
      <div className="overflow-x-auto mb-3">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
              {["Component", "Type", "Per Unit", "Required", "On Hand", "Status", ""].map((h) => (
                <th key={h} className="py-2 px-2 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="py-3 px-2 text-muted-foreground text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>
                      No material list yet — add the raw materials that make this product, or start
                      from the BOM tab template.
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onRowsChange([{ componentId: "", perUnit: 1 }])}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Row
                    </Button>
                    <Link
                      to="/bom"
                      className="inline-flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2 py-1 text-[11px] text-foreground hover:border-white/30"
                    >
                      <Layers className="h-3 w-3" />
                      Define BOM
                    </Link>
                  </div>
                </td>
              </tr>
            )}
            {lines.map((l: ResolvedLine, idx: number) => (
              <tr key={idx} className="border-b border-white/5 last:border-0">
                <td className="py-2 px-2 min-w-[220px]">
                  <select
                    value={l.componentId}
                    onChange={(e) => updateRow(idx, { componentId: e.target.value })}
                    className="w-full h-8 px-2 text-sm bg-background border border-white/10 rounded"
                  >
                    <option value="">Select material…</option>
                    {(materials ?? []).map((m: any) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.unit ?? "unit"})
                      </option>
                    ))}
                    {(products ?? []).map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (sub-assembly)
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-2 text-xs text-muted-foreground uppercase">{l.kind}</td>
                <td className="py-2 px-2">
                  <input
                    type="number"
                    min={0}
                    step="any"
                    value={Number.isFinite(l.perUnit) ? l.perUnit : ""}
                    onChange={(e) => updateRow(idx, { perUnit: Number(e.target.value) || 0 })}
                    className="w-20 h-8 px-2 text-sm tabular-nums bg-background border border-white/10 rounded"
                  />
                  <span className="ml-1 text-[11px] text-muted-foreground">{l.unit}</span>
                </td>
                <td className="py-2 px-2 tabular-nums">{l.required.toLocaleString()}</td>
                <td className="py-2 px-2 tabular-nums">{l.stock.toLocaleString()}</td>
                <td className="py-2 px-2">
                  {!l.componentId ? (
                    <span className="text-[11px] text-muted-foreground">—</span>
                  ) : l.sufficient ? (
                    <StatusBadge status="sufficient" />
                  ) : (
                    <StatusBadge status="insufficient" />
                  )}
                </td>
                <td className="py-2 px-2 text-right">
                  <button
                    type="button"
                    onClick={() => onRowsChange(rows.filter((_, i) => i !== idx))}
                    className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                    title="Remove row"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Row actions */}
      <div className="flex flex-wrap items-center gap-2 mb-1">
        <Button
          size="sm"
          variant="outline"
          className="h-7 text-xs"
          onClick={() => onRowsChange([...rows, { componentId: "", perUnit: 1 }])}
        >
          <Plus className="h-3 w-3 mr-1" />
          Add Row
        </Button>
        {validLines.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={() => saveTemplateMutation.mutate({ order, rows })}
            disabled={saveTemplateMutation.isPending}
            title="Save this material list as the standard BOM for this product"
          >
            <Save className="h-3 w-3 mr-1" />
            Save as Template
          </Button>
        )}
        {hasManual && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-muted-foreground"
            onClick={onResetTemplate}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset to Template
          </Button>
        )}
        {missing.length > 0 && (
          <span className="text-[11px] text-amber-400 inline-flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Short: {missing.join("; ")}
          </span>
        )}
      </div>

      {/* Advance Payment Section — only for in_production orders */}
      {order.status === "in_production" && (
        <div className="border-t border-white/5 pt-3 mt-3">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium">Advance Payment</span>
            {paymentStatus && (
              <span
                className={`text-xs px-2 py-0.5 rounded-full ${
                  isPaymentConfirmed
                    ? "bg-green-500/20 text-green-400"
                    : isPaymentRequested
                      ? "bg-yellow-500/20 text-yellow-400"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {isPaymentConfirmed
                  ? "Confirmed"
                  : isPaymentRequested
                    ? "Awaiting Payment"
                    : paymentStatus}
              </span>
            )}
          </div>

          {!paymentStatus && (
            <div className="flex items-center gap-3 flex-wrap">
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
                = ₹
                {((Number(order.total_amount ?? 0) * advancePercent) / 100).toLocaleString("en-IN")}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={() => advancePaymentMutation.mutate({ order, percentage: advancePercent })}
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
              onClick={() => confirmPaymentMutation.mutate(order)}
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-2">
            <select
              value={selectedOperator}
              onChange={(e) => setSelectedOperator(e.target.value)}
              className="h-8 px-2 text-sm bg-background border border-white/10 rounded"
            >
              <option value="">Select operator…</option>
              {operators.map((op: any) => (
                <option key={op.id} value={op.id}>
                  {op.full_name ?? op.id.slice(0, 8)}
                </option>
              ))}
            </select>
            <select
              value={selectedMachine}
              onChange={(e) => setSelectedMachine(e.target.value)}
              className="h-8 px-2 text-sm bg-background border border-white/10 rounded"
            >
              <option value="">Select machine…</option>
              {machines.map((m: any) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.status})
                </option>
              ))}
            </select>
            <input
              type="text"
              value={operationName}
              onChange={(e) => setOperationName(e.target.value)}
              placeholder="Operation name"
              className="h-8 px-2 text-sm bg-background border border-white/10 rounded"
            />
          </div>
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              className="h-8"
              disabled={!selectedOperator || assignOperatorMutation.isPending}
              onClick={() =>
                assignOperatorMutation.mutate({
                  order,
                  operatorId: selectedOperator,
                  machineId: selectedMachine || null,
                  operation: operationName || null,
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
      {order.status === "in_production" && !isPaymentConfirmed && (
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
