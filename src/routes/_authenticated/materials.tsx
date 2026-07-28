import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Database, Package, Plus, Pencil, Trash2, DollarSign, RefreshCw, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/materials")({
  head: () => ({ meta: [
    { title: "Materials — FactoryOS AI" },
    { name: "description", content: "Material master list — single source for customer orders and production planning." },
  ]}),
  component: MaterialsPage,
});

function MaterialsPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();
  const [showNew, setShowNew] = useState(false);
  const [showEdit, setShowEdit] = useState<{ open: boolean; material: any | null }>({ open: false, material: null });
  const [form, setForm] = useState({ name: "", unit: "pcs", unit_cost: "0", is_active: "true" });

  const { data: materials } = useQuery({
    queryKey: ["materials", companyId],
    queryFn: async () => (await supabase.from("materials").select("*").eq("company_id", companyId!).order("name")).data ?? [],
    enabled: !!companyId,
  });

  const { data: departments } = useQuery({
    queryKey: ["mat-departments", companyId],
    queryFn: async () => (await supabase.from("departments").select("id,name").eq("company_id", companyId!).order("name")).data ?? [],
    enabled: !!companyId,
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("Not authenticated");
      const { error } = await supabase.from("materials").insert({
        company_id: companyId,
        name: form.name,
        unit: form.unit,
        unit_cost: parseFloat(form.unit_cost) || 0,
        is_active: form.is_active === "true",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material created");
      setShowNew(false);
      setForm({ name: "", unit: "pcs", unit_cost: "0", is_active: "true" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!showEdit.material) throw new Error("No material selected");
      const { error } = await supabase.from("materials").update({
        name: form.name,
        unit: form.unit,
        unit_cost: parseFloat(form.unit_cost) || 0,
        is_active: form.is_active === "true",
      }).eq("id", showEdit.material.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material updated");
      setShowEdit({ open: false, material: null });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("materials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["materials"] });
      toast.success("Material deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalValue = (materials ?? []).reduce((s: number, m: any) => s + Number(m.unit_cost ?? 0), 0);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Master Data"
        title="Materials"
        sub="Material master list — single source for customer orders and production planning."
        actions={
          <Button onClick={() => { setForm({ name: "", unit: "pcs", unit_cost: "0", is_active: "true" }); setShowNew(true); }} className="bg-[image:var(--gradient-primary)] shadow-glow">
            <Plus className="h-4 w-4 mr-1.5" />New Material
          </Button>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Total Materials" value={String(materials?.length ?? 0)} icon={Database} tone="primary" />
        <Kpi label="Active" value={String((materials ?? []).filter((m: any) => m.is_active !== false).length)} icon={Package} tone="success" />
        <Kpi label="Avg Unit Cost" value={`$${(totalValue / (materials?.length ?? 1)).toFixed(2)}`} icon={DollarSign} tone="info" />
        <Kpi label="Departments" value={String(departments?.length ?? 0)} icon={Layers} tone="primary" />
      </div>

      <Panel title={`${materials?.length ?? 0} materials`}>
        <Table>
          <TableHeader>
            <TableRow className="border-white/5">
              {["Name", "Unit", "Unit Cost", "Status", "Created"].map(h => (
                <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">{h}</TableHead>
              ))}
              <TableHead className="w-24" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(materials ?? []).map((m: any) => (
              <TableRow key={m.id} className="border-white/5">
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell>{m.unit}</TableCell>
                <TableCell className="font-mono text-xs">${Number(m.unit_cost ?? 0).toFixed(2)}</TableCell>
                <TableCell><StatusBadge status={m.is_active ? "active" : "inactive"} /></TableCell>
                <TableCell className="text-xs text-muted-foreground">{safeDate(m.created_at)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                      setForm({ name: m.name, unit: m.unit, unit_cost: String(m.unit_cost ?? 0), is_active: String(m.is_active) });
                      setShowEdit({ open: true, material: m });
                    }}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => {
                      if (confirm("Delete this material?")) deleteMutation.mutate(m.id);
                    }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Panel>

      {/* New/Edit Dialog */}
      <Dialog open={showNew || showEdit.open} onOpenChange={(o) => { if (!o) { setShowNew(false); setShowEdit({ open: false, material: null }); } }}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>{showEdit.open ? "Edit Material" : "New Material"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Stainless Steel 304" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unit</Label>
              <Select value={form.unit} onValueChange={(v) => setForm(f => ({ ...f, unit: v }))}>
                <SelectTrigger><SelectValue placeholder="Select unit" /></SelectTrigger>
                <SelectContent>
                  {["pcs", "kg", "m", "L", "ft", "lb", "sheet", "roll"].map(u => (
                    <SelectItem key={u} value={u}>{u}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Unit Cost ($)</Label>
              <Input type="number" value={form.unit_cost} onChange={(e) => setForm(f => ({ ...f, unit_cost: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Status</Label>
              <Select value={form.is_active} onValueChange={(v) => setForm(f => ({ ...f, is_active: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Active</SelectItem>
                  <SelectItem value="false">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNew(false); setShowEdit({ open: false, material: null }); }}>Cancel</Button>
            <Button onClick={() => showEdit.open ? updateMutation.mutate() : createMutation.mutate()} disabled={!form.name} className="bg-[image:var(--gradient-primary)]">
              {showEdit.open ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
