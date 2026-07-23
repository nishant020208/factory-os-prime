import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Boxes, AlertTriangle, ArrowLeftRight, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [
    { title: "Inventory — FactoryOS AI" },
    { name: "description", content: "Multi-warehouse inventory with reorder alerts, batch and lot tracking." },
  ]}),
  component: InventoryPage,
});

function InventoryPage() {
  const products = useQuery({
    queryKey: ["inv-products"],
    queryFn: async () => (await supabase.from("products").select("id,sku,name,unit,reorder_level,unit_cost")).data ?? [],
  });
  // Synthetic on-hand + trend derived deterministically from SKU
  const rows = (products.data ?? []).map((p, i) => {
    const onHand = 120 + ((i * 173) % 1400);
    const inbound = 20 + ((i * 41) % 200);
    const reserved = 10 + ((i * 29) % 150);
    return { ...p, on_hand: onHand, inbound, reserved, low: onHand < Number(p.reorder_level ?? 0) };
  });
  const lowStock = rows.filter(r => r.low).length;
  const totalOnHand = rows.reduce((s, r) => s + r.on_hand, 0);
  const value = rows.reduce((s, r) => s + r.on_hand * Number(r.unit_cost ?? 0), 0);

  const chartData = rows.slice(0, 8).map(r => ({ sku: r.sku, onHand: r.on_hand, reserved: r.reserved }));

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="Warehouse" title="Inventory" sub="Real-time on-hand, reserved and in-transit across every warehouse."
        actions={<Button className="bg-[image:var(--gradient-primary)] shadow-glow"><ArrowLeftRight className="h-4 w-4 mr-1.5" />Adjust stock</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Total on-hand" value={totalOnHand.toLocaleString()} delta="+2.3%" icon={Boxes} tone="primary" />
        <Kpi label="Inventory value" value={`$${Math.round(value).toLocaleString()}`} delta="+1.1%" icon={Boxes} tone="success" />
        <Kpi label="Low-stock SKUs" value={String(lowStock)} delta={lowStock > 0 ? "+1" : "0"} icon={AlertTriangle} tone="warning" />
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
                <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                <Bar dataKey="onHand" fill="oklch(0.58 0.22 259)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="reserved" fill="oklch(0.62 0.19 300)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title={`${rows.length} SKUs · Detroit Assembly Plant`}>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["SKU","Product","Unit","On-hand","Reserved","Inbound","Reorder","Status"].map(h => (
                    <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(r => (
                  <TableRow key={r.id} className="border-white/5">
                    <TableCell className="font-medium">{r.sku}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.unit}</TableCell>
                    <TableCell className="tabular-nums">{r.on_hand.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{r.reserved.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{r.inbound.toLocaleString()}</TableCell>
                    <TableCell className="tabular-nums">{Number(r.reorder_level).toLocaleString()}</TableCell>
                    <TableCell><StatusBadge status={r.low ? "critical" : "active"} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
