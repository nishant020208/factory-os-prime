import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, X, Warehouse } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
import { fmtMoney } from "@/lib/currency";
import { nextPoNumber } from "@/lib/po";
import { resolveRelation } from "@/lib/utils";
import { toast } from "sonner";
import { useEffect, useMemo, useState } from "react";

interface LineItem {
  material_id: string;
  material_name: string;
  unit: string;
  quantity: string;
  unit_price: number;
}

const TODAY_ISO = new Date().toISOString().split("T")[0];

/**
 * Multi-material New Purchase Order builder. Owns its catalog/supplier reads,
 * the draft line state, and the atomic create RPC — the page that hosts it
 * only tracks whether the dialog is open.
 */
export function NewPoDialog({
  open,
  onOpenChange,
  companyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string | null;
}) {
  const queryClient = useQueryClient();
  const [poNumber, setPoNumber] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [expectedDate, setExpectedDate] = useState("");
  const [deliveryWarehouseId, setDeliveryWarehouseId] = useState("");
  const [lines, setLines] = useState<LineItem[]>([]);

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("suppliers")
          .select("id, name")
          .eq("company_id", companyId ?? "")
          .order("name")
      ).data ?? [],
    enabled: !!companyId,
  });

  // Warehouses for "Deliver To" dropdown
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("warehouses")
          .select("id, name, code")
          .eq("company_id", companyId ?? "")
          .order("name")
      ).data ?? [],
    enabled: !!companyId,
  });

  // The suppliers' priced catalogs; only the selected supplier's rows are
  // offered as draggable lines.
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

  // Peek at existing numbers so each fresh draft is suggested PUR-<year>-<next>.
  const { data: poRows } = useQuery({
    queryKey: ["po-number-hint", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("purchase_orders")
          .select("po_number")
          .order("created_at", { ascending: false })
          .limit(200)
      ).data ?? [],
    enabled: !!companyId,
  });

  useEffect(() => {
    if (!open) return;
    setPoNumber(nextPoNumber(poRows ?? []));
    setSupplierId("");
    setExpectedDate("");
    setDeliveryWarehouseId("");
    setLines([]);
  }, [open, poRows]);

  // Auto-select the first warehouse when the list loads and nothing is chosen yet
  useEffect(() => {
    if (!deliveryWarehouseId && warehouses && warehouses.length > 0) {
      setDeliveryWarehouseId((warehouses[0] as any).id);
    }
  }, [warehouses, deliveryWarehouseId]);

  const catalogForSupplier = useMemo(
    () =>
      (catalog ?? [])
        .filter((c: any) => c.supplier_id === supplierId)
        .map((c: any) => {
          const m = resolveRelation<any>(c.materials);
          return {
            material_id: c.material_id,
            name: m?.name ?? "—",
            unit: m?.unit ?? "",
            unit_price: Number(c.unit_price ?? 0),
          };
        }),
    [catalog, supplierId],
  );

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
      if (!deliveryWarehouseId) throw new Error("Select a delivery warehouse");
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

      // Stamp the delivery warehouse on the new PO row
      if (r.po_id && deliveryWarehouseId) {
        await (supabase
          .from("purchase_orders") as any)
          .update({ delivery_warehouse_id: deliveryWarehouseId })
          .eq("id", r.po_id);
      }
      return r;
    },
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      queryClient.invalidateQueries({ queryKey: ["po-number-hint"] });
      const whName = (warehouses as any[])?.find((w: any) => w.id === deliveryWarehouseId)?.name ?? "";
      toast.success(
        `Purchase order ${r.po_number ?? ""} created — total ${fmtMoney(r.total)}${whName ? ` → ${whName}` : ""}`,
      );
      onOpenChange(false);
      setLines([]);
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onOpenChange(false)}>
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

          {/* Delivery Warehouse — required */}
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
              <Warehouse className="h-3.5 w-3.5" />
              Deliver To Warehouse *
            </Label>
            <Select value={deliveryWarehouseId} onValueChange={setDeliveryWarehouseId}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Select destination warehouse" />
              </SelectTrigger>
              <SelectContent>
                {(warehouses as any[] ?? []).map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>
                    <span className="font-mono text-xs text-muted-foreground mr-2">{w.code}</span>
                    {w.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              The receiving warehouse where goods will be stocked after GRN.
            </p>
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
                  <Select value="" onValueChange={(v) => v && addLine(v)}>
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
                  ? 'Use "+ Add material from catalog" to build the order.'
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
                  <span className="font-semibold tabular-nums">Total: {fmtMoney(grandTotal)}</span>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-[image:var(--gradient-primary)]"
            disabled={!supplierId || !deliveryWarehouseId || lines.length === 0 || createMutation.isPending}
            loading={createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? "Creating…" : "Send to Supplier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
