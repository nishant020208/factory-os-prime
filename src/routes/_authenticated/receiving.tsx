import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PackageOpen, CheckCircle2, ScanLine, Loader2, ArrowRight, Warehouse, ShieldAlert } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar } from "@/components/module-status";
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
import { fmtMoney } from "@/lib/currency";
import { safeDate } from "@/lib/utils";
import { recordMaterialArrivalAndRequestQC } from "@/lib/warehouse-qc";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/receiving")({
  head: () => ({
    meta: [
      { title: "Receiving — FactoryOS AI" },
      { name: "description", content: "Goods inward and receiving inspection" },
    ],
  }),
  component: ReceivingPage,
});

function ReceivingPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [receivingPoId, setReceivingPoId] = useState<string | null>(null);

  const { data: pos, isLoading, refetch } = useQuery({
    queryKey: ["receiving-pos", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name), supplier_deliveries(carrier, tracking_number, expected_arrival), warehouses:delivery_warehouse_id(name, code)")
        .in("status", ["accepted", "dispatched", "received", "fulfilled"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const receiveMutation = useMutation({
    mutationFn: async (poId: string) => {
      setReceivingPoId(poId);
      const userRes = await supabase.auth.getUser();
      const res = await recordMaterialArrivalAndRequestQC({
        companyId: companyId!,
        poId,
        receivedBy: userRes.data.user?.id,
      });
      if (!res.success) throw new Error(res.error || "Failed to receive material");
      return res;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["receiving-pos"] });
      queryClient.invalidateQueries({ queryKey: ["grn-pos"] });
      queryClient.invalidateQueries({ queryKey: ["incoming-inspections"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("✅ Materials received & Incoming QC inspection requested!");
      setReceivingPoId(null);
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to receive materials");
      setReceivingPoId(null);
    },
  });

  const awaiting = pos?.filter((p) => ["accepted", "dispatched"].includes(p.status)).length ?? 0;
  const received = pos?.filter((p) => ["received", "fulfilled"].includes(p.status)).length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="receiving" />
      <PageHeader
        eyebrow="Warehouse"
        title="Receiving & Inbound Logistics"
        sub="Inbound goods from suppliers — receive materials to automatically alert Quality Inspectors for incoming inspection."
        actions={
          <Button asChild variant="outline" className="h-9 text-xs">
            <Link to="/goods-receipt">
              <ScanLine className="h-3.5 w-3.5 mr-1.5" />
              Open Goods Receipt & QR
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </Link>
          </Button>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Awaiting Receipt" value={String(awaiting)} icon={PackageOpen} tone="warning" />
        <Kpi label="Received & Inspected" value={String(received)} icon={CheckCircle2} tone="success" />
        <Kpi label="Total Inbound POs" value={String(pos?.length ?? 0)} icon={ScanLine} tone="primary" />
      </div>
      <Panel title={`${pos?.length ?? 0} Inbound Purchase Orders`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (pos ?? []).length === 0 ? (
          <EmptyState title="Nothing inbound" sub="Supplier shipments will appear here once dispatched." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["PO #", "Supplier", "Delivery Warehouse", "Amount", "Carrier / Tracking", "Expected Arrival", "Status", "Action"].map(
                    (h) => (
                      <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {h}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(pos ?? []).map((po) => {
                  const del = (po as any).supplier_deliveries?.[0] as
                    | { carrier?: string; tracking_number?: string; expected_arrival?: string }
                    | undefined;
                  const wh = (po as any).warehouses as { name?: string; code?: string } | null;
                  const canReceive = ["accepted", "dispatched"].includes(po.status);
                  const isReceiving = receivingPoId === po.id;

                  return (
                    <TableRow key={po.id} className="border-white/5">
                      <TableCell className="font-medium font-mono text-xs">
                        {po.po_number ?? po.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(po as any).suppliers?.name ?? "—"}
                      </TableCell>
                      <TableCell>
                        {wh?.name ? (
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <Warehouse className="h-3 w-3 text-muted-foreground" />
                            <span>{wh.name}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">Main Store</span>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {fmtMoney(po.total_amount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {del?.carrier ?? "—"}
                        {del?.tracking_number ? (
                          <span className="ml-2 font-mono">{del.tracking_number}</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs">
                        {del?.expected_arrival
                          ? new Date(del.expected_arrival).toLocaleDateString()
                          : po.expected_date
                            ? new Date(po.expected_date).toLocaleDateString()
                            : "—"}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={po.status} />
                      </TableCell>
                      <TableCell>
                        {canReceive && !isAuditor ? (
                          <Button
                            size="sm"
                            className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white gap-1"
                            disabled={isReceiving}
                            onClick={() => receiveMutation.mutate(po.id)}
                          >
                            {isReceiving ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <PackageOpen className="h-3.5 w-3.5" />
                            )}
                            Receive & Request QC
                          </Button>
                        ) : po.status === "received" ? (
                          <span className="text-xs text-amber-400/90 font-medium inline-flex items-center gap-1">
                            <ShieldAlert className="h-3 w-3" /> QC Pending
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-3 text-[11px] text-muted-foreground">
          Receiving inbound shipments automatically sends inspection requests to the Quality Inspector.
        </div>
      </Panel>
    </div>
  );
}

