import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PackageOpen, CheckCircle2, ScanLine, Loader2, ArrowRight } from "lucide-react";
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
import { safeDate } from "@/lib/utils";

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
  const { companyId } = useAuth();

  const { data: pos, isLoading } = useQuery({
    queryKey: ["receiving-pos", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("*, suppliers(name), supplier_deliveries(carrier, tracking_number, expected_arrival)")
        .in("status", ["accepted", "dispatched", "received", "fulfilled"])
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const awaiting = pos?.filter((p) => ["accepted", "dispatched"].includes(p.status)).length ?? 0;
  const received = pos?.filter((p) => ["received", "fulfilled"].includes(p.status)).length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="receiving" />
      <PageHeader
        eyebrow="Warehouse"
        title="Receiving"
        sub="Inbound goods from suppliers — what's on the way and what's been put away. Scan-to-receive lives in Goods Receipt."
        actions={
          <Button asChild variant="outline" className="h-9 text-xs">
            <a href="/goods-receipt">
              <ScanLine className="h-3.5 w-3.5 mr-1.5" />
              Open Goods Receipt
              <ArrowRight className="h-3.5 w-3.5 ml-1.5" />
            </a>
          </Button>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Awaiting Receipt" value={String(awaiting)} icon={PackageOpen} tone="warning" />
        <Kpi label="Received" value={String(received)} icon={CheckCircle2} tone="success" />
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
                  {["PO #", "Supplier", "Amount", "Carrier / Tracking", "Expected Arrival", "Status"].map(
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
                  return (
                    <TableRow key={po.id} className="border-white/5">
                      <TableCell className="font-medium font-mono text-xs">
                        {po.po_number ?? po.id.slice(0, 8)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {(po as any).suppliers?.name ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        ${Number(po.total_amount ?? 0).toLocaleString()}
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
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-3 text-[11px] text-muted-foreground">
          Last updated {safeDate(new Date().toISOString(), true)}
        </div>
      </Panel>
    </div>
  );
}
