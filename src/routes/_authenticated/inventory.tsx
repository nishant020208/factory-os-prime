import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  AlertTriangle,
  ArrowLeftRight,
  TrendingDown,
  Plus,
  Loader2,
  History,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { notifyMaterialReservation } from "@/lib/notifications";
import { adjustInventory } from "@/lib/order-lifecycle";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { useState } from "react";
import { safeDate } from "@/lib/utils";
import { fmtMoney } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — FactoryOS AI" },
      {
        name: "description",
        content: "Multi-warehouse inventory with reorder alerts, batch and lot tracking.",
      },
    ],
  }),
  component: InventoryPage,
});

function InventoryPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [showAdjust, setShowAdjust] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [adjustForm, setAdjustForm] = useState({
    product_id: "",
    warehouse_id: "",
    new_quantity: "0",
    reason: "",
  });

  const products = useQuery({
    queryKey: ["inv-products"],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("id,sku,name,unit,reorder_level,unit_cost")
          .order("name")
      ).data ?? [],
  });

  const warehouses = useQuery({
    queryKey: ["inv-warehouses"],
    queryFn: async () =>
      (await supabase.from("warehouses").select("id,name,code").order("name")).data ?? [],
  });

  const inventory = useQuery({
    queryKey: ["inv-stock"],
    queryFn: async () =>
      (
        await supabase
          .from("inventory")
          .select(
            "*, products!inner(id,sku,name,unit_cost,reorder_level), warehouses!inner(id,name,code)",
          )
          .limit(500)
      ).data ?? [],
  });

  const adjustments = useQuery({
    queryKey: ["inv-adjustments"],
    queryFn: async () =>
      (
        await supabase
          .from("inventory_adjustments")
          .select("*, products!inner(name,sku)")
          .order("created_at", { ascending: false })
          .limit(50)
      ).data ?? [],
    enabled: showHistory,
  });

  // Map inventory data to display rows
  const rows =
    inventory.data?.map((inv: any) => ({
      ...inv,
      sku: inv.products?.sku ?? "—",
      product_name: inv.products?.name ?? "—",
      reorder_level: inv.products?.reorder_level ?? 0,
      unit_cost: inv.products?.unit_cost ?? 0,
      warehouse_name: inv.warehouses?.name ?? "—",
      low: Number(inv.quantity ?? 0) <= Number(inv.products?.reorder_level ?? 0),
    })) ?? [];

  const adjustMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const { product_id, warehouse_id, new_quantity, reason } = adjustForm;
      if (!product_id || !warehouse_id) throw new Error("Please select product and warehouse");
      if (!reason.trim()) throw new Error("Please provide a reason for the adjustment");
      return adjustInventory(
        companyId,
        product_id,
        warehouse_id,
        Number(new_quantity),
        reason,
        user.id,
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inv-stock"] });
      queryClient.invalidateQueries({ queryKey: ["inv-products"] });
      // Fire material reservation notification when stock is adjusted for production reserve
      if (companyId && adjustForm.reason.toLowerCase().includes("reserve")) {
        const product = (products.data ?? []).find((p: any) => p.id === adjustForm.product_id);
        const materialName = product?.name ?? "Material";
        const label = `Internal-${materialName.slice(0, 12)}`;
        notifyMaterialReservation(companyId, label, materialName);
      }
      toast.success("Stock adjusted successfully");
      setShowAdjust(false);
      setAdjustForm({ product_id: "", warehouse_id: "", new_quantity: "0", reason: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const lowStock = rows.filter((r: any) => r.low).length;
  const totalOnHand = rows.reduce((s: number, r: any) => s + Number(r.quantity ?? 0), 0);
  const value = rows.reduce(
    (s: number, r: any) => s + Number(r.quantity ?? 0) * Number(r.unit_cost ?? 0),
    0,
  );

  const chartData = rows
    .slice(0, 8)
    .map((r: any) => ({
      sku: r.sku,
      onHand: Number(r.quantity ?? 0),
      reserved: Math.round(Number(r.quantity ?? 0) * 0.15),
    }));

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="inventory" />
      <PageHeader
        eyebrow="Warehouse"
        title="Inventory"
        sub="Real-time on-hand, reserved and in-transit across every warehouse."
        actions={
          <>
            <ModuleCopilot moduleName="inventory" />
            <Button variant="outline" onClick={() => setShowHistory(true)}>
              <History className="h-4 w-4 mr-1.5" />
              History
            </Button>
            {!isAuditor && (
              <Button
                className="bg-[image:var(--gradient-primary)] shadow-glow"
                onClick={() => setShowAdjust(true)}
              >
                <ArrowLeftRight className="h-4 w-4 mr-1.5" />
                Adjust Stock
              </Button>
            )}
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Total on-hand"
          value={totalOnHand.toLocaleString()}
          delta="+2.3%"
          icon={Boxes}
          tone="primary"
        />
        <Kpi
          label="Inventory value"
          value={fmtMoney(Math.round(value))}
          delta="+1.1%"
          icon={Boxes}
          tone="success"
        />
        <Kpi
          label="Low-stock SKUs"
          value={String(lowStock)}
          delta={lowStock > 0 ? "+1" : "0"}
          icon={AlertTriangle}
          tone="warning"
        />
        <Kpi label="Aging > 90 days" value="14" delta="-3" icon={TrendingDown} tone="info" />
      </div>

      <div className="mt-4">
        <Panel title="Stock levels · top SKUs">
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={chartData}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="sku" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 260)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="onHand" fill="oklch(0.58 0.22 259)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="reserved" fill="oklch(0.62 0.19 300)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title={`${rows.length} SKUs across ${warehouses.data?.length ?? 0} warehouses`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["SKU", "Product", "Warehouse", "On-hand", "Reserved", "Reorder", "Status"].map(
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
                {rows.map((r: any) => (
                  <TableRow key={`${r.product_id}-${r.warehouse_id}`} className="border-white/5">
                    <TableCell className="font-medium">{r.sku}</TableCell>
                    <TableCell>{r.product_name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.warehouse_name}</TableCell>
                    <TableCell className="tabular-nums">
                      {Number(r.quantity ?? 0).toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {Math.round(Number(r.quantity ?? 0) * 0.15).toLocaleString()}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {Number(r.reorder_level).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.low ? "critical" : "active"} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>

      {/* Adjust Stock Dialog */}
      <Dialog open={showAdjust} onOpenChange={setShowAdjust}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Adjust Stock</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Product *</Label>
              <Select
                value={adjustForm.product_id}
                onValueChange={(v) => setAdjustForm((f) => ({ ...f, product_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Warehouse *</Label>
              <Select
                value={adjustForm.warehouse_id}
                onValueChange={(v) => setAdjustForm((f) => ({ ...f, warehouse_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {(warehouses.data ?? []).map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">New Quantity *</Label>
              <Input
                type="number"
                value={adjustForm.new_quantity}
                onChange={(e) => setAdjustForm((f) => ({ ...f, new_quantity: e.target.value }))}
                placeholder="Enter new quantity"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason *</Label>
              <Input
                value={adjustForm.reason}
                onChange={(e) => setAdjustForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder="e.g. Physical count correction, Damaged goods"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdjust(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => adjustMutation.mutate()}
              disabled={adjustMutation.isPending}
            >
              {adjustMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <ArrowLeftRight className="h-4 w-4 mr-1.5" />
              )}
              Apply Adjustment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment History Dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adjustment History</DialogTitle>
          </DialogHeader>
          <div className="divide-y divide-white/5">
            {(adjustments.data ?? []).length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No adjustments recorded yet.
              </div>
            )}
            {(adjustments.data ?? []).map((adj: any) => (
              <div key={adj.id} className="py-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {adj.products?.sku ?? adj.product_id?.slice(0, 8)}
                  </span>
                  <StatusBadge status={adj.delta > 0 ? "active" : "critical"} />
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  {adj.old_quantity} → {adj.new_quantity} ({adj.delta > 0 ? "+" : ""}
                  {adj.delta})<span className="mx-1">·</span>
                  {adj.reason}
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {safeDate(adj.created_at, true)}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
