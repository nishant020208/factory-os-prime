import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Receipt, Upload, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
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
import { useAuth } from "@/hooks/use-auth";
import { useSupplier } from "@/hooks/use-supplier";
import { fmtMoney } from "@/lib/currency";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/supplier-invoices")({
  head: () => ({
    meta: [
      { title: "Invoices — FactoryOS AI" },
      { name: "description", content: "Invoices you have raised" },
    ],
  }),
  component: SupplierInvoicesPage,
});

function SupplierInvoicesPage() {
  const queryClient = useQueryClient();
  const { user, companyId } = useAuth();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    po_id: "",
    invoice_number: "",
    gst_amount: "",
    total_amount: "",
    file_url: "",
  });

  const { mySupplier } = useSupplier();

  const { data: invoices } = useQuery({
    queryKey: ["supplier-invoices", companyId, mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier?.id) return [];
      const { data } = await supabase
        .from("supplier_invoices")
        .select("*, purchase_orders(po_number)")
        .eq("supplier_id", mySupplier.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!mySupplier?.id,
  });

  // Own fulfilled POs eligible for manual invoicing. POs whose invoice was
  // auto-generated when their delivery cleared QC are excluded — raising twice
  // for the same PO would create a duplicate record.
  const { data: fulfilledPos } = useQuery({
    queryKey: ["supplier-fulfilled-pos", companyId, mySupplier?.id],
    queryFn: async () => {
      if (!mySupplier?.id) return [];
      const { data: invoiced } = await supabase
        .from("supplier_invoices")
        .select("po_id")
        .eq("supplier_id", mySupplier.id);
      const alreadyInvoiced = new Set((invoiced ?? []).map((i: any) => i.po_id));
      const { data } = await supabase
        .from("purchase_orders")
        .select("id, po_number, total_amount")
        .eq("supplier_id", mySupplier.id)
        .in("status", ["received", "fulfilled"]);
      return (data ?? []).filter((p: any) => !alreadyInvoiced.has(p.id));
    },
    enabled: !!mySupplier?.id,
  });

  const raiseInvoice = useMutation({
    mutationFn: async () => {
      if (!mySupplier?.id || !companyId) throw new Error("Supplier not linked");
      if (!form.po_id || !form.invoice_number.trim())
        throw new Error("PO and invoice number are required");

      const total = parseFloat(form.total_amount) || 0;
      const gst = parseFloat(form.gst_amount) || 0;
      const fileUrl = form.file_url.trim() || null;

      // Single invoice per PO: if an auto purchase invoice already exists for
      // this PO, update it instead of inserting a conflicting duplicate.
      const { data: existing } = await supabase
        .from("supplier_invoices")
        .select("id")
        .eq("po_id", form.po_id)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("supplier_invoices")
          .update({
            invoice_number: form.invoice_number.trim(),
            gst_amount: gst,
            total_amount: total,
            file_url: fileUrl,
            status: "pending",
          })
          .eq("id", existing.id);
        if (error) throw error;
        return { updated: true };
      }

      const { error } = await supabase.from("supplier_invoices").insert({
        company_id: companyId,
        supplier_id: mySupplier.id,
        po_id: form.po_id || null,
        invoice_number: form.invoice_number.trim(),
        gst_amount: gst,
        total_amount: total,
        status: "pending",
        file_url: fileUrl,
        origin: "supplier",
      });
      if (error) throw error;
      return { updated: false };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["supplier-invoices"] });
      toast.success(
        res?.updated ? "Existing invoice updated — no duplicate created" : "Invoice submitted",
      );
      setOpen(false);
      setForm({ po_id: "", invoice_number: "", gst_amount: "", total_amount: "", file_url: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  const totalRaised = (invoices ?? []).reduce((s, i) => s + Number(i.total_amount ?? 0), 0);
  const pending = (invoices ?? []).filter((i) => i.status === "pending").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="supplier-invoices" />
      <PageHeader
        eyebrow="Supplier Portal"
        title="Invoices"
        sub="Invoices you have raised for fulfilled purchase orders."
        actions={
          <div className="flex items-center gap-2">
            <ModuleCopilot moduleName="supplier-invoices" />
            <Button
              size="sm"
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => setOpen(true)}
            >
              <Upload className="h-3.5 w-3.5 mr-1" />
              Raise Invoice
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total Raised" value={fmtMoney(totalRaised)} icon={Receipt} tone="primary" />
        <Kpi label="Pending" value={String(pending)} icon={FileText} tone="warning" />
        <Kpi
          label="All Invoices"
          value={String(invoices?.length ?? 0)}
          icon={Receipt}
          tone="info"
        />
      </div>

      <Panel title={`${invoices?.length ?? 0} Invoices`}>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-white/5">
                {["Invoice #", "PO", "GST", "Total", "Status", "Date"].map((h) => (
                  <TableHead
                    key={h}
                    className="text-[11px] uppercase tracking-wider text-muted-foreground"
                  >
                    {h}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {(invoices ?? []).map((inv) => {
                const po = inv.purchase_orders as unknown as { po_number?: string } | null;
                return (
                  <TableRow key={inv.id} className="border-white/5">
                    <TableCell className="font-medium">
                      {inv.invoice_number}
                      {(inv as any).origin === "auto" && (
                        <span className="ml-2 rounded-full bg-teal-500/10 border border-teal-500/30 px-1.5 py-0.5 text-[9px] font-medium text-teal-500">
                          AUTO
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{po?.po_number ?? "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{fmtMoney(inv.gst_amount)}</TableCell>
                    <TableCell className="text-xs font-mono">
                      {fmtMoney(inv.total_amount)}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={inv.status} />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(inv.created_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
              {(invoices ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                    No invoices yet. Raise one against a fulfilled PO.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Raise an Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-[11px] text-muted-foreground rounded-lg bg-muted/30 border border-white/5 px-2.5 py-2">
              When a delivery clears the buyer's incoming quality inspection, a purchase invoice is
              auto-generated for that PO (marked AUTO in your list). This form only lists POs
              without an invoice yet — use it to raise one manually.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Purchase Order *</Label>
              <select
                value={form.po_id}
                onChange={(e) => {
                  const po = (fulfilledPos ?? []).find((p) => p.id === e.target.value);
                  setForm((f) => ({
                    ...f,
                    po_id: e.target.value,
                    total_amount: po ? String(po.total_amount ?? "") : f.total_amount,
                  }));
                }}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm"
              >
                <option value="">Select a fulfilled PO…</option>
                {(fulfilledPos ?? []).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.po_number} — {fmtMoney(p.total_amount)}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Invoice Number *</Label>
              <Input
                value={form.invoice_number}
                onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                placeholder="e.g. INV-TEAK-004"
                className="h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">GST Amount</Label>
                <Input
                  type="number"
                  value={form.gst_amount}
                  onChange={(e) => setForm((f) => ({ ...f, gst_amount: e.target.value }))}
                  placeholder="0.00"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Total Amount</Label>
                <Input
                  type="number"
                  value={form.total_amount}
                  onChange={(e) => setForm((f) => ({ ...f, total_amount: e.target.value }))}
                  placeholder="0.00"
                  className="h-9 text-xs"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Document URL (optional)</Label>
              <Input
                value={form.file_url}
                onChange={(e) => setForm((f) => ({ ...f, file_url: e.target.value }))}
                placeholder="https://…/invoice.pdf"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => raiseInvoice.mutate()}
              disabled={raiseInvoice.isPending}
            >
              {raiseInvoice.isPending ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-1" />
              )}
              Submit Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
