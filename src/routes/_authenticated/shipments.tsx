import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  AlertCircle,
  MapPin,
  Search,
  ChevronRight,
  Factory,
  ShoppingCart,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, StatusBadge, PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney } from "@/lib/currency";
import { useState, useMemo } from "react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/shipments")({
  head: () => ({
    meta: [
      { title: "Shipments — FactoryOS AI" },
      { name: "description", content: "Track your shipments and orders in real time" },
    ],
  }),
  component: ShipmentsPage,
});

/** Ordered stages of an order lifecycle */
const ORDER_STAGES = [
  { key: "pending",       label: "Pending",     icon: Clock },
  { key: "confirmed",     label: "Confirmed",   icon: CheckCircle2 },
  { key: "in_production", label: "In Production", icon: Factory },
  { key: "shipped",       label: "Shipped",     icon: Truck },
  { key: "delivered",     label: "Delivered",   icon: CheckCircle2 },
] as const;

type StageKey = (typeof ORDER_STAGES)[number]["key"];

function stageIndex(status: string): number {
  const idx = ORDER_STAGES.findIndex((s) => s.key === status);
  return idx === -1 ? 0 : idx;
}

function StatusTimeline({ status }: { status: string }) {
  const current = stageIndex(status);
  return (
    <div className="flex items-center gap-0 w-full max-w-xs">
      {ORDER_STAGES.map((stage, i) => {
        const done   = i < current;
        const active = i === current;
        return (
          <div key={stage.key} className="flex items-center flex-1 min-w-0">
            <div
              className={`relative flex items-center justify-center h-6 w-6 rounded-full border-2 shrink-0 transition-all ${
                done
                  ? "bg-success border-success text-white"
                  : active
                  ? "bg-primary border-primary text-white shadow-glow"
                  : "bg-muted/40 border-white/10 text-muted-foreground"
              }`}
              title={stage.label}
            >
              <stage.icon className="h-3 w-3" />
            </div>
            {i < ORDER_STAGES.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-0.5 rounded transition-all ${
                  done ? "bg-success" : "bg-white/10"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ShipmentsPage() {
  const { user, roles, companyId } = useAuth();
  const isCustomer = roles.includes("customer_portal");
  const [q, setQ] = useState("");

  // Find this customer's customer_id by matching their email
  const { data: myCustomerId } = useQuery({
    queryKey: ["my-customer-id-shipments", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .single();
      if (profile?.email) {
        const { data: matched } = await supabase
          .from("customers")
          .select("id")
          .or(`contact_email.eq.${profile.email},user_id.eq.${user.id}`)
          .maybeSingle();
        return matched?.id ?? null;
      }
      return null;
    },
    enabled: !!user && isCustomer,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ["shipments-orders", companyId, isCustomer ? myCustomerId : "all"],
    queryFn: async () => {
      let query = supabase
        .from("sales_orders")
        .select(`
          id,
          so_number,
          status,
          total_amount,
          due_date,
          created_at,
          notes,
          priority,
          progress,
          customers!inner(name, contact_email),
          sales_order_items(
            id,
            quantity,
            unit_price,
            products(name)
          )
        `)
        .order("created_at", { ascending: false });

      if (isCustomer && myCustomerId) {
        query = query.eq("customer_id", myCustomerId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []).map((o: any) => ({
        ...o,
        customer_name: o.customers?.name ?? "—",
        product_name:
          o.sales_order_items?.[0]?.products?.name ?? "—",
        quantity: o.sales_order_items?.reduce(
          (sum: number, i: any) => sum + (i.quantity ?? 0),
          0,
        ) ?? 0,
      }));
    },
    enabled: isCustomer ? !!myCustomerId || myCustomerId === null : true,
  });

  const filtered = useMemo(() => {
    if (!orders) return [];
    if (!q.trim()) return orders;
    const s = q.toLowerCase();
    return orders.filter(
      (o: any) =>
        o.so_number?.toLowerCase().includes(s) ||
        o.customer_name?.toLowerCase().includes(s) ||
        o.product_name?.toLowerCase().includes(s) ||
        o.status?.toLowerCase().includes(s),
    );
  }, [orders, q]);

  const shipped    = orders?.filter((o: any) => o.status === "shipped").length ?? 0;
  const delivered  = orders?.filter((o: any) => o.status === "delivered").length ?? 0;
  const inProd     = orders?.filter((o: any) => o.status === "in_production").length ?? 0;
  const pending    = orders?.filter((o: any) => o.status === "pending" || o.status === "confirmed").length ?? 0;

  return (
    <div className="max-w-[1400px] mx-auto">
      <ModuleStatusBar moduleName="shipments" />
      <PageHeader
        eyebrow={isCustomer ? "My Account" : "Logistics"}
        title={isCustomer ? "My Shipments" : "Shipments & Orders"}
        sub={
          isCustomer
            ? "Track where your orders are in real time — from confirmation to delivery."
            : "All customer orders and their current fulfillment stage."
        }
        actions={<ModuleCopilot moduleName="shipments" />}
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="In Transit"   value={String(shipped)}   icon={Truck}        tone="primary" />
        <Kpi label="Delivered"    value={String(delivered)} icon={CheckCircle2} tone="success" />
        <Kpi label="In Production" value={String(inProd)}   icon={Factory}      tone="info" />
        <Kpi label="Pending"      value={String(pending)}   icon={Clock}        tone="warning" />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search by order #, customer, or product…"
          className="pl-9 h-10 bg-background/40"
        />
      </div>

      {/* Orders list */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-20 text-sm animate-pulse">
          Loading shipments…
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-2xl p-14 text-center">
          <Truck className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
          <div className="text-muted-foreground text-sm">
            {isCustomer ? "No shipments found for your account." : "No orders found."}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order: any, idx: number) => (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
              className="glass rounded-2xl p-4 sm:p-5 shadow-card"
            >
              {/* Header row */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/20 grid place-items-center shrink-0">
                    <Package className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm flex items-center gap-2">
                      {order.so_number ?? `ORD-${order.id.slice(0, 6).toUpperCase()}`}
                      {order.priority === "critical" && (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {!isCustomer && (
                        <span className="mr-2 font-medium text-foreground/80">{order.customer_name}</span>
                      )}
                      <span>{order.product_name}</span>
                      {order.quantity > 0 && (
                        <span className="ml-1 text-muted-foreground/60">× {order.quantity}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-right shrink-0">
                  {order.total_amount > 0 && (
                    <span className="font-mono text-sm font-semibold">
                      {fmtMoney(order.total_amount)}
                    </span>
                  )}
                  <StatusBadge status={order.status} />
                </div>
              </div>

              {/* Status timeline */}
              <StatusTimeline status={order.status} />

              {/* Footer row */}
              <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-muted-foreground">
                {order.due_date && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Est. {new Date(order.due_date).toLocaleDateString()}
                  </span>
                )}
                {order.tracking_number && (
                  <span className="flex items-center gap-1 font-mono">
                    <Truck className="h-3 w-3" />
                    {order.tracking_number}
                  </span>
                )}
                {order.notes && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {order.notes}
                  </span>
                )}
                <span className="ml-auto text-[10px]">
                  Ordered {new Date(order.created_at).toLocaleDateString()}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
