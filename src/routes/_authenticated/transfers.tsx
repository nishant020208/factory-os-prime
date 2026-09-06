import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeftRight,
  ArrowRight,
  Boxes,
  Download,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Warehouse as WarehouseIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { fireNotification } from "@/lib/notifications";
import { safeDate } from "@/lib/utils";
import { fmtNumberShort } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/transfers")({
  head: () => ({
    meta: [
      { title: "Transfers — FactoryOS AI" },
      { name: "description", content: "Inter-warehouse and inter-plant transfers" },
    ],
  }),
  component: TransfersPage,
});

type TransferRow = {
  id: string;
  from_warehouse_id: string | null;
  to_warehouse_id: string | null;
  product_id: string | null;
  material_id: string | null;
  quantity: number;
  status: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  products?: { sku: string; name: string } | null;
  materials?: { name: string } | null;
  from_wh?: { name: string } | null;
  to_wh?: { name: string } | null;
};

function TransfersPage() {
  const qc = useQueryClient();
  const { companyId, user, roles, profile } = useAuth();
  const isAuditor = roles.includes("auditor");
  const canCreate = !!companyId && !!user && !isAuditor;

  const [showNew, setShowNew] = useState(false);
  const [q, setQ] = useState("");
  const [form, setForm] = useState({
    from_warehouse_id: "",
    to_warehouse_id: "",
    product_id: "",
    quantity: "",
    notes: "",
  });
  const [formError, setFormError] = useState<string | null>(null);

  // ── Real data: warehouses, products, live stock, transfers, actors ──
  const warehouses = useQuery({
    queryKey: ["tr-warehouses", companyId],
    queryFn: async () =>
      (await supabase.from("warehouses").select("id,name,code").order("name")).data ?? [],
    enabled: !!companyId,
  });

  const products = useQuery({
    queryKey: ["tr-products", companyId],
    queryFn: async () =>
      (await supabase.from("products").select("id,sku,name").order("name")).data ?? [],
    enabled: !!companyId,
  });

  const stock = useQuery({
    queryKey: ["tr-stock", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("inventory")
          .select("*, products!inner(sku,name), warehouses!inner(id,name)")
          .limit(1000)
      ).data ?? [],
    enabled: !!companyId,
  });

  const transfers = useQuery({
    queryKey: ["tr-transfers", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("stock_transfers")
        .select(
          "*, products(sku,name), materials(name), from_wh:warehouses!stock_transfers_from_warehouse_id_fkey(name), to_wh:warehouses!stock_transfers_to_warehouse_id_fkey(name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []) as TransferRow[];
    },
    enabled: !!companyId,
  });

  // Actor names for the "who performed it" column
  const actorIds = useMemo(
    () =>
      Array.from(
        new Set(
          (transfers.data ?? [])
            .map((t) => t.created_by)
            .filter((v): v is string => !!v),
        ),
      ),
    [transfers.data],
  );
  const actors = useQuery({
    queryKey: ["tr-actors", companyId, actorIds.join(",")],
    queryFn: async () => {
      if (actorIds.length === 0) return {} as Record<string, string>;
      const { data } = await supabase
        .from("profiles")
        .select("id,full_name,email")
        .in("id", actorIds);
      const map: Record<string, string> = {};
      for (const p of data ?? []) {
        map[p.id] = p.full_name ?? p.email;
      }
      return map;
    },
    enabled: !!companyId && actorIds.length > 0,
  });

  // ── Realtime: a transfer created elsewhere appears without a manual refresh ──
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`live-transfers-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "stock_transfers" }, () => {
        qc.invalidateQueries({ queryKey: ["tr-transfers"] });
        qc.invalidateQueries({ queryKey: ["tr-stock"] });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, qc]);

  const availableQty = useMemo(() => {
    if (!form.from_warehouse_id || !form.product_id) return 0;
    const row = (stock.data ?? []).find(
      (s: any) => s.warehouse_id === form.from_warehouse_id && s.product_id === form.product_id,
    );
    if (!row) return 0;
    const r = row as any;
    const onHand = Number(r.quantity ?? 0);
    const reserved = Number(r.reserved_quantity ?? 0);
    const quarantined = Number(r.quarantined_quantity ?? 0);
    const damaged = Number(r.damaged_qty ?? 0);
    return Math.max(0, onHand - reserved - quarantined - damaged);
  }, [stock.data, form.from_warehouse_id, form.product_id]);

  const createTransfer = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const { from_warehouse_id, to_warehouse_id, product_id, quantity, notes } = form;
      if (!from_warehouse_id || !to_warehouse_id || !product_id)
        throw new Error("Please select source, destination and product");
      if (from_warehouse_id === to_warehouse_id)
        throw new Error("Source and destination must be different locations");
      const qty = Number(quantity);
      if (!qty || qty <= 0) throw new Error("Quantity must be greater than zero");
      if (qty > availableQty)
        throw new Error(`Insufficient stock at source — only ${fmtNumberShort(availableQty)} available`);
      const { data, error } = await supabase.rpc("transfer_stock", {
        p_company_id: companyId,
        p_from_warehouse_id: from_warehouse_id,
        p_to_warehouse_id: to_warehouse_id,
        p_product_id: product_id,
        p_quantity: qty,
        p_notes: notes.trim() || null,
      } as never);
      if (error) throw error;
      return { result: data as { id: string } | null, qty, notes: notes.trim() };
    },
    onSuccess: async (res) => {
      const fromName =
        (warehouses.data ?? []).find((w: any) => w.id === form.from_warehouse_id)?.name ?? "source";
      const toName =
        (warehouses.data ?? []).find((w: any) => w.id === form.to_warehouse_id)?.name ?? "destination";
      const product = (products.data ?? []).find((p: any) => p.id === form.product_id);
      const sku = product?.sku ?? "item";

      qc.invalidateQueries({ queryKey: ["tr-transfers"] });
      qc.invalidateQueries({ queryKey: ["tr-stock"] });
      // Notify Company Admin (role-targeted, never broadcast) of the completed move
      void fireNotification(
        companyId,
        "company_admin",
        null,
        "⇄ Stock Transfer Completed",
        `${fmtNumberShort(res.qty)} × ${sku} moved from ${fromName} to ${toName} by ${profile?.full_name ?? profile?.email ?? "a team member"}.`,
        "info",
        "stock_transfers",
        res.result?.id ?? null,
      );
      toast.success("Transfer completed — stock moved atomically");
      setShowNew(false);
      setForm({ from_warehouse_id: "", to_warehouse_id: "", product_id: "", quantity: "", notes: "" });
    },
    onError: (err: any) => toast.error(err.message ?? "Transfer failed"),
  });

  // ── Derived stats (real, live) ──
  const rows = transfers.data ?? [];
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter((r) => {
      const hay = [
        r.products?.sku,
        r.products?.name,
        r.materials?.name,
        r.from_wh?.name,
        r.to_wh?.name,
        r.status,
        r.notes,
        String(r.quantity),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(needle);
    });
  }, [rows, q]);

  const topStatus = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) counts.set(r.status, (counts.get(r.status) ?? 0) + 1);
    const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
    return top ? `${top[0].replace(/_/g, " ")} (${top[1]})` : "—";
  }, [rows]);

  const totalMoved = useMemo(
    () => rows.reduce((s, r) => s + Number(r.quantity ?? 0), 0),
    [rows],
  );

  // ── Export: real transfer records, real data, sensible filename ──
  function handleExport() {
    const head = "Transfer,From,To,Product,Qty,Status,Notes,Moved by,Date";
    const body = filtered
      .map((r) => {
        const from = r.from_wh?.name ?? "";
        const to = r.to_wh?.name ?? "";
        const product = r.products
          ? `${r.products.sku} - ${r.products.name}`
          : (r.materials?.name ?? "");
        const by = (actors.data ?? {})[r.created_by ?? ""] ?? "";
        return [r.id, from, to, product, r.quantity, r.status, r.notes ?? "", by, r.created_at]
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(",");
      })
      .join("\n");
    const csv = head + "\n" + body;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock-transfers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  }

  // ── AI summary: real transfer activity ──
  function handleAiSummary() {
    const movedPairs = rows.slice(0, 3).map(
      (r) =>
        `${r.from_wh?.name ?? "?"} → ${r.to_wh?.name ?? "?"} (${fmtNumberShort(
          Number(r.quantity ?? 0),
        )} × ${r.products?.sku ?? r.materials?.name ?? "item"})`,
    );
    const parts = [
      `${rows.length} transfer${rows.length === 1 ? "" : "s"} completed, ${fmtNumberShort(totalMoved)} units moved in total.`,
      topStatus !== "—" ? `Most common status: ${topStatus}.` : "",
      movedPairs.length ? `Latest: ${movedPairs.join(" · ")}.` : "",
      "Transfers are atomic — stock is decremented and incremented in a single transaction.",
    ].filter(Boolean);
    toast(parts.join(" "), { icon: "✨", duration: 7000 });
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="transfers" />
      <PageHeader
        eyebrow="Warehouse"
        title="Transfers"
        sub="Inter-warehouse stock transfers — atomic decrement/increment."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ModuleCopilot moduleName="transfers" />
            <Button
              variant="outline"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={handleAiSummary}
            >
              <Sparkles className="h-4 w-4 mr-1" /> AI summary
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Export</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="hidden md:inline-flex"
              onClick={() => {
                qc.invalidateQueries({ queryKey: ["tr-transfers"] });
                qc.invalidateQueries({ queryKey: ["tr-stock"] });
              }}
              disabled={transfers.isFetching}
            >
              {transfers.isFetching ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1" />
              )}
              <span className="hidden lg:inline">Refresh</span>
            </Button>
            {canCreate && (
              <Button
                size="sm"
                className="bg-[image:var(--gradient-primary)] shadow-glow"
                onClick={() => {
                  setFormError(null);
                  setShowNew(true);
                }}
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi
          label="Total Transfers"
          value={String(rows.length)}
          icon={ArrowLeftRight}
          tone="primary"
        />
        <Kpi label="Top Status" value={topStatus} icon={Boxes} tone="info" />
        <Kpi
          label="Company Scope"
          value="RLS on"
          icon={WarehouseIcon}
          tone="success"
          title="Every transfer is scoped to your company via RLS"
        />
      </div>

      <Panel
        title="Transfers records"
        right={
          <div className="relative w-72 max-w-full">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        }
      >
        {transfers.isLoading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={q ? "No matching transfers" : "No transfers yet"}
            sub={
              q
                ? "Try a different search."
                : canCreate
                  ? 'Click "New" to move stock between locations — the transfer is applied atomically to your real inventory. Records are scoped to your company via RLS.'
                  : "Transfers created by warehouse staff will appear here. Records are scoped to your company via RLS."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["From", "To", "Product", "Qty", "Status", "Notes", "Moved by", "Date"].map(
                    (h) => (
                      <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                        {h}
                      </TableHead>
                    ),
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={r.id} className="border-white/5">
                    <TableCell className="text-xs">{r.from_wh?.name ?? "—"}</TableCell>
                    <TableCell className="text-xs">
                      <span className="inline-flex items-center gap-1">
                        {r.to_wh?.name ?? "—"}
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                      </span>
                    </TableCell>
                    <TableCell>
                      {r.products ? (
                        <>
                          <span className="font-mono text-xs mr-2">{r.products.sku}</span>
                          <span className="text-sm">{r.products.name}</span>
                        </>
                      ) : (
                        <span className="text-sm">{r.materials?.name ?? "—"}</span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-sm tabular-nums">
                      {fmtNumberShort(Number(r.quantity ?? 0))}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[220px] truncate">
                      {r.notes ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {(actors.data ?? {})[r.created_by ?? ""] ?? "—"}
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
        <div className="mt-3 text-[11px] text-muted-foreground">
          {rows.length > 0 && `Last updated ${safeDate(new Date().toISOString(), true)}`}
        </div>
      </Panel>

      {/* ── New Transfer Dialog ── */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[520px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Transfer</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Source Location *</Label>
                <Select
                  value={form.from_warehouse_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, from_warehouse_id: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select source" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {(warehouses.data ?? []).map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Destination Location *</Label>
                <Select
                  value={form.to_warehouse_id}
                  onValueChange={(v) => setForm((f) => ({ ...f, to_warehouse_id: v }))}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select destination" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {(warehouses.data ?? []).map((w: any) => (
                      <SelectItem key={w.id} value={w.id}>
                        {w.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Material / Product *</Label>
              <Select
                value={form.product_id}
                onValueChange={(v) => setForm((f) => ({ ...f, product_id: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select product" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {(products.data ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.sku} — {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantity *</Label>
              <Input
                type="number"
                min={1}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="Enter quantity to transfer"
                className="h-9"
              />
              {form.from_warehouse_id && form.product_id && (
                <p className="text-[11px] text-muted-foreground">
                  Available at source: {fmtNumberShort(availableQty)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes / Reason</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Rebalance stock for production floor"
                rows={2}
              />
            </div>
            {formError && (
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {formError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)} disabled={createTransfer.isPending}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createTransfer.mutate()}
              disabled={createTransfer.isPending}
            >
              {createTransfer.isPending ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <ArrowLeftRight className="h-4 w-4 mr-1.5" />
              )}
              Complete Transfer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}