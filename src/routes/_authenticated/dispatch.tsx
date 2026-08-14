import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Truck,
  Package,
  CheckCircle2,
  Clock,
  QrCode,
  Loader2,
  PackageCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
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
import { notifyDispatchReady, notifyShipmentUpdate } from "@/lib/notifications";
import { toast } from "sonner";
import { useState } from "react";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({
    meta: [
      { title: "Dispatch — FactoryOS AI" },
      { name: "description", content: "Outbound dispatch, shipment tracking and delivery management." },
    ],
  }),
  component: DispatchPage,
});

function DispatchPage() {
  const queryClient = useQueryClient();
  const { companyId, user } = useAuth();
  const [showShip, setShowShip] = useState(false);
  const [form, setForm] = useState({
    sales_order_id: "",
    carrier: "Express Logistics",
    tracking_number: "",
    destination: "",
    expected_arrival: "",
  });

  // Real packed finished goods (a packing row exists for the FG entry)
  const { data: packed } = useQuery({
    queryKey: ["dispatch-packed", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("finished_goods")
        .select("*, packing(package_number, package_qr_url)")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Real shipments
  const { data: shipments, isLoading } = useQuery({
    queryKey: ["dispatch-shipments", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("shipments")
          .select("*, sales_orders(so_number), customers(name)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  // Customer orders that reached production — candidates for dispatch
  const { data: orders } = useQuery({
    queryKey: ["dispatch-orders", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("sales_orders")
        .select("id, so_number, customers(name, user_id)")
        .in("status", ["in_production", "shipped", "completed"])
        .eq("company_id", companyId!);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const packCount = (packed ?? []).filter((g) => (g as any).packing?.length).length;
  const inTransit = shipments?.filter((s) => ["dispatch_ready", "in_transit", "out_for_delivery"].includes(s.status)).length ?? 0;
  const delivered = shipments?.filter((s) => s.status === "delivered").length ?? 0;

  const createShipment = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      if (!form.sales_order_id) throw new Error("Select the customer order to dispatch");
      if (!form.tracking_number.trim()) throw new Error("Tracking number is required");

      const order = (orders ?? []).find((o: any) => o.id === form.sales_order_id) as any;
      const shipmentNumber = `SHP-${new Date().getFullYear()}-${String(
        Date.now() % 100000,
      ).padStart(5, "0")}`;

      // 1) Create the shipment
      const { data: ship, error: shipErr } = await supabase
        .from("shipments")
        .insert({
          company_id: companyId,
          shipment_number: shipmentNumber,
          sales_order_id: form.sales_order_id,
          customer_id: order?.customers?.id ?? null,
          carrier: form.carrier,
          tracking_number: form.tracking_number,
          destination: form.destination || null,
          status: "dispatch_ready",
          shipped_date: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (shipErr) throw shipErr;

      // 2) Generate the Shipment QR (token → URL)
      const { data: qr, error: qrErr } = await supabase
        .from("qr_codes")
        .insert({
          company_id: companyId,
          entity_type: "shipment",
          entity_id: ship.id,
          type: "shipment",
          status: "active",
          qr_data: shipmentNumber,
          label: shipmentNumber,
          sub_label: `${form.carrier} · ${form.tracking_number}`,
        })
        .select("token")
        .single();
      if (qrErr) throw qrErr;

      // 3) Reflect in the customer's tracking view
      await supabase
        .from("sales_orders")
        .update({ status: "shipped" })
        .eq("id", form.sales_order_id);

      // 4) Notify Finance + the specific Customer
      await notifyDispatchReady(companyId, order?.so_number ?? shipmentNumber, ship.id);
      const customerUser = order?.customers?.user_id ?? null;
      if (customerUser) {
        await notifyShipmentUpdate(companyId, order?.so_number ?? shipmentNumber, customerUser, "dispatch_ready", ship.id);
      }

      return { shipmentNumber, scanUrl: `${window.location.origin}/scan?t=${qr.token}` };
    },
    onSuccess: (r) => {
      queryClient.invalidateQueries();
      toast.success(`Shipment ${r.shipmentNumber} created — QR generated & customer notified`);
      setShowShip(false);
      setForm({
        sales_order_id: "",
        carrier: "Express Logistics",
        tracking_number: "",
        destination: "",
        expected_arrival: "",
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const advanceStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("shipments").update({ status }).eq("id", id);
      if (error) throw error;
      return status;
    },
    onSuccess: (status) => {
      queryClient.invalidateQueries({ queryKey: ["dispatch-shipments"] });
      toast.success(`Shipment marked ${status.replace(/_/g, " ")}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const viewQr = async (shipmentId: string, label: string) => {
    const { data } = await supabase
      .from("qr_codes")
      .select("token")
      .eq("entity_id", shipmentId)
      .eq("type", "shipment")
      .maybeSingle();
    if (data?.token) window.open(`${window.location.origin}/scan?t=${data.token}`, "_blank");
    else toast.info("Shipment QR not found for this shipment");
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="dispatch" />
      <PageHeader
        eyebrow="Logistics"
        title="Dispatch & Shipping"
        sub="Outbound shipment management, carrier tracking and delivery confirmations."
        actions={
          <>
            <ModuleCopilot moduleName="dispatch" />
            <Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowShip(true)}>
              <Truck className="h-4 w-4 mr-1.5" />
              Create Shipment
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Packed Batches" value={String(packCount)} icon={PackageCheck} tone="primary" />
        <Kpi label="In Transit / Ready" value={String(inTransit)} icon={Truck} tone="info" />
        <Kpi label="Delivered" value={String(delivered)} icon={CheckCircle2} tone="success" />
        <Kpi label="Total Shipments" value={String(shipments?.length ?? 0)} icon={Package} tone="warning" />
      </div>

      {/* Create shipment dialog */}
      <Dialog open={showShip} onOpenChange={setShowShip}>
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle>Create Shipment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Customer Order *</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.sales_order_id}
                onChange={(e) => setForm((f) => ({ ...f, sales_order_id: e.target.value }))}
              >
                <option value="">Select order to dispatch…</option>
                {(orders ?? []).map((o: any) => (
                  <option key={o.id} value={o.id}>
                    {o.so_number} — {o.customers?.name ?? "Customer"}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Courier *</Label>
              <Input
                value={form.carrier}
                onChange={(e) => setForm((f) => ({ ...f, carrier: e.target.value }))}
                placeholder="Express Logistics"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Tracking Number *</Label>
              <Input
                value={form.tracking_number}
                onChange={(e) => setForm((f) => ({ ...f, tracking_number: e.target.value }))}
                placeholder="TRK-2026-0001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Destination</Label>
              <Input
                value={form.destination}
                onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))}
                placeholder="Kochi, Kerala"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expected Arrival</Label>
              <Input
                type="date"
                value={form.expected_arrival}
                onChange={(e) => setForm((f) => ({ ...f, expected_arrival: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowShip(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createShipment.mutate()}
              disabled={createShipment.isPending}
            >
              {createShipment.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Create & Generate QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Panel title={`${shipments?.length ?? 0} Shipments`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading shipments…
          </div>
        ) : (shipments ?? []).length === 0 ? (
          <EmptyState title="No shipments yet" sub="Create your first shipment to generate its QR and notify the customer." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["Shipment #", "Order", "Customer", "Carrier", "Tracking", "Destination", "Status", "QR", "Actions"].map(
                    (h) => (
                      <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {h}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(shipments ?? []).map((s) => {
                  const order = s.sales_orders as unknown as { so_number?: string } | null;
                  const customer = s.customers as unknown as { name?: string } | null;
                  return (
                    <TableRow key={s.id} className="border-white/5">
                      <TableCell className="font-mono text-xs font-medium">{s.shipment_number}</TableCell>
                      <TableCell className="text-xs">{order?.so_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">{customer?.name ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.carrier ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{s.tracking_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">{s.destination ?? "—"}</TableCell>
                      <TableCell>
                        <StatusBadge status={s.status} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400" onClick={() => viewQr(s.id, s.shipment_number)}>
                          <QrCode className="h-3 w-3 mr-1" /> QR
                        </Button>
                      </TableCell>
                      <TableCell>
                        {s.status === "dispatch_ready" && (
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => advanceStatus.mutate({ id: s.id, status: "out_for_delivery" })}
                            disabled={advanceStatus.isPending}
                          >
                            <Truck className="h-3 w-3 mr-1" /> Dispatch
                          </Button>
                        )}
                        {s.status === "out_for_delivery" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => advanceStatus.mutate({ id: s.id, status: "delivered" })}
                            disabled={advanceStatus.isPending}
                          >
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Delivered
                          </Button>
                        )}
                        {s.status === "delivered" && (
                          <span className="text-xs text-muted-foreground">{safeDate(s.delivered_date ?? "")}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      <div className="mt-4">
        <Panel title="Packed Finished Goods">
          {(packed ?? []).length === 0 ? (
            <EmptyState title="No finished goods yet" sub="Batches that pass Quality inspection appear here, ready to pack and dispatch." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-white/5">
                    {["Product", "Quantity", "Package #", "Received", "Status"].map((h) => (
                      <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {h}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(packed ?? []).map((g) => {
                    const pack = (g as any).packing?.[0] as { package_number?: string } | undefined;
                    return (
                      <TableRow key={g.id} className="border-white/5">
                        <TableCell className="text-sm font-medium">{g.product}</TableCell>
                        <TableCell className="tabular-nums">{Number(g.quantity).toLocaleString()}</TableCell>
                        <TableCell className="font-mono text-xs">{pack?.package_number ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{safeDate(g.created_at)}</TableCell>
                        <TableCell>
                          <StatusBadge status={pack ? "packed" : "in_stock"} />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
