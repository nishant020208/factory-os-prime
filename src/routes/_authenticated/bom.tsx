import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Layers, Package, Trash2, Plus, Loader2, Boxes } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/_authenticated/bom")({
  head: () => ({
    meta: [
      { title: "Bill of Materials — FactoryOS AI" },
      {
        name: "description",
        content: "Define which raw materials go into each product, with quantity per unit.",
      },
    ],
  }),
  component: BomPage,
});

interface BomItemRow {
  id: string;
  bom_id: string;
  component_product_id: string;
  quantity: number;
  unit: string | null;
}

interface BomRow {
  id: string;
  product_id: string;
  version: string;
  status: string;
  bom_items: BomItemRow[];
}

type EditDraft = { product_id: string; component_id: string; quantity: string };

function BomPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAdmin = roles.includes("company_admin");

  const { data: products } = useQuery({
    queryKey: ["bom-products"],
    queryFn: async () =>
      (
        await supabase
          .from("products")
          .select("id, sku, name, unit, unit_cost")
          .eq("company_id", companyId!)
          .order("sku")
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: materials } = useQuery({
    queryKey: ["bom-materials"],
    queryFn: async () =>
      (
        await supabase
          .from("materials")
          .select("id, name, unit, unit_cost")
          .eq("company_id", companyId!)
          .eq("is_active", true)
          .order("name")
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: boms } = useQuery({
    queryKey: ["bom-rows"],
    queryFn: async () =>
      (await supabase.from("bom").select("*, bom_items(*)").order("created_at")).data ?? [],
    enabled: !!companyId,
  });

  // one editor row per product: pick the first bom row that exists for it
  const bomByProduct = useMemo(() => {
    const map = new Map<string, BomRow>();
    for (const b of (boms ?? []) as BomRow[]) {
      if (!map.has(b.product_id)) map.set(b.product_id, b);
    }
    return map;
  }, [boms]);

  const lineCount = useMemo(
    () =>
      (boms ?? []).reduce(
        (s: number, b: BomRow) => s + (b.bom_items ?? []).length,
        0,
      ),
    [boms],
  );
  const covered = products?.filter((p) => bomByProduct.has(p.id)).length ?? 0;

  // add a component (raw material) to a product's BOM
  const addMutation = useMutation({
    mutationFn: async (d: EditDraft) => {
      if (!companyId) throw new Error("Not authenticated");
      if (!d.product_id || !d.component_id || !(Number(d.quantity) > 0))
        throw new Error("Choose a product, a raw material and a quantity per unit");
      const mat = (materials ?? []).find((m) => m.id === d.component_id) as
        | { id: string; name: string; unit: string | null }
        | undefined;
      if (!mat) throw new Error("Pick a raw material from the list");

      let bom = bomByProduct.get(d.product_id);
      if (!bom) {
        const { data, error } = await supabase
          .from("bom")
          .insert({
            company_id: companyId,
            product_id: d.product_id,
            version: "v1",
            status: "active",
            notes: `BOM for ${(products ?? []).find((p) => p.id === d.product_id)?.name ?? "product"}`,
          })
          .select("id")
          .single();
        if (error) throw error;
        bom = {
          id: data.id,
          product_id: d.product_id,
          version: "v1",
          status: "active",
          bom_items: [],
        } as BomRow;
      }

      const dup = bomByProduct.get(d.product_id)?.bom_items?.find(
        (it) => it.component_product_id === d.component_id,
      );
      if (dup)
        throw new Error(`${mat.name} is already a component — remove it first to change the qty`);

      const { error } = await supabase.from("bom_items").insert({
        company_id: companyId,
        bom_id: bom.id,
        component_product_id: d.component_id,
        quantity: Number(d.quantity),
        unit: mat.unit ?? "pcs",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-rows"] });
      toast.success("Raw material added to the BOM");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase.from("bom_items").delete().eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["bom-rows"] });
      toast.success("Component removed from the BOM");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameFor = (componentId: string): { name: string; unit: string | null; kind: "Material" | "Product" } => {
    const mat = (materials ?? []).find((m) => m.id === componentId) as
      | { name: string; unit: string | null }
      | undefined;
    if (mat) return { name: mat.name, unit: mat.unit, kind: "Material" };
    const prod = (products ?? []).find((p) => p.id === componentId) as
      | { name: string; unit: string | null }
      | undefined;
    if (prod) return { name: prod.name, unit: prod.unit, kind: "Product" };
    return { name: "Unknown component", unit: null, kind: "Product" };
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Engineering"
        title="Bill of Materials"
        sub="Define the raw materials needed to make each product — the Production Manager's material-shortage check reads exactly this list against live warehouse stock."
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Products" value={String(products?.length ?? 0)} icon={Package} tone="primary" />
        <Kpi label="With BOM" value={String(covered)} icon={Layers} tone="info" />
        <Kpi label="Component Lines" value={String(lineCount)} icon={Boxes} tone="success" />
      </div>

      {!isAdmin && (
        <div className="text-xs text-muted-foreground mb-4">
          Read-only view — ask your Company Admin to change the material list.
        </div>
      )}

      {(products ?? []).length === 0 ? (
        <EmptyState title="No products yet" sub="Create products first, then attach their raw materials here." />
      ) : (
        <div className="space-y-4">
          {(products ?? []).map((p) => {
            const bom = bomByProduct.get(p.id);
            const lines = bom?.bom_items ?? [];
            return (
              <Panel
                key={p.id}
                title={`${p.name}`}
                right={
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{p.sku}</span>
                    {bom ? (
                      <StatusBadge status={bom.status ?? "active"} />
                    ) : (
                      <Badge variant="outline" className="text-[10px] text-warning bg-warning/10 border-warning/30">
                        No BOM yet
                      </Badge>
                    )}
                  </div>
                }
              >
                {lines.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-2">
                    No raw materials defined yet. {isAdmin && "Add the first material below."}
                  </p>
                ) : (
                  <div className="overflow-x-auto mb-3">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                          <th className="py-2 pr-3 font-medium">Component</th>
                          <th className="py-2 pr-3 font-medium">Type</th>
                          <th className="py-2 pr-3 font-medium">Per Unit</th>
                          <th className="py-2 pr-3 font-medium">Unit</th>
                          {isAdmin && <th className="py-2 font-medium"></th>}
                        </tr>
                      </thead>
                      <tbody>
                        {lines.map((it) => {
                          const info = nameFor(it.component_product_id);
                          return (
                            <tr key={it.id} className="border-b border-white/5 last:border-0">
                              <td className="py-2 pr-3 font-medium">{info.name}</td>
                              <td className="py-2 pr-3">
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] ${info.kind === "Material" ? "bg-primary/10 text-primary border-primary/20" : "bg-info/10 text-info border-info/20"}`}
                                >
                                  {info.kind}
                                </Badge>
                              </td>
                              <td className="py-2 pr-3 tabular-nums">{Number(it.quantity).toLocaleString()}</td>
                              <td className="py-2 pr-3 text-xs text-muted-foreground">{info.unit ?? it.unit ?? "—"}</td>
                              {isAdmin && (
                                <td className="py-2 text-right">
                                  <button
                                    className="text-muted-foreground hover:text-destructive transition-colors"
                                    onClick={() => removeMutation.mutate(it.id)}
                                    disabled={removeMutation.isPending}
                                    title="Remove component"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {isAdmin && <AddLineForm p={p} materials={materials ?? []} onAdd={addMutation.mutate} pending={addMutation.isPending} />}
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AddLineForm({
  p,
  materials,
  onAdd,
  pending,
}: {
  p: { id: string; name: string };
  materials: { id: string; name: string; unit: string | null }[];
  onAdd: (d: EditDraft) => void;
  pending: boolean;
}) {
  const [componentId, setComponentId] = useState("");
  const [quantity, setQuantity] = useState("1");

  return (
    <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/5">
      <select
        value={componentId}
        onChange={(e) => setComponentId(e.target.value)}
        className="h-8 flex-1 min-w-[160px] rounded-md border border-input bg-background px-2 text-sm"
      >
        <option value="">Pick raw material…</option>
        {materials.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name} ({m.unit ?? "unit"})
          </option>
        ))}
      </select>
      <input
        type="number"
        min="0.01"
        step="any"
        value={quantity}
        onChange={(e) => setQuantity(e.target.value)}
        placeholder="Qty per unit"
        className="h-8 w-28 rounded-md border border-input bg-background px-2 text-sm tabular-nums"
      />
      <Button
        size="sm"
        variant="outline"
        className="h-8 text-xs"
        disabled={pending}
        onClick={() => onAdd({ product_id: p.id, component_id: componentId, quantity })}
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
        ) : (
          <Plus className="h-3.5 w-3.5 mr-1.5" />
        )}
        Add Material
      </Button>
    </div>
  );
}
