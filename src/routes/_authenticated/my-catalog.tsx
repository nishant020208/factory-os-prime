import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Pencil,
  Plus,
  DollarSign,
  ListChecks,
  AlertTriangle,
  Link2,
  Sparkles,
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
      { title: "Raw Materials I Supply — FactoryOS AI" },
      {
        name: "description",
        content:
          "The raw materials you supply — add new ones or link materials from the buyer's master, each with the unit price Procurement auto-uses on your purchase orders.",
      },
    ],
  }),
  component: MyCatalogPage,
});

const COMMON_UNITS = [
  "pcs",
  "kg",
  "liters",
  "meters",
  "sq ft",
  "cubic feet",
  "pairs",
  "box",
  "rolls",
  "set",
];

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

interface MaterialRow {
  id: string;
  name: string;
  unit: string | null;
}

type AddMode = "existing" | "new";

function MyCatalogPage() {
  const queryClient = useQueryClient();
  const { user, companyId } = useAuth();
  const [showDialog, setShowDialog] = useState<{ open: boolean; editing: CatalogRow | null }>({
    open: false,
    editing: null,
  });
  const [form, setForm] = useState({ unit_price: "0", status: "active" });
  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<AddMode>("existing");
  const [addForm, setAddForm] = useState({
    material_id: "",
    name: "",
    unit: "pcs",
    unit_price: "",
    status: "active",
  });

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

  // This supplier's linked materials — the Raw Materials list shown on the page.
  const { data: catalog } = useQuery({
    queryKey: ["my-catalog", mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier) return [];
      const { data } = await supabase
        .from("supplier_materials")
        .select(
          "id, supplier_id, material_id, unit_price, status, created_at, updated_at, materials(name, unit)",
        )
        .eq("supplier_id", mySupplier.id)
        .order("created_at", { ascending: false });
      return (data ?? []) as CatalogRow[];
    },
    enabled: !!mySupplier,
  });

  // The buyer's raw-material master — browsed when adding a material we supply.
  const { data: materials } = useQuery({
    queryKey: ["catalog-materials", companyId],
    queryFn: async () =>
      (await supabase.from("materials").select("id, name, unit").order("name")).data ?? [],
    enabled: !!companyId && !!mySupplier,
  });

  const linkedMaterialIds = new Set((catalog ?? []).map((r) => r.material_id));
  const addableMaterials = (materials ?? []).filter((m) => !linkedMaterialIds.has(m.id));

  const updateMutation = useMutation({
    mutationFn: async () => {
      const editing = showDialog.editing;
      if (!editing) throw new Error("Nothing selected");
      const price = parseFloat(form.unit_price) || 0;
      if (price < 0) throw new Error("Enter a valid unit price");
      const { error } = await supabase
        .from("supplier_materials")
        .update({ unit_price: price, status: form.status })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-catalog"] });
      toast.success("Your unit price updated");
      setShowDialog({ open: false, editing: null });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!mySupplier || !companyId) throw new Error("No supplier linked to this account");
      const price = parseFloat(addForm.unit_price) || 0;
      if (price <= 0) throw new Error("Enter a unit price greater than zero");

      let materialId = addForm.material_id;
      if (addMode === "new") {
        const name = addForm.name.trim();
        if (!name) throw new Error("Enter the raw material name");
        // Reuse an existing master material with the same name (case-insensitive)
        // instead of creating a duplicate company-level row.
        const existing = (materials ?? []).find(
          (m) => m.name.trim().toLowerCase() === name.toLowerCase(),
        );
        if (existing) {
          materialId = existing.id;
        } else {
          const { data: created, error: matErr } = await supabase
            .from("materials")
            .insert({
              company_id: companyId,
              name,
              unit: addForm.unit || "pcs",
              is_active: true,
              description: `Added by supplier ${mySupplier.name ?? ""}`.trim(),
            })
            .select("id")
            .single();
          if (matErr) throw matErr;
          materialId = created.id;
        }
      }
      if (!materialId) throw new Error("Choose a material to add");

      const { error } = await supabase.from("supplier_materials").insert({
        company_id: companyId,
        supplier_id: mySupplier.id,
        material_id: materialId,
        unit_price: price,
        status: addForm.status,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-catalog"] });
      queryClient.invalidateQueries({ queryKey: ["catalog-materials"] });
      toast.success(
        "Raw material added — it is now visible to your buyer's production and procurement teams",
      );
      setShowAdd(false);
      setAddMode("existing");
      setAddForm({ material_id: "", name: "", unit: "pcs", unit_price: "", status: "active" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rows = catalog ?? [];
  const activeRows = rows.filter((r) => r.status === "active");
  const avgPrice = rows.length
    ? rows.reduce((s, r) => s + Number(r.unit_price ?? 0), 0) / rows.length
    : 0;

  const openEdit = (row: CatalogRow) => {
    setForm({
      unit_price: String(Number(row.unit_price ?? 0)),
      status: row.status || "active",
    });
    setShowDialog({ open: true, editing: row });
  };

  const openAdd = () => {
    setAddMode("existing");
    setAddForm({ material_id: "", name: "", unit: "pcs", unit_price: "", status: "active" });
    setShowAdd(true);
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Supplier Portal"
        title="Raw Materials I Supply"
        sub="Raw materials you supply for your buyer's production — add a new one any time and it becomes part of the company master, ready for BOM and Production Planning. Your unit price is what Procurement auto-prices every purchase order from."
        actions={
          <Button onClick={openAdd} className="bg-[image:var(--gradient-primary)] shadow-glow">
            <Plus className="h-4 w-4 mr-1.5" />
            Add Raw Material
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4">
        <Kpi label="Materials Supplied" value={String(rows.length)} icon={Package} tone="primary" />
        <Kpi label="Active" value={String(activeRows.length)} icon={ListChecks} tone="success" />
        <Kpi label="Avg Unit Price" value={fmtMoney(avgPrice)} icon={DollarSign} tone="info" />
      </div>

      {!mySupplier ? (
        <Panel title="No supplier linked">
          <div className="flex flex-col items-center py-12 text-center">
            <AlertTriangle className="h-8 w-8 text-warning mb-2" />
            <p className="text-sm text-muted-foreground">
              This portal account is not linked to a supplier record yet. Contact your buyer to link
              it before adding the raw materials you supply.
            </p>
          </div>
        </Panel>
      ) : (
        <Panel
          title={`${rows.length} material${rows.length === 1 ? "" : "s"} supplied${mySupplier.name ? ` — ${mySupplier.name}` : ""}`}
        >
          <Table>
            <TableHeader>
              <TableRow className="border-white/5">
                {["Material", "Unit", "Your Unit Price", "Status", "Updated"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
                <TableHead className="w-16" />
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
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(r)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow className="border-white/5">
                  <TableCell
                    colSpan={6}
                    className="text-center text-muted-foreground py-10 text-sm"
                  >
                    No raw materials added yet — click “Add Raw Material” to list what you supply.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Panel>
      )}

      {/* Add Raw Material dialog */}
      <Dialog
        open={showAdd}
        onOpenChange={(o) => {
          if (!o) {
            setShowAdd(false);
            setAddForm({
              material_id: "",
              name: "",
              unit: "pcs",
              unit_price: "",
              status: "active",
            });
          }
        }}
      >
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Add Raw Material</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button
              type="button"
              variant={addMode === "existing" ? "default" : "outline"}
              className={addMode === "existing" ? "bg-[image:var(--gradient-primary)]" : ""}
              onClick={() => setAddMode("existing")}
            >
              <Link2 className="h-3.5 w-3.5 mr-1.5" />
              Link existing
            </Button>
            <Button
              type="button"
              variant={addMode === "new" ? "default" : "outline"}
              className={addMode === "new" ? "bg-[image:var(--gradient-primary)]" : ""}
              onClick={() => setAddMode("new")}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1.5" />
              New material
            </Button>
          </div>

          <div className="space-y-4 py-2">
            {addMode === "existing" ? (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Raw Material *</Label>
                <Select
                  value={addForm.material_id}
                  onValueChange={(v) => setAddForm((f) => ({ ...f, material_id: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pick from your buyer's material master" />
                  </SelectTrigger>
                  <SelectContent>
                    {(addableMaterials as MaterialRow[]).map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.name} ({m.unit})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {addableMaterials.length === 0 && (
                  <p className="text-[10px] text-warning">
                    Everything in the master is already on your list — switch to “New material” to
                    add something brand-new.
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Material Name *</Label>
                  <Input
                    value={addForm.name}
                    onChange={(e) => setAddForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Rosewood Planks"
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Created in the company's material master, so your buyer's BOM, Production
                    Planning and Procurement can use it immediately.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Unit *</Label>
                  <Select
                    value={addForm.unit}
                    onValueChange={(v) => setAddForm((f) => ({ ...f, unit: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_UNITS.map((u) => (
                        <SelectItem key={u} value={u}>
                          {u}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Your Unit Price *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={addForm.unit_price}
                onChange={(e) => setAddForm((f) => ({ ...f, unit_price: e.target.value }))}
                placeholder="e.g. 850"
              />
              <p className="text-[10px] text-muted-foreground">
                This price is what the buyer's purchase orders auto-calculate from.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select
                value={addForm.status}
                onValueChange={(v) => setAddForm((f) => ({ ...f, status: v }))}
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
                setShowAdd(false);
              }}
            >
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              disabled={
                addMutation.isPending ||
                (addMode === "existing" && !addForm.material_id) ||
                (addMode === "new" && !addForm.name.trim())
              }
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending ? "Adding…" : "Add to My Materials"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit own unit price dialog */}
      <Dialog
        open={showDialog.open}
        onOpenChange={(o) => {
          if (!o) {
            setShowDialog({ open: false, editing: null });
            setForm({ unit_price: "0", status: "active" });
          }
        }}
      >
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Update Your Unit Price</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Material</Label>
              <div className="rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm">
                {resolveRelation(showDialog.editing?.materials)?.name ?? "—"}
              </div>
              <p className="text-[10px] text-muted-foreground">
                The master material name and unit are managed on the company side — you update only
                your own pricing here.
              </p>
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
              disabled={!showDialog.editing}
              onClick={() => updateMutation.mutate()}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
