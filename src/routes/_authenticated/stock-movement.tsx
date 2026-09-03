import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDownUp, ArrowRightLeft, PackagePlus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar } from "@/components/module-status";
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

export const Route = createFileRoute("/_authenticated/stock-movement")({
  head: () => ({
    meta: [
      { title: "Stock Movement — FactoryOS AI" },
      { name: "description", content: "Every stock in/out and location change" },
    ],
  }),
  component: StockMovementPage,
});

type MovementRow = {
  id: string;
  type: "adjustment" | "transfer";
  ref: string;
  sku: string;
  product: string;
  from: string;
  to: string;
  delta: number;
  reason: string;
  actor: string;
  created_at: string;
};

function StockMovementPage() {
  const { companyId } = useAuth();

  const { data: adjustments, isLoading: loadingAdj } = useQuery({
    queryKey: ["sm-adjustments", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_adjustments")
        .select("*, products!inner(sku, name), warehouses!inner(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const { data: transfers, isLoading: loadingTr } = useQuery({
    queryKey: ["sm-transfers", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_transfers")
        .select("*, products(sku, name), materials(name), from_wh:warehouses!stock_transfers_from_warehouse_id_fkey(name), to_wh:warehouses!stock_transfers_to_warehouse_id_fkey(name)")
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  const rows: MovementRow[] = [
    ...(adjustments ?? []).map((a: any) => ({
      id: a.id,
      type: "adjustment" as const,
      ref: "ADJ",
      sku: a.products?.sku ?? a.product_id?.slice(0, 8) ?? "—",
      product: a.products?.name ?? "—",
      from: a.warehouses?.name ?? "—",
      to: a.warehouses?.name ?? "—",
      delta: Number(a.delta ?? 0),
      reason: a.reason ?? "—",
      actor: "adjust",
      created_at: a.created_at,
    })),
    ...(transfers ?? []).map((t: any) => ({
      id: t.id,
      type: "transfer" as const,
      ref: "TRF",
      sku: t.products?.sku ?? t.materials?.name ?? t.product_id?.slice(0, 8) ?? "—",
      product: t.products?.name ?? t.materials?.name ?? "—",
      from: t.from_wh?.name ?? "—",
      to: t.to_wh?.name ?? "—",
      delta: Number(t.quantity ?? 0),
      reason: t.status ?? "transfer",
      actor: "transfer",
      created_at: t.created_at,
    })),
  ].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

  const totalIn = rows.filter((r) => r.delta > 0).reduce((s, r) => s + r.delta, 0);
  const totalOut = rows.filter((r) => r.delta < 0).reduce((s, r) => s + Math.abs(r.delta), 0);

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="stock-movement" />
      <PageHeader
        eyebrow="Warehouse"
        title="Stock Movement"
        sub="The single source of truth — every stock in, stock out and location change, with the real actor who logged it."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total Movements" value={String(rows.length)} icon={ArrowDownUp} tone="primary" />
        <Kpi label="Stock In (units)" value={totalIn.toLocaleString()} icon={PackagePlus} tone="success" />
        <Kpi label="Stock Out (units)" value={totalOut.toLocaleString()} icon={ArrowRightLeft} tone="warning" />
        <Kpi label="Transfers" value={String(transfers?.length ?? 0)} icon={ArrowRightLeft} tone="info" />
      </div>
      <Panel title="Movement Ledger">
        {loadingAdj || loadingTr ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading movements…
          </div>
        ) : rows.length === 0 ? (
          <EmptyState title="No movements yet" sub="Stock adjustments and transfers will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["Type", "SKU / Product", "From", "To", "Qty", "Reference / Reason", "Logged"].map(
                    (h) => (
                      <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {h}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id} className="border-white/5">
                    <TableCell>
                      <StatusBadge status={r.type === "adjustment" ? "info" : "active"} />
                    </TableCell>
                    <TableCell>
                      <span className="font-mono text-xs mr-2">{r.sku}</span>
                      <span className="text-sm">{r.product}</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.from}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.to}</TableCell>
                    <TableCell
                      className={`font-mono text-sm tabular-nums ${r.delta >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {r.delta >= 0 ? "+" : ""}
                      {Number(r.delta).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                      {r.reason}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {safeDate(r.created_at, true)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>
    </div>
  );
}
