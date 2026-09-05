import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Truck, QrCode, PackageCheck, Clock, Loader2, Eye, Download, Copy } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";

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
        return { id: byUser.data.id as string, name: (byUser.data.name as string) ?? "Your company" };
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
        return sup?.id ? { id: sup.id as string, name: (sup.name as string) ?? "Your company" } : null;
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

  const dispatched =
    deliveries?.filter((d) => d.status === "dispatched").length ?? 0;
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
        <Kpi label="Total Shipments" value={String(deliveries?.length ?? 0)} icon={Clock} tone="primary" />
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
                  {["PO #", "Dispatch Date", "Carrier", "Vehicle", "Tracking", "Expected Arrival", "Status", "QR"].map(
                    (h) => (
                      <TableHead
                        key={h}
                        className="text-[11px] uppercase tracking-wider text-muted-foreground"
                      >
                        {h}
                      </TableHead>
                    ),
                  )}
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
                      <TableCell className="text-xs font-mono">{d.tracking_number ?? "—"}</TableCell>
                      <TableCell className="text-xs">
                        {d.expected_arrival ? new Date(d.expected_arrival).toLocaleDateString() : "—"}
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

      {/* QR Dialog */}
      <Dialog open={qrDialog.open} onOpenChange={(o) => setQrDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[380px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-4 w-4 text-primary" />
              Inbound Shipment QR Code
            </DialogTitle>
          </DialogHeader>
          {qrDialog.delivery && (
            <div className="flex flex-col items-center gap-4 py-2">
              <div className="bg-white rounded-2xl p-4 shadow-lg flex items-center justify-center">
                {qrDialog.loading ? (
                  <div className="w-48 h-48 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                  </div>
                ) : qrDialog.scanUrl ? (
                  <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrDialog.scanUrl)}`}
                    alt="Inbound Shipment QR Code"
                    className="w-48 h-48 rounded-lg object-contain"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center text-xs text-muted-foreground text-center p-4">
                    QR code not available for this shipment
                  </div>
                )}
              </div>

              <div className="text-center space-y-1">
                <div className="font-semibold">
                  {qrDialog.delivery.purchase_orders?.po_number ?? "Shipment"}
                </div>
                <div className="text-xs text-muted-foreground">
                  Status: <StatusBadge status={qrDialog.delivery.status} />
                </div>
                {qrDialog.delivery.tracking_number && (
                  <div className="text-[11px] text-muted-foreground font-mono">
                    Tracking: {qrDialog.delivery.tracking_number}
                  </div>
                )}
              </div>

              {qrDialog.scanUrl && (
                <div className="w-full rounded-lg bg-muted/50 border border-border px-3 py-2 flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground flex-1 truncate font-mono">
                    {qrDialog.scanUrl}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 shrink-0"
                    onClick={() => {
                      navigator.clipboard.writeText(qrDialog.scanUrl!);
                      toast.success("Scan link copied!");
                    }}
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              )}

              <p className="text-[10px] text-muted-foreground text-center max-w-xs">
                Scan with any phone camera — no app needed. Links to the warehouse receipt and verification page.
              </p>

              <div className="flex gap-2">
                {qrDialog.scanUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(qrDialog.scanUrl!, "_blank")}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    Preview
                  </Button>
                )}
                {qrDialog.scanUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const link = document.createElement("a");
                      link.href = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&margin=0&data=${encodeURIComponent(qrDialog.scanUrl!)}`;
                      const name = qrDialog.delivery.purchase_orders?.po_number ?? "shipment";
                      link.download = `qr-shipment-${name}.png`;
                      link.click();
                      toast.success("QR code downloaded");
                    }}
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
