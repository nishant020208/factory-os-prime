import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Package, Plus, Pencil, Trash2, DollarSign, ListChecks, AlertTriangle } from "lucide-react";
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
import { fmtMoney } from "@/lib/currency";
import { resolveRelation, safeDate } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/my-catalog")({
  head: () => ({
    meta: [
      { title: "My Catalog — FactoryOS AI" },
      {
        name: "description",
        content:
          "Raw materials you supply with your unit prices — the catalog Procurement uses to auto-price purchase orders.",
      },
    ],
  }),
  component: MyCatalogPage,
});

interface CatalogRow {
  id: string;
  supplier_id: string;
  material_id: string;
  unit_price: number;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  materials?: { name: string; unit: string } | { name: string; unit: string }[] | null;
}

function MyCatalogPage() {
  const queryClient = useQueryClient();
  const { user, companyId } = useAuth();
  const [showDialog, setShowDialog] = useState<{
    open: boolean;
    editing: CatalogRow | null;
  }>({ open: false, editing: null });
  const [form, setForm] = useState({ material_id: "", unit_price: "0", status: "active" });

  // Which supplier record belongs to this portal account
  const { data: mySupplier } = useQuery({
    queryKey: ["my-supplier", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("suppliers")
        .select("id, name, contact_email")
        .eq("user_id", user.id)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user,
  });

  // The company's raw-material master (what this supplier can offer)
  const { data: materials } = useQuery({
    queryKey: ["my-catalog-materials", companyId],
    queryFn: async () =>
      (await supabase.from("materials").select("id, name, unit").eq("company_id", companyId ?? "").order("name")).data ??
      [],
    enabled: !!companyId && !!mySupplier,
  });

  // This supplier's catalog rows (with the material resolved)
  const { data: catalog } = useQuery({
    queryKey: ["my-catalog", mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier) return [];
      const { data } = await supabase
        .from("supplier_materials")
        .select("id, supplier_id, material_id, unit_price, status, created_at, updated_at, materials(name, unit)")
        .eq("supplier_id", mySupplier.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as CatalogRow[];
    },
    enabled: !!mySupplier,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!mySupplier || !companyId) throw new Error("No supplier linked to this account");
      if (!form.material_id) throw new Error("Choose a material to add");
      const price = parseFloat(form.unit_price) || 0;
      if (price <= 0) throw new Error("Enter a unit price greater than zero");
      const { error } = await supabase.from("supplier_materials").insert({
        company_id: companyId,
        supplier_id: mySupplier.id,
        material_id: form.material_id,
        unit_price: price,
        status: form.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-catalog"] });
      toast.success("Material added to your catalog");
      setShowDialog({ open: false, editing: null });
      setForm({ material_id: "", unit_price: "0", status: "active" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      const editing = showDialog.editing;
      if (!editing) throw new Error("Nothing selected");
      const price = parseFloat(form.unit_price) || 0;
      if (price <= 0) throw new Error("Enter a unit price greater than zero");
      const { error } = await supabase
        .from("supplier_materials")
        .update({ material_id: form.material_id, unit_price: price, status: form.status })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-catalog"] });
      toast.success("Catalog entry updated");
      setShowDialog({ open: false, editing: null });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplier_materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-catalog"] });
      toast.success("Material removed from your catalog");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const rows = catalog ?? [];
  const activeRows = rows.filter((r) => r.status === "active");
  const avgPrice = rows.length
    ? rows.reduce((s, r) => s + Number(r.unit_price ?? 0), 0) / rows.length
    : 0;

  const openAdd = () => {
    setForm({ material_id: "", unit_price: "0", status: "active" });
    setShowDialog({ open: true, editing: null });
  };
  const openEdit = (row: CatalogRow) => {
    setForm({
      material_id: row.material_id,
      unit_price: String(Number(row.unit_price ?? 0)),
      status: row.status || "active",
    });
    setShowDialog({ open: true, editing: row });
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Supplier Portal"
        title="My Catalog"
        sub="The raw materials you supply with your unit prices. Procurement auto-prices every purchase order from this catalog — no manual totals."
        actions={
          <Button
            onClick={openAdd}
            className="bg-[image:var(--gradient-primary)] shadow-glow"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            Add Material &amp; Price
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Kpi
          label="Materials Listed"
          value={String(rows.length)}
          icon={Package}
          tone="primary"
        />
        <Kpi label="Active" value={String(activeRows.length)} icon={ListChecks} tone="success" />
        <Kpi label="Avg Unit Price" value={fmtMoney(avgPrice)} icon={DollarSign} tone="info" />
      </div>

      {!mySupplier ? (
        <Panel title="No supplier linked">
          <div className="flex flex-col items-center py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-warning mb-2" />
            <p className="text-sm text-muted-foreground">
              This portal account is not linked to a supplier record yet. Contact your buyer to
              link it before adding catalog prices.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel
          title={`${rows.length} material${rows.length === 1 ? "" : "s"} priced for ${mySupplier.name ?? "your catalog"}`}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                {["Material", "Unit", "Unit Price", "Status", "Updated"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id} className="border-white/5">
                  <TableCell className="font-medium">
                    {resolveRelation(r.materials)?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {resolveRelation(r.materials)?.unit ?? ""}
                  </TableCell>
                  <TableCell className="font-mono text-xs">{fmtMoney(r.unit_price)}</TableCell>
                  <TableCell>
                    <StatusBadge status={r.status} />
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {safeDate(r.updated_at ?? r.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => openEdit(r)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => {
                          if (
                            confirm(
                              `Remove ${resolveRelation(r.materials)?.name ?? "—"} from your catalog?`,
                            )
                          )
                            deleteMutation.mutate(r.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow className="border-white/5">
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-10 text-sm"
                  >
                    No materials listed yet — add the raw materials you supply and your unit
                    prices above.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>
      )}

      <Dialog
        open={showDialog.open}
        onOpenChange={(o) => {
          if (!o) {
            setShowDialog({ open: false, editing: null });
            setForm({ material_id: "", unit_price: "0", status: "active" });
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>
              {showDialog.editing ? "Edit Catalog Entry" : "Add Material & Price"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Raw Material *</Label>
              <Select
                value={form.material_id}
                onValueChange={(v) => setForm((f) => ({ ...f, material_id: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a material you supply" />
                </SelectTrigger>
                <SelectContent>
                  {(materials ?? []).map((m: any) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Your Unit Price *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={form.unit_price}
                onChange={(e) => setForm((f) => ({ ...f, unit_price: e.target.value }))}
                placeholder="e.g. 850"
              />
              <p className="text-[10px] text-muted-foreground">
                This price is what the buyer's purchase orders auto-calculate from.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDialog({ open: false, editing: null });
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              disabled={!form.material_id || !mySupplier}
              onClick={() =>
                showDialog.editing ? updateMutation.mutate() : createMutation.mutate()
              }
            >
              {showDialog.editing ? "Save Changes" : "Add to Catalog"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
