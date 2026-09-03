import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  Truck,
  CheckCircle2,
  Clock,
  DollarSign,
  AlertTriangle,
  FileText,
  Send,
  Eye,
  Download,
  Search as SearchIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, fmtMoneyK } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { notifyNewOrder, notifyOrderApproved, notifyOrderRejected } from "@/lib/notifications";
import { getCustomerUserId } from "@/lib/customer-lookup";
import { approveCustomerOrder, rejectCustomerOrder } from "@/lib/order-lifecycle";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({
    meta: [
      { title: "Orders — FactoryOS AI" },
      { name: "description", content: "Sales orders, delivery tracking and customer fulfillment." },
    ],
  }),
  component: OrdersPage,
});

// Dynamic order form fields
// Customers: only product + quantity + notes (admin sets priority/due_date after approval)
// Admins: full form including priority and due_date
function getOrderFormFields(customers: any[], products: any[], isCustomer: boolean): FormField[] {
  const fields: FormField[] = [];

  // Auto-generate SO number so customers don't need to fill it
  if (!isCustomer) {
    fields.push({
      key: "so_number",
      label: "Order Number",
      type: "text",
      placeholder: "SO-2026-001 (auto-generated if blank)",
    });
  }

  // Non-customer: pick customer from dropdown
  if (!isCustomer) {
    fields.push({
      key: "customer_id",
      label: "Customer",
      type: "select",
      placeholder: "Select customer",
      required: true,
      options: (customers ?? []).map((c: any) => ({ value: c.id, label: c.name })),
    });
  }

  // Product dropdown (from company's product catalog)
  fields.push({
    key: "product_id",
    label: "Product",
    type: "select",
    placeholder: "Select product",
    required: true,
    options: (products ?? []).map((p: any) => ({
      value: p.id,
      label: `${p.name} — ${fmtMoney(Number(p.unit_price))} / unit`,
    })),
  });

  fields.push({
    key: "quantity",
    label: "Quantity",
    type: "number",
    placeholder: "1",
    required: true,
  });

  // Total amount is AUTO-CALCULATED (qty × unit_price) — not entered by customer or admin in this form
  // Priority and due_date are set by Company Admin / Production Admin at approval time
  if (!isCustomer) {
    fields.push(
      {
        key: "priority",
        label: "Priority",
        type: "select",
        defaultValue: "medium",
        options: [
          { value: "low", label: "Low" },
          { value: "medium", label: "Medium" },
          { value: "high", label: "High" },
          { value: "critical", label: "Critical" },
        ],
      },
      { key: "due_date", label: "Due Date", type: "date" },
    );
  }

  fields.push({ key: "notes", label: "Notes / Special Instructions", type: "textarea" });

  return fields;
}

function OrdersPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; orderId: string }>({
    open: false,
    orderId: "",
  });
  const [rejectReason, setRejectReason] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  // Approve dialog: admin sets priority + due date before confirming
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; orderId: string }>({
    open: false,
    orderId: "",
  });
  const [approvePriority, setApprovePriority] = useState("medium");
  const [approveDueDate, setApproveDueDate] = useState("");

  // Fetch customers for dropdown
  const { data: customerList } = useQuery({
    queryKey: ["order-customers", companyId],
    queryFn: async () =>
      (await supabase.from("customers").select("id,name").eq("status", "active").order("name"))
        .data ?? [],
    enabled: !!companyId,
  });

  // Fetch products for dropdown
  const { data: productList } = useQuery({
    queryKey: ["order-products", companyId],
    queryFn: async () =>
      (await supabase.from("products").select("id,name,unit_price").eq("status", "active").order("name"))
        .data ?? [],
    enabled: !!companyId,
  });

  // Resolve role flags — declare BEFORE any useQuery that references them (TDZ fix)
  const isCompanyAdmin = roles.includes("company_admin");
  const isCustomer = roles.includes("customer_portal");
  const isProductionManager = roles.includes("production_manager");

  // Resolve customer_id for portal users (they should only see their own orders)
  const { data: myCustomerId } = useQuery({
    queryKey: ["my-customer-id", user?.id],
    queryFn: async () => {
      if (!user) return null;
      // Look up which customer profile is linked to this user
      // In production, this would come from a user_customers mapping table
      // For now, we check if the user's email matches any customer contact_email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();
      if (profile?.email) {
        const { data: matched } = await supabase
          .from("customers")
          .select("id")
          .eq("contact_email", profile.email)
          .maybeSingle();
        return matched?.id ?? null;
      }
      // Fallback: check the user's customer_id from their customer profile
      return null;
    },
    enabled: !!user && isCustomer,
  });

  // Fetch sales orders with customer info — scoped per role
  const { data: salesOrders } = useQuery({
    queryKey: ["orders-sales", companyId, isCustomer ? myCustomerId : "all"],
    queryFn: async () => {
      let query = supabase.from("sales_orders").select(`
        *,
        customers!inner(name, contact_email),
        sales_order_items(
          id,
          quantity,
          unit_price,
          product_id,
          products(name)
        )
      `);

      // DATA ISOLATION: Customer portal users only see their own orders
      if (isCustomer && myCustomerId) {
        query = query.eq("customer_id", myCustomerId);
      }

      const { data } = await query.order("created_at", { ascending: false });
      return (data ?? []).map((so: any) => {
        const item = so.sales_order_items?.[0];
        const productName = item?.products?.name ?? "Custom Furniture Order";
        const quantity = item?.quantity ?? 0;
        return {
          ...so,
          customer_name: so.customers?.name ?? "Unknown Customer",
          customer_email: so.customers?.contact_email ?? "",
          product_name: productName,
          quantity: quantity,
        };
      });
    },
    enabled: !!companyId && (!isCustomer || myCustomerId !== undefined),
  });

  // Fetch production orders linked to sales orders
  const { data: prodOrders } = useQuery({
    queryKey: ["orders-prod", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Fetch order status history
  const { data: statusHistory } = useQuery({
    queryKey: ["orders-history", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("order_status_history")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Fetch shipments for orders
  const { data: shipments } = useQuery({
    queryKey: ["orders-shipments", companyId],
    queryFn: async () =>
      (await supabase.from("shipments").select("*").order("created_at", { ascending: false }))
        .data ?? [],
    enabled: !!companyId,
  });

  // Fetch invoices for orders
  const { data: invoices } = useQuery({
    queryKey: ["orders-invoices", companyId],
    queryFn: async () =>
      (await supabase.from("invoices").select("*").order("issue_date", { ascending: false }))
        .data ?? [],
    enabled: !!companyId,
  });

  // Create order mutation
  // Total amount is auto-calculated from quantity × unit_price; never taken from form input
  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const now = new Date().toISOString();
      const customerId = isCustomer ? myCustomerId : formData.customer_id;
      if (!customerId) throw new Error("No customer associated with this account.");

      if (!formData.product_id) throw new Error("Please select a product.");
      const qty = parseFloat(formData.quantity) || 1;

      // Resolve unit price from product catalog
      const selectedProd = productList?.find((p: any) => p.id === formData.product_id);
      const unitPrice = selectedProd ? Number(selectedProd.unit_price) : 0;
      const calculatedTotal = qty * unitPrice;

      const soNumber = formData.so_number?.trim() || `SO-${Date.now().toString().slice(-6)}`;

      // Customers submit with pending_approval and no priority/due_date (admin sets those)
      const { data: inserted, error } = await supabase
        .from("sales_orders")
        .insert({
          company_id: companyId!,
          so_number: soNumber,
          customer_id: customerId,
          status: "pending_approval",
          // Priority + due_date: admins set at approval; customers default to medium/null
          priority: isCustomer ? "medium" : (formData.priority || "medium"),
          total_amount: calculatedTotal,           // ← auto-calculated
          order_date: now,
          due_date: isCustomer ? null : (formData.due_date || null),
          progress: 0,
          notes: formData.notes || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Insert order line item
      if (inserted) {
        const { error: itemErr } = await supabase
          .from("sales_order_items")
          .insert({
            company_id: companyId!,
            sales_order_id: inserted.id,
            product_id: formData.product_id,
            quantity: qty,
            unit_price: unitPrice,
            line_total: calculatedTotal,
          });
        if (itemErr) throw itemErr;
      }

      // Notify Company Admin of new order
      if (inserted && companyId) {
        const customerName =
          customerList?.find((c: any) => c.id === customerId)?.name ?? "Customer";
        await notifyNewOrder(companyId, soNumber, customerName, inserted.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-sales"] });
      toast.success("Order submitted for approval!");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Approve order mutation (Company Admin / Production Admin)
  // Sets priority + due_date on the order before approving
  const approveMutation = useMutation({
    mutationFn: async ({
      orderId,
      priority,
      dueDate,
    }: {
      orderId: string;
      priority: string;
      dueDate: string;
    }) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      setApproving(orderId);
      const order = salesOrders?.find((o: any) => o.id === orderId);
      if (!order) throw new Error("Order not found");

      // Write priority + due_date set by admin before approving
      const { error: updateErr } = await supabase
        .from("sales_orders")
        .update({
          priority,
          due_date: dueDate || null,
        })
        .eq("id", orderId);
      if (updateErr) throw updateErr;

      // Update status + record history
      await approveCustomerOrder(orderId, companyId, user.id, order.customer_id);

      // Notify Customer + Production Manager
      const customerUserId = await getCustomerUserId(order.customer_id);
      await notifyOrderApproved(companyId, order.so_number, customerUserId ?? "", orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-sales"] });
      queryClient.invalidateQueries({ queryKey: ["orders-history"] });
      toast.success("Order approved — priority & due date set, customer notified.");
      setApproving(null);
      setApproveDialog({ open: false, orderId: "" });
      setApprovePriority("medium");
      setApproveDueDate("");
    },
    onError: (err: any) => {
      toast.error(err.message);
      setApproving(null);
    },
  });

  // Reject order mutation (Company Admin action)
  const rejectMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      setRejecting(orderId);
      const order = salesOrders?.find((o: any) => o.id === orderId);
      if (!order) throw new Error("Order not found");

      // Update status + record history (preserves order_status_history tracking)
      await rejectCustomerOrder(orderId, companyId, user.id, reason);

      // Fire notification to Customer only
      const customerUserId = await getCustomerUserId(order.customer_id);
      await notifyOrderRejected(companyId, order.so_number, customerUserId ?? "", reason, orderId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-sales"] });
      queryClient.invalidateQueries({ queryKey: ["orders-history"] });
      toast.success("Order rejected — Customer notified");
      setRejectDialog({ open: false, orderId: "" });
      setRejectReason("");
      setRejecting(null);
    },
    onError: (err: any) => {
      toast.error(err.message);
      setRejecting(null);
    },
  });

  // Merge data
  const rows = (salesOrders ?? []).map((so: any) => {
    const prodOrdersForSo = prodOrders?.filter((po: any) => po.sales_order_id === so.id) ?? [];
    const soShipments = shipments?.filter((s: any) => s.sales_order_id === so.id) ?? [];
    const soInvoices = invoices?.filter((i: any) => i.sales_order_id === so.id) ?? [];
    const soHistory = statusHistory?.filter((h: any) => h.order_id === so.id) ?? [];
    return {
      ...so,
      production_orders: prodOrdersForSo,
      shipments: soShipments,
      invoices: soInvoices,
      status_history: soHistory,
      progress:
        so.progress ??
        (so.status === "completed"
          ? 100
          : so.status === "delivered"
            ? 100
            : so.status === "dispatch_ready"
              ? 85
              : so.status === "quality_passed"
                ? 70
                : so.status === "in_production"
                  ? 30
                  : so.status === "approved"
                    ? 10
                    : 0),
    };
  });

  const pendingApproval = rows.filter((r: any) => r.status === "pending_approval").length;
  const inProd = rows.filter(
    (r: any) => r.status === "in_production" || r.status === "approved",
  ).length;
  const delivered = rows.filter(
    (r: any) => r.status === "delivered" || r.status === "completed",
  ).length;
  const totalRevenue = rows.reduce((s: number, r: any) => s + Number(r.total_amount ?? 0), 0);
  const rejected = rows.filter((r: any) => r.status === "rejected").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ResourceView
        eyebrow="Sales"
        title="Orders"
        sub="Sales orders, delivery tracking and customer fulfillment."
        moduleName="orders"
        rows={rows}
        searchKeys={["so_number", "customer_name", "status", "priority"]}
        formFields={
          isCustomer
            ? getOrderFormFields(customerList ?? [], productList ?? [], isCustomer)
            : undefined
        }
        onSubmit={async (formData) => {
          await createMutation.mutateAsync(formData);
        }}
        extraActions={
          <>
            {pendingApproval > 0 && isCompanyAdmin && (
              <Button variant="outline" className="border-amber-500/30 text-amber-400">
                <AlertTriangle className="h-4 w-4 mr-1.5" />
                {pendingApproval} Pending
              </Button>
            )}
          </>
        }
        kpis={
          <>
            <Kpi
              label="Total Orders"
              value={String(rows.length)}
              icon={ShoppingCart}
              tone="primary"
            />
            <Kpi
              label="Pending Approval"
              value={String(pendingApproval)}
              icon={Clock}
              tone="warning"
            />
            <Kpi label="In Production" value={String(inProd)} icon={Truck} tone="info" />
            <Kpi label="Delivered" value={String(delivered)} icon={CheckCircle2} tone="success" />
            <Kpi
              label="Revenue"
              value={fmtMoneyK(totalRevenue)}
              icon={DollarSign}
              tone="primary"
            />
            {rejected > 0 && (
              <Kpi
                label="Rejected"
                value={String(rejected)}
                icon={AlertTriangle}
                tone="destructive"
              />
            )}
          </>
        }
        columns={[
          {
            key: "so_number",
            header: "Order #",
            render: (r: any) => <span className="font-medium">{r.so_number}</span>,
          },
          {
            key: "customer_name",
            header: "Customer",
            render: (r: any) => <span className="text-sm">{r.customer_name ?? "—"}</span>,
          },
          {
            key: "product_name",
            header: "Product",
            render: (r: any) => <span className="text-sm">{r.product_name ?? "—"}</span>,
          },
          {
            key: "total_amount",
            header: "Amount",
            hideOnMobile: true,
            render: (r: any) => (
              <span className="font-mono text-xs">
                {fmtMoney(r.total_amount)}
              </span>
            ),
          },
          {
            key: "priority",
            header: "Priority",
            render: (r: any) => <StatusBadge status={r.priority} />,
          },
          {
            key: "status",
            header: "Status",
            render: (r: any) => (
              <div className="flex items-center gap-2">
                <StatusBadge status={r.status} />
                {r.status === "pending_approval" && (isCompanyAdmin || isProductionManager) && (
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-success"
                      onClick={(e) => {
                        e.stopPropagation();
                        setApproveDialog({ open: true, orderId: r.id });
                      }}
                      disabled={approving === r.id}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 w-6 p-0 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        setRejectDialog({ open: true, orderId: r.id });
                      }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            ),
          },
          {
            key: "progress",
            header: "Progress",
            render: (r: any) => (
              <div className="flex items-center gap-2 w-28">
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div
                    className="h-full bg-[image:var(--gradient-primary)]"
                    style={{ width: `${r.progress}%` }}
                  />
                </div>
                <span className="tabular-nums text-xs w-8 text-right">{r.progress}%</span>
              </div>
            ),
          },
          {
            key: "due_date",
            header: "Due",
            hideOnMobile: true,
            render: (r: any) => (r.due_date ? new Date(r.due_date).toLocaleDateString() : "—"),
          },
        ]}
      />

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialog.open}
        onOpenChange={(o) => setRejectDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Reject Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs text-muted-foreground">Reason for rejection *</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Insufficient credit, delivery timeline not feasible..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, orderId: "" })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() =>
                rejectMutation.mutate({ orderId: rejectDialog.orderId, reason: rejectReason })
              }
              disabled={!rejectReason.trim() || rejecting === rejectDialog.orderId}
            >
              {rejecting === rejectDialog.orderId ? "Rejecting..." : "Reject Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve Dialog — Admin sets priority + due date before confirming */}
      <Dialog
        open={approveDialog.open}
        onOpenChange={(o) => setApproveDialog((d) => ({ ...d, open: o }))}
      >
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Approve Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Set the <strong>priority</strong> and <strong>due date</strong> before approving.
              The total amount has been auto-calculated from product price × quantity.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="approve-priority">Priority *</Label>
              <select
                id="approve-priority"
                className="w-full rounded-md border border-white/10 bg-background px-3 py-2 text-sm"
                value={approvePriority}
                onChange={(e) => setApprovePriority(e.target.value)}
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="approve-due-date">Due Date *</Label>
              <Input
                id="approve-due-date"
                type="date"
                value={approveDueDate}
                onChange={(e) => setApproveDueDate(e.target.value)}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog({ open: false, orderId: "" })}>
              Cancel
            </Button>
            <Button
              onClick={() =>
                approveMutation.mutate({
                  orderId: approveDialog.orderId,
                  priority: approvePriority,
                  dueDate: approveDueDate,
                })
              }
              disabled={!approveDueDate || approving === approveDialog.orderId}
            >
              {approving === approveDialog.orderId ? "Approving..." : "Approve Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
