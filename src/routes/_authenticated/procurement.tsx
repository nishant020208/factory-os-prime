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
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, MaterialsCell } from "@/components/ui-parts";
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
import { NewPoDialog } from "@/components/new-po-dialog";
import { PO_STATUS_OPTIONS } from "@/lib/po";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, fmtMoneyK } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({
    meta: [
      { title: "Procurement — FactoryOS AI" },
      { name: "description", content: "Purchase orders, RFQs and supplier commitments." },
    ],
  }),
  component: ProcurementPage,
});

const TODAY_ISO = new Date().toISOString().split("T")[0];

function ProcurementPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");

  const [q, setQ] = useState("");
  const [newOpen, setNewOpen] = useState(false);
  const [editRow, setEditRow] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState("sent");
  const [editDate, setEditDate] = useState("");

  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", companyId],
    queryFn: async () =>
      (await supabase.from("suppliers").select("id, name").eq("company_id", companyId ?? "").order("name"))
        .data ?? [],
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

  const openEdit = (po: any) => {
    setEditRow(po);
    setEditStatus(po.status || "sent");
    setEditDate(po.expected_date ? String(po.expected_date).slice(0, 10) : "");
  };

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Supply Chain"
        title="Purchase Orders"
        sub="Every PO from request to receipt — materials auto-priced from the supplier's catalog, never typed."
        actions={
          !isAuditor ? (
            <Button onClick={() => setNewOpen(true)} className="bg-[image:var(--gradient-primary)] shadow-glow">
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
                <TableCell>
                  <MaterialsCell items={po.purchase_order_items} />
                </TableCell>
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
      <NewPoDialog open={newOpen} onOpenChange={setNewOpen} companyId={companyId} />

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
