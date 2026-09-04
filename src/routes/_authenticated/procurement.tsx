import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ShoppingCart,
  DollarSign,
  Send,
  PackageCheck,
  Plus,
  Pencil,
  Trash2,
  Search as SearchIcon,
  Package,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { fmtMoney, fmtMoneyK } from "@/lib/currency";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({
    meta: [
      { title: "Procurement — FactoryOS AI" },
      { name: "description", content: "Purchase orders, RFQs and supplier commitments." },
    ],
  }),
  component: ProcurementPage,
});

const PO_STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "sent", label: "Sent to Supplier" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "accepted", label: "Accepted" },
  { value: "in_progress", label: "In Progress" },
  { value: "received", label: "Received" },
];

const TODAY_ISO = new Date().toISOString().split("T")[0];

interface LineItem {
  material_id: string;
  material_name: string;
  unit: string;
  quantity: string;
  unit_price: number;
}

function nextPoNumber(rows: any[]): string {
  let max = 0;
  for (const r of rows ?? []) {
    const m = /PUR-\d{4}-(\d+)/.exec(String(r.po_number ?? ""));
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const year = new Date().getFullYear();
  return `PUR-${year}-${String(max + 1).padStart(4, "0")}`;
}

function ProcurementPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");

  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [poNumber, setPoNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);
  const [editStatus, setEditStatus] = useState("sent");
  const [editDate, setEditDate] = useState("");

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", companyId],
    queryFn: async () =>
      (await supabase.from("suppliers").select("id, name").eq("company_id", companyId ?? "").order("name"))
        .data ?? [],
    enabled: !!companyId,
  });

  // The supplier's catalog (materials + prices). Ops roles read the whole
  // company catalog; only the selected supplier's rows are offered as lines.
  const { data: catalog } = useQuery({
    queryKey: ["supplier-materials-catalog", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("supplier_materials")
          .select("id, supplier_id, material_id, unit_price, status, materials(name, unit)")
          .eq("status", "active")
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () =>
      (
        await supabase
          .from("purchase_orders")
          .select("*, purchase_order_items(id, material_id, quantity, unit_price, materials(name, unit))")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const supplierMap = new Map((suppliers ?? []).map((s: any) => [s.id, s.name]));

  const catalogForSupplier = useMemo(
    () =>
      (catalog ?? [])
        .filter((c: any) => c.supplier_id === supplierId)
        .map((c: any) => {
          const m: any = Array.isArray(c.materials) ? c.materials[0] : c.materials;
          return {
            material_id: c.material_id,
            name: m?.name ?? "—",
            unit: m?.unit ?? "",
            unit_price: Number(c.unit_price ?? 0),
          };
        }),
    [catalog, supplierId],
  );

  const rows = (data ?? []).map((po: any) => ({
    ...po,
    supplier_name: po.supplier_id ? (supplierMap.get(po.supplier_id) ?? "—") : "—",
  }));
  const filtered = q.trim()
    ? rows.filter((r: any) =>
        [r.po_number, r.supplier_name, r.status]
          .join(" ")
          .toLowerCase()
          .includes(q.toLowerCase()),
      )
    : rows;

  const totalValue = rows.reduce((s: number, p: any) => s + Number(p.total_amount ?? 0), 0);
  const sentCount = rows.filter((p: any) => p.status === "sent").length;
  const receivedCount = rows.filter((p: any) => p.status === "received").length;

  const lineTotal = (l: LineItem) => (parseFloat(l.quantity) || 0) * l.unit_price;
  const grandTotal = lines.reduce((s, l) => s + lineTotal(l), 0);

  const addLine = (materialId: string) => {
    const entry = catalogForSupplier.find((c) => c.material_id === materialId);
    if (!entry) return;
    if (lines.some((l) => l.material_id === materialId)) {
      toast.error("That material is already on this order — adjust its quantity instead");
      return;
    }
    setLines((ls) => [
      ...ls,
      {
        material_id: entry.material_id,
        material_name: entry.name,
        unit: entry.unit,
        quantity: "1",
        unit_price: entry.unit_price,
      },
    ]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!supplierId) throw new Error("Select a supplier first");
      if (lines.length === 0) throw new Error("Add at least one material line to the order");
      for (const l of lines) {
        if (!(parseFloat(l.quantity) > 0)) throw new Error("Every line needs a quantity above zero");
      }
      const { data: res, error } = await supabase.rpc("create_purchase_order_with_items", {
        p_company_id: companyId!,
        p_po_number: poNumber.trim(),
        p_supplier_id: supplierId,
        p_expected_date: expectedDate,
        p_items: lines.map((l) => ({
          material_id: l.material_id,
          quantity: parseFloat(l.quantity),
          unit_price: l.unit_price,
        })),
      });
      if (error) throw error;
      const r = res as any;
      if (!r?.ok) throw new Error(r?.error ?? "Failed to create the purchase order");
      return r;
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      toast.success(
        `Purchase order ${r.po_number ?? ""} created — sent to supplier, total ${fmtMoney(r.total)}`,
      );
      setNewOpen(false);
      setLines([]);
      setSupplierId("");
      setExpectedDate("");
      setPoNumber("");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({ status: editStatus, expected_date: editDate || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      toast.success("Purchase order updated");
      setEditRow(null);
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const openNew = () => {
    setPoNumber(nextPoNumber(rows));
    setSupplierId("");
    setExpectedDate("");
    setLines([]);
    setNewOpen(true);
  };
  const openEdit = (po: any) => {
    setEditRow(po);
    setEditStatus(po.status || "sent");
    setEditDate(po.expected_date ? String(po.expected_date).slice(0, 10) : "");
  };

  const materialsCell = (po: any) => {
    const items = po.purchase_order_items ?? [];
    if (!items.length) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <div className="space-y-0.5 max-w-[240px]">
        {items.map((it: any) => {
          const m: any = Array.isArray(it.materials) ? it.materials[0] : it.materials;
          return (
            <div key={it.id} className="text-xs truncate">
              <span className="font-medium">{m?.name ?? "Material"}</span> ×{it.quantity}
              {it.unit_price ? (
                <span className="text-muted-foreground"> @ {fmtMoney(it.unit_price)}</span>
              ) : null}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Supply Chain"
        title="Purchase Orders"
        sub="Every PO from request to receipt — materials auto-priced from the supplier's catalog, never typed."
        actions={
          !isAuditor ? (
            <Button onClick={openNew} className="bg-[image:var(--gradient-primary)] shadow-glow">
              <Plus className="h-4 w-4 mr-1.5" />
              New Purchase Order
            </Button>
          ) : null
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Total POs" value={String(rows.length)} icon={ShoppingCart} tone="primary" />
        <Kpi label="Commit Value" value={fmtMoneyK(totalValue)} icon={DollarSign} tone="success" />
        <Kpi label="Sent to Supplier" value={String(sentCount)} icon={Send} tone="info" />
        <Kpi label="Received" value={String(receivedCount)} icon={PackageCheck} tone="success" />
      </div>

      <Panel
        title={`${filtered.length} record${filtered.length === 1 ? "" : "s"}`}
        right={
          <div className="relative">
            <SearchIcon className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-8 w-56 bg-background/40"
            />
          </div>
        }
      >
        <Table>
          <TableHeader>
            <TableRow className="border-white/5">
              {["PO #", "Supplier", "Materials Ordered", "Status", "Amount", "Expected", "Created"].map(
                (h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ),
              )}
              {!isAuditor && <TableHead className="w-24" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((po: any) => (
              <TableRow key={po.id} className="border-white/5">
                <TableCell className="font-medium">{po.po_number}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{po.supplier_name}</TableCell>
                <TableCell>{materialsCell(po)}</TableCell>
                <TableCell>
                  <StatusBadge status={po.status} />
                </TableCell>
                <TableCell className="font-mono text-xs">{fmtMoney(po.total_amount)}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {po.expected_date ? new Date(po.expected_date).toLocaleDateString() : "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(po.created_at).toLocaleDateString()}
                </TableCell>
                {!isAuditor && (
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(po)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (confirm(`Delete purchase order ${po.po_number}?`))
                            deleteMutation.mutate(po.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {filtered.length === 0 && (
              <TableRow className="border-white/5">
                <TableCell
                  colSpan={8}
                  className="text-center text-muted-foreground py-10 text-sm"
                >
                  No purchase orders yet
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Panel>

      {/* New Purchase Order — multi-material builder */}
      <Dialog open={newOpen} onOpenChange={(o) => !o && setNewOpen(false)}>
        <DialogContent className="sm:max-w-[640px] max-h-[88vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New Purchase Order</DialogTitle>
            <DialogDescription>
              Add the materials to order — unit prices come from the supplier's catalog and the
              total is calculated automatically. The order is sent to the supplier.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">PO Number *</Label>
                <Input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Supplier *</Label>
                <Select
                  value={supplierId}
                  onValueChange={(v) => {
                    setSupplierId(v);
                    setLines([]);
                  }}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Select supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {(suppliers ?? []).map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expected Date</Label>
              <Input
                type="date"
                value={expectedDate}
                min={TODAY_ISO}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="h-9"
              />
            </div>

            {/* Material lines */}
            <div className="rounded-xl border border-white/10 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-muted-foreground">Materials Ordered *</Label>
                {supplierId ? (
                  <div className="flex items-center gap-1.5">
                    <Select
                      value=""
                      onValueChange={(v) => v && addLine(v)}
                    >
                      <SelectTrigger className="h-8 w-56">
                        <SelectValue placeholder="+ Add material from catalog" />
                      </SelectTrigger>
                      <SelectContent>
                        {catalogForSupplier.map((c) => (
                          <SelectItem key={c.material_id} value={c.material_id}>
                            {c.name} — {fmtMoney(c.unit_price)}
                            {c.unit ? ` / ${c.unit}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : null}
              </div>

              {supplierId && catalogForSupplier.length === 0 && (
                <p className="text-xs text-amber-400/90">
                  This supplier has no priced materials in their catalog yet. Ask them to add
                  materials in their portal (My Catalog), or pick a different supplier.
                </p>
              )}

              {lines.length === 0 ? (
                <p className="text-xs text-muted-foreground py-2">
                  {supplierId
                    ? "Use “+ Add material from catalog” to build the order."
                    : "Select a supplier to see the materials they supply."}
                </p>
              ) : (
                <div className="space-y-2">
                  {lines.map((l, i) => (
                    <div
                      key={`${l.material_id}-${i}`}
                      className="grid grid-cols-[1fr_90px_110px_30px] gap-2 items-center"
                    >
                      <div className="text-sm truncate" title={`${l.material_name} (${l.unit})`}>
                        <span className="font-medium">{l.material_name}</span>
                        <span className="text-muted-foreground text-xs"> ({l.unit})</span>
                      </div>
                      <Input
                        type="number"
                        min="0"
                        value={l.quantity}
                        onChange={(e) =>
                          setLines((ls) =>
                            ls.map((x, xi) => (xi === i ? { ...x, quantity: e.target.value } : x)),
                          )
                        }
                        className="h-8"
                      />
                      <div className="text-right font-mono text-xs self-center">
                        {fmtMoney(lineTotal(l))}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => setLines((ls) => ls.filter((_, xi) => xi !== i))}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <div className="pt-2 border-t border-white/10 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5" /> Prices from supplier catalog — not
                      manually entered
                    </span>
                    <span className="font-semibold tabular-nums">
                      Total: {fmtMoney(grandTotal)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              disabled={!supplierId || lines.length === 0 || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending ? "Creating…" : "Send to Supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit status / expected date */}
      <Dialog open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Update {editRow?.po_number ?? "Purchase Order"}</DialogTitle>
            <DialogDescription>
              Status and expected date only — materials and prices stay as sent.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PO_STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expected Date</Label>
              <Input
                type="date"
                value={editDate}
                min={TODAY_ISO}
                onChange={(e) => setEditDate(e.target.value)}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              disabled={updateMutation.isPending}
              onClick={() => editRow && updateMutation.mutate({ id: editRow.id })}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
