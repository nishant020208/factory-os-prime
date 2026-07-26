import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, Truck, CheckCircle2, Clock, DollarSign, AlertTriangle, FileText, Send, Eye, Download, Search as SearchIcon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { approveCustomerOrder, rejectCustomerOrder } from "@/lib/order-lifecycle";

export const Route = createFileRoute("/_authenticated/orders")({
  head: () => ({ meta: [
    { title: "Orders — FactoryOS AI" },
    { name: "description", content: "Sales orders, delivery tracking and customer fulfillment." },
  ]}),
  component: OrdersPage,
});

// Dynamic order form fields - customer dropdown is populated from DB
function getOrderFormFields(customers: any[]): FormField[] {
  return [
    { key: "so_number", label: "Order Number", type: "text", placeholder: "SO-2026-001", required: true },
    { key: "customer_id", label: "Customer", type: "select", placeholder: "Select customer", required: true,
      options: (customers ?? []).map((c: any) => ({ value: c.id, label: c.name })) },
    { key: "product_name", label: "Product / Description", type: "text", placeholder: "Product name or description", required: true },
    { key: "quantity", label: "Quantity", type: "number", placeholder: "100", required: true },
    { key: "total_amount", label: "Total Amount ($)", type: "number", placeholder: "5000", required: true },
    { key: "priority", label: "Priority", type: "select", defaultValue: "medium", options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "critical", label: "Critical" },
    ]},
    { key: "due_date", label: "Delivery Date", type: "date" },
    { key: "notes", label: "Notes", type: "textarea" },
  ];
}

function OrdersPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; orderId: string; }>({ open: false, orderId: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [approving, setApproving] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);

  // Fetch customers for dropdown
  const { data: customerList } = useQuery({
    queryKey: ["order-customers", companyId],
    queryFn: async () => (await supabase.from("customers").select("id,name").eq("status", "active").order("name")).data ?? [],
    enabled: !!companyId,
  });

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
      let query = supabase
        .from("sales_orders")
        .select("*, customers!inner(name, contact_email)");

      // DATA ISOLATION: Customer portal users only see their own orders
      if (isCustomer && myCustomerId) {
        query = query.eq("customer_id", myCustomerId);
      }

      const { data } = await query.order("created_at", { ascending: false });
      return (data ?? []).map((so: any) => ({
        ...so,
        customer_name: so.customers?.name ?? "Unknown Customer",
        customer_email: so.customers?.contact_email ?? "",
        product_name: so.id?.slice(0, 8) ?? "—",
      }));
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
    queryFn: async () => (await supabase.from("shipments").select("*").order("created_at", { ascending: false })).data ?? [],
    enabled: !!companyId,
  });

  // Fetch invoices for orders
  const { data: invoices } = useQuery({
    queryKey: ["orders-invoices", companyId],
    queryFn: async () => (await supabase.from("invoices").select("*").order("issue_date", { ascending: false })).data ?? [],
    enabled: !!companyId,
  });      // Create order mutation
  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const now = new Date().toISOString();
      const customerId = formData.customer_id;
      if (!customerId) throw new Error("Please select a customer");
      const { error } = await supabase.from("sales_orders").insert({
        company_id: companyId!,
        so_number: formData.so_number || `SO-${Date.now().toString().slice(-6)}`,
        customer_id: customerId,
        status: "pending_approval",
        priority: formData.priority || "medium",
        total_amount: parseFloat(formData.total_amount) || 0,
        order_date: now,
        due_date: formData.due_date || null,
        progress: 0,
        notes: formData.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-sales"] });
      toast.success("Order submitted for approval");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Approve order mutation (Company Admin action)
  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      setApproving(orderId);
      const order = salesOrders?.find((o: any) => o.id === orderId);
      const customerId = order?.customer_id;
      await approveCustomerOrder(orderId, companyId, user.id, customerId);
      // Create a notification for production manager
      await supabase.from("notifications").insert({
        company_id: companyId,
        title: "New Approved Order - Production Action Needed",
        body: `Order ${order?.so_number} has been approved. Please create a production order.`,
        severity: "info",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-sales"] });
      queryClient.invalidateQueries({ queryKey: ["orders-history"] });
      toast.success("Order approved and production notified");
      setApproving(null);
    },
    onError: (err: any) => { toast.error(err.message); setApproving(null); },
  });

  // Reject order mutation (Company Admin action)
  const rejectMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      if (!companyId || !user) throw new Error("Not authenticated");
      setRejecting(orderId);
      await rejectCustomerOrder(orderId, companyId, user.id, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders-sales"] });
      queryClient.invalidateQueries({ queryKey: ["orders-history"] });
      toast.success("Order has been rejected");
      setRejectDialog({ open: false, orderId: "" });
      setRejectReason("");
      setRejecting(null);
    },
    onError: (err: any) => { toast.error(err.message); setRejecting(null); },
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
      progress: so.progress ?? (so.status === "completed" ? 100 : so.status === "delivered" ? 100 : so.status === "dispatch_ready" ? 85 : so.status === "quality_passed" ? 70 : so.status === "in_production" ? 30 : so.status === "approved" ? 10 : 0),
    };
  });

  const isCompanyAdmin = roles.includes("company_admin");
  const isCustomer = roles.includes("customer_portal");
  const isProductionManager = roles.includes("production_manager");
  const pendingApproval = rows.filter((r: any) => r.status === "pending_approval").length;
  const inProd = rows.filter((r: any) => r.status === "in_production" || r.status === "approved").length;
  const delivered = rows.filter((r: any) => r.status === "delivered" || r.status === "completed").length;
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
        formFields={isCustomer ? getOrderFormFields(customerList ?? []) : undefined}
        onSubmit={async (formData) => {
          await createMutation.mutateAsync(formData);
        }}
        extraActions={
          <>
            {pendingApproval > 0 && isCompanyAdmin && (
              <Button variant="outline" className="border-amber-500/30 text-amber-400">
                <AlertTriangle className="h-4 w-4 mr-1.5" />{pendingApproval} Pending
              </Button>
            )}
          </>
        }
        kpis={
          <>
            <Kpi label="Total Orders" value={String(rows.length)} icon={ShoppingCart} tone="primary" />
            <Kpi label="Pending Approval" value={String(pendingApproval)} icon={Clock} tone="warning" />
            <Kpi label="In Production" value={String(inProd)} icon={Truck} tone="info" />
            <Kpi label="Delivered" value={String(delivered)} icon={CheckCircle2} tone="success" />
            <Kpi label="Revenue" value={`$${(totalRevenue / 1000).toFixed(0)}k`} icon={DollarSign} tone="primary" />
            {rejected > 0 && <Kpi label="Rejected" value={String(rejected)} icon={AlertTriangle} tone="destructive" />}
          </>
        }
        columns={[
          { key: "so_number", header: "Order #", render: (r: any) => <span className="font-medium">{r.so_number}</span> },
          { key: "customer_name", header: "Customer", render: (r: any) => <span className="text-sm">{r.customer_name ?? "—"}</span> },
          { key: "total_amount", header: "Amount", hideOnMobile: true, render: (r: any) => <span className="font-mono text-xs">${Number(r.total_amount ?? 0).toLocaleString()}</span> },
          { key: "priority", header: "Priority", render: (r: any) => <StatusBadge status={r.priority} /> },
          { key: "status", header: "Status", render: (r: any) => (
            <div className="flex items-center gap-2">
              <StatusBadge status={r.status} />
              {r.status === "pending_approval" && isCompanyAdmin && (
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-success"
                    onClick={(e) => { e.stopPropagation(); approveMutation.mutate(r.id); }}
                    disabled={approving === r.id}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-destructive"
                    onClick={(e) => { e.stopPropagation(); setRejectDialog({ open: true, orderId: r.id }); }}
                  >
                    <AlertTriangle className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
          )},
          { key: "progress", header: "Progress", render: (r: any) => (
            <div className="flex items-center gap-2 w-28">
              <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${r.progress}%` }} />
              </div>
              <span className="tabular-nums text-xs w-8 text-right">{r.progress}%</span>
            </div>
          )},
          { key: "due_date", header: "Due", hideOnMobile: true, render: (r: any) => r.due_date ? new Date(r.due_date).toLocaleDateString() : "—" },
        ]}
      />

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => setRejectDialog(d => ({ ...d, open: o }))}>
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
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, orderId: "" })}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => rejectMutation.mutate({ orderId: rejectDialog.orderId, reason: rejectReason })}
              disabled={!rejectReason.trim() || rejecting === rejectDialog.orderId}
            >
              {rejecting === rejectDialog.orderId ? "Rejecting..." : "Reject Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
