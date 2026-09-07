import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Truck, QrCode, PackageCheck, Clock, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
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
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";
import { QrDialog } from "@/components/qr-dialog";

export const Route = createFileRoute("/_authenticated/deliveries")({
  head: () => ({
    meta: [
      { title: "Shipment Details — FactoryOS AI" },
      { name: "description", content: "Inbound shipments you have dispatched" },
    ],
  }),
  component: DeliveriesPage,
});

function DeliveriesPage() {
  const { user, companyId } = useAuth();
  const [qrDialog, setQrDialog] = useState<{
    open: boolean;
    delivery: any | null;
    scanUrl: string | null;
    loading: boolean;
  }>({ open: false, delivery: null, scanUrl: null, loading: false });

  const { data: mySupplier, isLoading: loadingSupplier } = useQuery({
    queryKey: ["my-supplier", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const byUser = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("user_id", user.id)
        .maybeSingle();
      if (byUser.data?.id) {
        return {
          id: byUser.data.id as string,
          name: (byUser.data.name as string) ?? "Your company",
        };
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", user.id)
        .maybeSingle();
      if (profile?.email) {
        const { data: sup } = await supabase
          .from("suppliers")
          .select("id, name")
          .eq("contact_email", profile.email)
          .maybeSingle();
        return sup?.id
          ? { id: sup.id as string, name: (sup.name as string) ?? "Your company" }
          : null;
      }
      return null;
    },
  });

  const { data: deliveries, isLoading } = useQuery({
    queryKey: ["supplier-deliveries", companyId, mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier?.id) return [];
      const { data } = await supabase
        .from("supplier_deliveries")
        .select("*, purchase_orders(po_number)")
        .eq("supplier_id", mySupplier.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!mySupplier?.id,
  });

  const dispatched = deliveries?.filter((d) => d.status === "dispatched").length ?? 0;
  const received = deliveries?.filter((d) => d.status === "received").length ?? 0;

  const openQr = async (delivery: any) => {
    setQrDialog({ open: true, delivery, scanUrl: null, loading: true });
    try {
      const { data } = await supabase
        .from("qr_codes")
        .select("token")
        .eq("entity_id", delivery.po_id)
        .eq("type", "inbound_shipment")
        .maybeSingle();

      if (data?.token) {
        const scanUrl = `${window.location.origin}/scan?t=${data.token}`;
        setQrDialog({ open: true, delivery, scanUrl, loading: false });
      } else {
        setQrDialog({ open: true, delivery, scanUrl: null, loading: false });
        toast.info("Inbound QR not found for this shipment");
      }
    } catch (err: any) {
      toast.error("Failed to load QR: " + err.message);
      setQrDialog({ open: true, delivery, scanUrl: null, loading: false });
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="deliveries" />
      <PageHeader
        eyebrow="Supplier Portal"
        title="Shipment Details"
        sub="Every shipment you have dispatched for the buyer, with its inbound QR for the warehouse."
        actions={<ModuleCopilot moduleName="deliveries" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Dispatched" value={String(dispatched)} icon={Truck} tone="info" />
        <Kpi label="Received" value={String(received)} icon={PackageCheck} tone="success" />
        <Kpi
          label="Total Shipments"
          value={String(deliveries?.length ?? 0)}
          icon={Clock}
          tone="primary"
        />
      </div>

      <Panel title={`${deliveries?.length ?? 0} Inbound Shipments`}>
        {isLoading || loadingSupplier ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading shipments…
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {[
                    "PO #",
                    "Dispatch Date",
                    "Carrier",
                    "Vehicle",
                    "Tracking",
                    "Expected Arrival",
                    "Status",
                    "QR",
                  ].map((h) => (
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
                {(deliveries ?? []).map((d) => {
                  const po = d.purchase_orders as unknown as { po_number?: string } | null;
                  return (
                    <TableRow key={d.id} className="border-white/5">
                      <TableCell className="font-medium">{po?.po_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {d.dispatch_date ? new Date(d.dispatch_date).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell className="text-xs">{d.carrier ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">{d.vehicle_number ?? "—"}</TableCell>
                      <TableCell className="text-xs font-mono">
                        {d.tracking_number ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        {d.expected_arrival
                          ? new Date(d.expected_arrival).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={d.status} />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10"
                          onClick={() => openQr(d)}
                        >
                          <QrCode className="h-3 w-3 mr-1" />
                          QR
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {(deliveries ?? []).length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                      No shipments yet. Accept a PO and submit its Shipment Details to create one.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {/* QR Dialog — shared polished viewer */}
      <QrDialog
        open={qrDialog.open}
        onOpenChange={(o) => setQrDialog((d) => ({ ...d, open: o }))}
        title="Shipment QR"
        reference={
          qrDialog.delivery?.purchase_orders?.po_number ??
          qrDialog.delivery?.shipment_number ??
          "Shipment"
        }
        status={qrDialog.delivery?.status ?? null}
        scanUrl={qrDialog.scanUrl}
        loading={qrDialog.loading}
        downloadName={`qr-shipment-${qrDialog.delivery?.purchase_orders?.po_number ?? "shipment"}`}
      >
        {qrDialog.delivery?.tracking_number && (
          <div className="rounded-lg border border-white/5 bg-muted/30 px-3 py-1.5 text-[11px] font-mono text-muted-foreground">
            Tracking: {qrDialog.delivery.tracking_number}
          </div>
        )}
      </QrDialog>
    </div>
  );
}
