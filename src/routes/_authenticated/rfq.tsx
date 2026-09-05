import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
  Reply,
  ArrowRight,
  Eye,
  XCircle,
  ShoppingCart,
  AlertCircle,
  Warehouse,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { fmtMoney } from "@/lib/currency";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { useSupplier } from "@/hooks/use-supplier";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/rfq")({
  head: () => ({
    meta: [
      { title: "Request for Quotation — FactoryOS AI" },
      { name: "description", content: "RFQs sent to suppliers and their responses" },
    ],
  }),
  component: RfqPage,
});

interface RfqWithResponses {
  id: string;
  rfq_number: string | null;
  title: string;
  material_id: string | null;
  quantity: number;
  notes: string | null;
  status: string;
  supplier_ids: string[] | null;
  response_deadline: string | null;
  auto_generated: boolean;
  source_order_id: string | null;
  created_by: string | null;
  created_at: string;
  rfq_responses: Array<{
    id: string;
    rfq_id: string;
    supplier_id: string;
    unit_price: number;
    delivery_days: number | null;
    notes: string | null;
    status: string;
    created_at: string;
    suppliers?: { name: string } | null;
  }>;
}

function RfqPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isSupplier = roles.includes("supplier_portal");
  const { mySupplier } = useSupplier();

  // Dialog states
  const [showNew, setShowNew] = useState(false);
  const [showSendTo, setShowSendTo] = useState<string | null>(null);
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>([]);
  const [editRfq, setEditRfq] = useState<RfqWithResponses | null>(null);
  const [editForm, setEditForm] = useState({ quantity: "1", notes: "", response_deadline: "" });
  const [respondTo, setRespondTo] = useState<string | null>(null);
  const [viewRfq, setViewRfq] = useState<RfqWithResponses | null>(null);
  const [convertToPo, setConvertToPo] = useState<{
    rfqId: string;
    responseId: string;
    supplierId: string;
    unitPrice: number;
  } | null>(null);

  // Form states
  const [form, setForm] = useState({ material_id: "", quantity: "1", notes: "" });
  const [respForm, setRespForm] = useState({
    unit_price: "0",
    delivery_days: "7",
    minimum_order_quantity: "",
    notes: "",
  });
  const [poForm, setPoForm] = useState({
    po_number: "",
    expected_date: "",
    total_amount: "",
    delivery_warehouse_id: "",
  });

  // Fetch RFQs
  const { data: rfqs, isLoading } = useQuery({
    queryKey: ["rfq-list", companyId, mySupplier?.id],
    queryFn: async () => {
      let query = supabase
        .from("rfqs")
        .select("*, rfq_responses(*, suppliers(name))")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });

      // Supplier sees only RFQs where they are in supplier_ids
      if (isSupplier && mySupplier?.id) {
        query = query.contains("supplier_ids", [mySupplier.id]);
      }

      const { data } = await query;
      return (data ?? []) as RfqWithResponses[];
    },
    enabled: !!companyId && (!isSupplier || !!mySupplier?.id),
  });

  // Fetch materials for Procurement Manager
  const { data: materials } = useQuery({
    queryKey: ["rfq-materials", companyId],
    queryFn: async () => (await supabase.from("materials").select("id, name, unit")).data ?? [],
    enabled: !!companyId && !isSupplier,
  });

  // Fetch suppliers for Procurement Manager — only those with linked user accounts (approved/onboarded)
  const { data: suppliers } = useQuery({
    queryKey: ["rfq-suppliers", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("suppliers")
          .select("id, name")
          .eq("status", "active")
          .eq("company_id", companyId!)
          .not("user_id", "is", null)
      ) // Only suppliers with linked portal accounts
      .data ?? [],
    enabled: !!companyId && !isSupplier,
  });

  // Warehouses for delivery destination
  const { data: warehouses } = useQuery({
    queryKey: ["warehouses", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("warehouses")
          .select("id, name, code")
          .eq("company_id", companyId!)
          .order("name")
      ).data ?? [],
    enabled: !!companyId && !isSupplier,
  });

  // Edit an auto-created (or any draft) RFQ before sending it out.
  const updateRfq = useMutation({
    mutationFn: async ({
      rfqId,
      quantity,
      notes,
      response_deadline,
    }: {
      rfqId: string;
      quantity: string;
      notes: string;
      response_deadline: string;
    }) => {
      if (!companyId) throw new Error("Not authenticated");
      const qty = Number(quantity);
      if (!(qty > 0)) throw new Error("Quantity must be greater than 0");
      const patch = {
        quantity: qty,
        notes: notes || null,
        response_deadline: response_deadline || null,
      } as const;
      const { error } = await supabase
        .from("rfqs")
        .update(patch)
        .eq("id", rfqId)
        .eq("status", "draft");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("RFQ updated — send it to suppliers when ready");
      setEditRfq(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Computed stats
  const sent = rfqs?.filter((r) => r.status === "sent").length ?? 0;
  const totalQuotes = rfqs?.reduce((s, r) => s + r.rfq_responses.length, 0) ?? 0;
  const closed = rfqs?.filter((r) => r.status === "closed").length ?? 0;
  const pendingForMe =
    rfqs?.filter((r) => {
      if (!isSupplier || !mySupplier?.id) return false;
      return !r.rfq_responses.some((resp) => resp.supplier_id === mySupplier.id);
    }).length ?? 0;

  // Create RFQ mutation
  const createRfq = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      if (!form.material_id) throw new Error("Select a material");

      const material = (materials ?? []).find((m: any) => m.id === form.material_id);
      const rfqNumber = `RFQ-${new Date().getFullYear()}-${String(Date.now() % 100000).padStart(5, "0")}`;

      const { error } = await supabase.from("rfqs").insert({
        company_id: companyId,
        rfq_number: rfqNumber,
        title: (material as any)?.name ?? "Material",
        material_id: form.material_id,
        quantity: Number(form.quantity) || 1,
        notes: form.notes || null,
        status: "draft",
        created_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("RFQ created — select suppliers to send it");
      setShowNew(false);
      setForm({ material_id: "", quantity: "1", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Send RFQ to selected suppliers
  const sendRfq = useMutation({
    mutationFn: async ({ rfqId, supplierIds }: { rfqId: string; supplierIds: string[] }) => {
      if (!supplierIds.length) throw new Error("Select at least one supplier");

      // Create rfq_responses rows for each selected supplier
      const { error } = await supabase.from("rfq_responses").insert(
        supplierIds.map((sid) => ({
          rfq_id: rfqId,
          supplier_id: sid,
          status: "pending",
        })),
      );
      if (error) throw error;

      // Update RFQ status and store which suppliers it was sent to
      const { error: upErr } = await supabase
        .from("rfqs")
        .update({ status: "sent", supplier_ids: supplierIds })
        .eq("id", rfqId);
      if (upErr) throw upErr;

      // Notify each selected supplier individually
      for (const sid of supplierIds) {
        const { data: supplierUser } = await supabase
          .from("suppliers")
          .select("user_id, name")
          .eq("id", sid)
          .maybeSingle();

        const rfq = (rfqs ?? []).find((r) => r.id === rfqId);

        if (supplierUser?.user_id && rfq) {
          await supabase.from("notifications").insert({
            company_id: companyId!,
            to_user: supplierUser.user_id,
            title: "New RFQ Request",
            body: `You have received a new RFQ: ${rfq.rfq_number ?? "RFQ"} for ${rfq.title}. Please submit your quote.`,
            severity: "info",
            related_entity_type: "rfq",
            related_entity_id: rfqId,
          });
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("RFQ sent to selected suppliers");
      setShowSendTo(null);
      setSelectedSuppliers([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Supplier submits quote
  const submitQuote = useMutation({
    mutationFn: async ({ rfqId }: { rfqId: string }) => {
      if (!mySupplier?.id) throw new Error("Supplier account not linked");

      const { error } = await supabase.from("rfq_responses").upsert(
        {
          rfq_id: rfqId,
          supplier_id: mySupplier.id,
          unit_price: Number(respForm.unit_price) || 0,
          delivery_days: Number(respForm.delivery_days) || 0,
          notes: respForm.notes || null,
          status: "quoted",
        },
        { onConflict: "rfq_id,supplier_id" },
      );
      if (error) throw error;

      // Notify Procurement Manager
      const { data: rfq } = await supabase
        .from("rfqs")
        .select("created_by, rfq_number, title")
        .eq("id", rfqId)
        .maybeSingle();

      if (rfq?.created_by) {
        await supabase.from("notifications").insert({
          company_id: companyId!,
          to_user: rfq.created_by,
          title: "RFQ Quote Received",
          body: `${mySupplier.name} has submitted a quote for ${rfq.rfq_number ?? "RFQ"} (${rfq.title}).`,
          severity: "info",
          related_entity_type: "rfq",
          related_entity_id: rfqId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("Quote submitted successfully");
      setRespondTo(null);
      setRespForm({ unit_price: "0", delivery_days: "7", minimum_order_quantity: "", notes: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Supplier declines RFQ
  const declineRfq = useMutation({
    mutationFn: async ({ rfqId }: { rfqId: string }) => {
      if (!mySupplier?.id) throw new Error("Supplier account not linked");

      const { error } = await supabase
        .from("rfq_responses")
        .update({ status: "declined" })
        .eq("rfq_id", rfqId)
        .eq("supplier_id", mySupplier.id);
      if (error) throw error;

      // Notify Procurement Manager
      const { data: rfq } = await supabase
        .from("rfqs")
        .select("created_by, rfq_number, title")
        .eq("id", rfqId)
        .maybeSingle();

      if (rfq?.created_by) {
        await supabase.from("notifications").insert({
          company_id: companyId!,
          to_user: rfq.created_by,
          title: "RFQ Declined",
          body: `${mySupplier.name} has declined the RFQ: ${rfq.rfq_number ?? "RFQ"} (${rfq.title}).`,
          severity: "warning",
          related_entity_type: "rfq",
          related_entity_id: rfqId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      toast.success("RFQ declined");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Procurement Manager marks supplier response as viewed
  const markViewed = useMutation({
    mutationFn: async ({ responseId }: { responseId: string }) => {
      const { error } = await supabase
        .from("rfq_responses")
        .update({ status: "viewed" })
        .eq("id", responseId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
    },
  });

  // Convert winning quote to PO
  const convertToPoMutation = useMutation({
    mutationFn: async () => {
      if (!convertToPo || !companyId) throw new Error("Invalid conversion data");

      // 1. Create the Purchase Order atomically through the shared RPC: the
      // material line (this RFQ's material at the winning quote's unit price)
      // is written together with the PO, and the order always starts "sent".
      const rfqRow = (rfqs ?? []).find((r) => r.id === convertToPo.rfqId);
      const { data: poRes, error: poError } = await supabase.rpc(
        "create_purchase_order_with_items",
        {
          p_company_id: companyId,
          p_po_number: poForm.po_number || `PO-${Date.now().toString().slice(-6)}`,
          p_supplier_id: convertToPo.supplierId,
          p_expected_date: poForm.expected_date || "",
          p_items: [
            {
              material_id: rfqRow?.material_id ?? null,
              quantity: Number(rfqRow?.quantity ?? 1),
              unit_price: convertToPo.unitPrice,
            },
          ],
        },
      );
      if (poError) throw poError;
      const poResult = poRes as any;
      if (!poResult?.ok) throw new Error(poResult?.error ?? "Failed to create the purchase order");
      const newPo = { id: poResult.po_id, po_number: poResult.po_number };

      // Stamp the delivery warehouse on the new PO
      if (poResult.po_id && poForm.delivery_warehouse_id) {
        await (supabase
          .from("purchase_orders") as any)
          .update({ delivery_warehouse_id: poForm.delivery_warehouse_id })
          .eq("id", poResult.po_id);
      }

      // 2. Update RFQ status to converted
      const { error: rfqError } = await supabase
        .from("rfqs")
        .update({ status: "converted" })
        .eq("id", convertToPo.rfqId);
      if (rfqError) throw rfqError;

      // 3. Mark winning supplier's response as accepted
      const { error: winError } = await supabase
        .from("rfq_responses")
        .update({ status: "accepted" })
        .eq("id", convertToPo.responseId);
      if (winError) throw winError;

      // 4. Mark losing suppliers' responses as declined and notify them
      const { data: allResponses } = await supabase
        .from("rfq_responses")
        .select("id, supplier_id")
        .eq("rfq_id", convertToPo.rfqId)
        .neq("id", convertToPo.responseId);

      for (const resp of allResponses ?? []) {
        await supabase.from("rfq_responses").update({ status: "declined" }).eq("id", resp.id);

        // Notify losing supplier
        const { data: supplier } = await supabase
          .from("suppliers")
          .select("user_id, name")
          .eq("id", resp.supplier_id)
          .maybeSingle();

        if (supplier?.user_id) {
          await supabase.from("notifications").insert({
            company_id: companyId!,
            to_user: supplier.user_id,
            title: "RFQ Closed - Not Selected",
            body: `The RFQ has been awarded to another supplier. Thank you for your quote.`,
            severity: "info",
            related_entity_type: "rfq",
            related_entity_id: convertToPo.rfqId,
          });
        }
      }

      // 5. Notify winning supplier about new PO
      const { data: winningSupplier } = await supabase
        .from("suppliers")
        .select("user_id, name")
        .eq("id", convertToPo.supplierId)
        .maybeSingle();

      if (winningSupplier?.user_id) {
        await supabase.from("notifications").insert({
          company_id: companyId!,
          to_user: winningSupplier.user_id,
          title: "Purchase Order Created from RFQ",
          body: `Congratulations! Your quote was accepted. A new PO ${newPo.po_number} has been created.`,
          severity: "success",
          related_entity_type: "purchase_order",
          related_entity_id: newPo.id,
        });
      }

      return newPo;
    },
    onSuccess: (newPo) => {
      queryClient.invalidateQueries({ queryKey: ["rfq-list"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success(`PO ${newPo.po_number} created from RFQ`);
      setConvertToPo(null);
      setPoForm({ po_number: "", expected_date: "", total_amount: "", delivery_warehouse_id: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Sort quotes by price for comparison
  const sortedQuotes = useMemo(() => {
    if (!viewRfq) return [];
    return [...viewRfq.rfq_responses]
      .filter((r) => r.status === "quoted")
      .sort((a, b) => a.unit_price - b.unit_price);
  }, [viewRfq]);

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="rfq" />
      <PageHeader
        eyebrow={isSupplier ? "Supplier Portal" : "Procurement"}
        title="Request for Quotation"
        sub={
          isSupplier
            ? "RFQs sent to you — submit your best quote or decline."
            : "Create RFQs, send to specific suppliers, compare quotes, and convert the winner to a PO."
        }
        actions={
          <div className="flex items-center gap-2">
            <ModuleCopilot moduleName="rfq" />
            {!isSupplier && (
              <Button
                className="bg-[image:var(--gradient-primary)] shadow-glow"
                onClick={() => setShowNew(true)}
              >
                <FileText className="h-4 w-4 mr-1.5" />
                New RFQ
              </Button>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Total RFQs" value={String(rfqs?.length ?? 0)} icon={FileText} tone="primary" />
        <Kpi label="Sent" value={String(sent)} icon={Send} tone="info" />
        <Kpi label="Quotes Received" value={String(totalQuotes)} icon={Reply} tone="success" />
        {isSupplier && (
          <Kpi label="Pending Response" value={String(pendingForMe)} icon={Clock} tone="warning" />
        )}
        {!isSupplier && (
          <Kpi label="Converted to PO" value={String(closed)} icon={ShoppingCart} tone="success" />
        )}
      </div>

      {/* Create RFQ Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Create New RFQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Material *</Label>
              <select
                className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={form.material_id}
                onChange={(e) => setForm((f) => ({ ...f, material_id: e.target.value }))}
              >
                <option value="">Select material…</option>
                {(materials ?? []).map((m: any) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit ?? "unit"})
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantity Needed *</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                placeholder="e.g. 500"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes / Specifications</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Teak wood, kiln-dried, grade A, 10-day delivery"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => createRfq.mutate()}
              disabled={createRfq.isPending}
            >
              {createRfq.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Create RFQ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send to Suppliers Dialog */}
      <Dialog open={!!showSendTo} onOpenChange={(o) => !o && setShowSendTo(null)}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Select Suppliers to Send RFQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Choose which suppliers should receive this RFQ. Each supplier will only see that they
              were invited — they won't see other suppliers or their quotes.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Suppliers *</Label>
              <div className="max-h-64 overflow-y-auto space-y-2 border border-white/10 rounded-lg p-3">
                {(suppliers ?? []).map((s) => (
                  <label
                    key={s.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={selectedSuppliers.includes(s.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedSuppliers((prev) => [...prev, s.id]);
                        } else {
                          setSelectedSuppliers((prev) => prev.filter((id) => id !== s.id));
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300"
                    />
                    <span className="text-sm font-medium">{s.name}</span>
                  </label>
                ))}
                {(suppliers ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">
                    No suppliers found. Add suppliers in the Suppliers tab first.
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Button
                size="sm"
                variant="outline"
                className="text-xs"
                onClick={() => {
                  const allIds = (suppliers ?? []).map((s) => s.id);
                  setSelectedSuppliers(allIds);
                }}
              >
                Select All
              </Button>
              <span className="text-xs text-muted-foreground">
                {selectedSuppliers.length} of {suppliers?.length ?? 0} selected
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSendTo(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => {
                if (showSendTo) {
                  sendRfq.mutate({ rfqId: showSendTo, supplierIds: selectedSuppliers });
                }
              }}
              disabled={sendRfq.isPending || selectedSuppliers.length === 0}
            >
              {sendRfq.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
              ) : (
                <Send className="h-4 w-4 mr-1.5" />
              )}
              Send to {selectedSuppliers.length} Supplier{selectedSuppliers.length !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Draft RFQ Dialog — review auto-created RFQs before sending */}
      <Dialog open={!!editRfq} onOpenChange={(o) => !o && setEditRfq(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Review RFQ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editRfq && editRfq.auto_generated && (
              <p className="text-xs text-amber-400 bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5">
                ⚡ This RFQ was auto-created from a production material shortfall. Adjust the
                quantity or delivery deadline if needed, then send it to your chosen suppliers.
              </p>
            )}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Material</Label>
              <div className="text-sm">{editRfq?.title ?? "—"}</div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quantity Needed *</Label>
              <Input
                type="number"
                value={editForm.quantity}
                onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Response Deadline</Label>
              <Input
                type="date"
                value={editForm.response_deadline}
                onChange={(e) => setEditForm((f) => ({ ...f, response_deadline: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes / Specifications</Label>
              <Input
                value={editForm.notes}
                onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRfq(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() =>
                editRfq &&
                updateRfq.mutate({
                  rfqId: editRfq.id,
                  quantity: editForm.quantity,
                  notes: editForm.notes,
                  response_deadline: editForm.response_deadline,
                })
              }
              disabled={updateRfq.isPending}
            >
              {updateRfq.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Supplier Quote Submission Dialog */}
      <Dialog open={!!respondTo} onOpenChange={(o) => !o && setRespondTo(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Submit Your Quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              Provide your best pricing and delivery estimate for this RFQ.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Quoted Unit Price *</Label>
              <Input
                type="number"
                value={respForm.unit_price}
                onChange={(e) => setRespForm((f) => ({ ...f, unit_price: e.target.value }))}
                placeholder="e.g. 85.00"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Delivery Time (days) *</Label>
                <Input
                  type="number"
                  value={respForm.delivery_days}
                  onChange={(e) => setRespForm((f) => ({ ...f, delivery_days: e.target.value }))}
                  placeholder="e.g. 7"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Min Order Qty (optional)</Label>
                <Input
                  type="number"
                  value={respForm.minimum_order_quantity}
                  onChange={(e) =>
                    setRespForm((f) => ({ ...f, minimum_order_quantity: e.target.value }))
                  }
                  placeholder="e.g. 100"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Notes</Label>
              <Input
                value={respForm.notes}
                onChange={(e) => setRespForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="e.g. Free shipping for orders above $5000"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="text-destructive"
              onClick={() => {
                if (respondTo) declineRfq.mutate({ rfqId: respondTo });
              }}
              disabled={declineRfq.isPending}
            >
              {declineRfq.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-1" />
              ) : (
                <XCircle className="h-4 w-4 mr-1" />
              )}
              Decline
            </Button>
            <Button variant="outline" onClick={() => setRespondTo(null)}>
              Cancel
            </Button>
            <Button
              className="bg-[image:var(--gradient-primary)]"
              onClick={() => respondTo && submitQuote.mutate({ rfqId: respondTo })}
              disabled={submitQuote.isPending}
            >
              {submitQuote.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              Submit Quote
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quote Comparison Dialog */}
      <Dialog open={!!viewRfq} onOpenChange={(o) => !o && setViewRfq(null)}>
        <DialogContent className="sm:max-w-[900px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono text-muted-foreground">{viewRfq?.rfq_number}</span>
              <span>Quote Comparison</span>
            </DialogTitle>
          </DialogHeader>
          {viewRfq && (
            <div className="space-y-4 py-2">
              {/* RFQ Details */}
              <div className="bg-muted/30 rounded-lg p-4 text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-muted-foreground">Material:</span>{" "}
                    <span className="font-medium">{viewRfq.title}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Quantity:</span>{" "}
                    <span className="font-medium">{viewRfq.quantity.toLocaleString()}</span>
                  </div>
                  {viewRfq.notes && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Notes:</span>{" "}
                      <span>{viewRfq.notes}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Quotes Comparison */}
              {sortedQuotes.length > 0 ? (
                <>
                  {/* Desktop: Table View */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent border-white/5">
                          <TableHead className="text-[11px] uppercase">Rank</TableHead>
                          <TableHead className="text-[11px] uppercase">Supplier</TableHead>
                          <TableHead className="text-[11px] uppercase">Unit Price</TableHead>
                          <TableHead className="text-[11px] uppercase">Delivery</TableHead>
                          <TableHead className="text-[11px] uppercase">Notes</TableHead>
                          <TableHead className="text-[11px] uppercase">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedQuotes.map((quote, idx) => (
                          <TableRow key={quote.id} className="border-white/5">
                            <TableCell>
                              {idx === 0 ? (
                                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success/20 text-success text-xs font-bold">
                                  1
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-sm">{idx + 1}</span>
                              )}
                            </TableCell>
                            <TableCell className="font-medium">
                              {quote.suppliers?.name ?? "Supplier"}
                              {idx === 0 && (
                                <span className="ml-2 text-[10px] text-success font-medium">
                                  BEST PRICE
                                </span>
                              )}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {fmtMoney(quote.unit_price)}
                            </TableCell>
                            <TableCell>{quote.delivery_days ?? "—"} days</TableCell>
                            <TableCell className="text-muted-foreground text-xs max-w-[200px] truncate">
                              {quote.notes ?? "—"}
                            </TableCell>
                            <TableCell>
                              {viewRfq.status !== "converted" && (
                                <Button
                                  size="sm"
                                  className="h-7 text-xs bg-success hover:bg-success/90"
                                  onClick={() => {
                                    setConvertToPo({
                                      rfqId: viewRfq.id,
                                      responseId: quote.id,
                                      supplierId: quote.supplier_id,
                                      unitPrice: quote.unit_price,
                                    });
                                    setPoForm({
                                      po_number: `PO-${Date.now().toString().slice(-6)}`,
                                      expected_date: "",
                                      delivery_warehouse_id: "",
                                      total_amount: String(quote.unit_price * viewRfq.quantity),
                                    });
                                  }}
                                >
                                  <ArrowRight className="h-3 w-3 mr-1" />
                                  Convert to PO
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Mobile: Card View */}
                  <div className="md:hidden space-y-3">
                    {sortedQuotes.map((quote, idx) => (
                      <div
                        key={quote.id}
                        className={`rounded-lg border p-4 ${
                          idx === 0 ? "border-success/50 bg-success/5" : "border-white/10"
                        }`}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            {idx === 0 && (
                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-success/20 text-success text-xs font-bold">
                                1
                              </span>
                            )}
                            <span className="font-medium">
                              {quote.suppliers?.name ?? "Supplier"}
                            </span>
                          </div>
                          {idx === 0 && (
                            <span className="text-[10px] text-success font-medium">BEST PRICE</span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <span className="text-muted-foreground text-xs">Price:</span>
                            <div className="font-mono font-medium">
                              {fmtMoney(quote.unit_price)}
                            </div>
                          </div>
                          <div>
                            <span className="text-muted-foreground text-xs">Delivery:</span>
                            <div>{quote.delivery_days ?? "—"} days</div>
                          </div>
                        </div>
                        {quote.notes && (
                          <div className="mt-2 text-xs text-muted-foreground">{quote.notes}</div>
                        )}
                        {viewRfq.status !== "converted" && (
                          <Button
                            size="sm"
                            className="w-full mt-3 h-8 text-xs bg-success hover:bg-success/90"
                            onClick={() => {
                              setConvertToPo({
                                rfqId: viewRfq.id,
                                responseId: quote.id,
                                supplierId: quote.supplier_id,
                                unitPrice: quote.unit_price,
                              });
                              setPoForm({
                                po_number: `PO-${Date.now().toString().slice(-6)}`,
                                expected_date: "",
                                delivery_warehouse_id: "",
                                total_amount: String(quote.unit_price * viewRfq.quantity),
                              });
                            }}
                          >
                            <ArrowRight className="h-3 w-3 mr-1" />
                            Convert to PO
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p>No quotes received yet. Waiting for suppliers to respond.</p>
                </div>
              )}

              {/* Pending Suppliers */}
              {viewRfq.rfq_responses.filter((r) => r.status === "pending").length > 0 && (
                <div className="bg-muted/30 rounded-lg p-3 text-sm">
                  <span className="text-muted-foreground">
                    Waiting for {viewRfq.rfq_responses.filter((r) => r.status === "pending").length}{" "}
                    supplier(s) to respond…
                  </span>
                </div>
              )}

              {viewRfq.status === "converted" && (
                <div className="bg-success/10 border border-success/30 rounded-lg p-3 text-sm text-success">
                  This RFQ has been converted to a Purchase Order.
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRfq(null)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to PO Dialog */}
      <Dialog open={!!convertToPo} onOpenChange={(o) => !o && setConvertToPo(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Convert Quote to Purchase Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-xs text-muted-foreground">
              This will create a real Purchase Order for the selected supplier at the quoted price.
            </p>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">PO Number *</Label>
              <Input
                value={poForm.po_number}
                onChange={(e) => setPoForm((f) => ({ ...f, po_number: e.target.value }))}
                placeholder="e.g. PO-2026-001"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Expected Delivery Date</Label>
              <Input
                type="date"
                value={poForm.expected_date}
                onChange={(e) => setPoForm((f) => ({ ...f, expected_date: e.target.value }))}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Warehouse className="h-3.5 w-3.5" />
                Deliver To Warehouse *
              </Label>
              <Select
                value={poForm.delivery_warehouse_id}
                onValueChange={(v) => setPoForm((f) => ({ ...f, delivery_warehouse_id: v }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Select destination warehouse" />
                </SelectTrigger>
                <SelectContent>
                  {((warehouses ?? []) as any[]).map((w: any) => (
                    <SelectItem key={w.id} value={w.id}>
                      <span className="font-mono text-xs text-muted-foreground mr-2">{w.code}</span>
                      {w.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Total Amount</Label>
              <Input type="number" value={poForm.total_amount} disabled className="h-9 font-mono" />
              <p className="text-[10px] text-muted-foreground">
                Auto-calculated from the supplier's quote — {fmtMoney(Number(poForm.total_amount))}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertToPo(null)}>
              Cancel
            </Button>
            <Button
              className="bg-success hover:bg-success/90"
              onClick={() => convertToPoMutation.mutate()}
              disabled={convertToPoMutation.isPending || !poForm.delivery_warehouse_id}
              loading={convertToPoMutation.isPending}
            >
              {convertToPoMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              Create Purchase Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* RFQ List */}
      <Panel title={`${rfqs?.length ?? 0} RFQs`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (rfqs ?? []).length === 0 ? (
          <EmptyState
            title="No RFQs yet"
            sub="Create an RFQ to request quotes from suppliers before committing to a Purchase Order."
          />
        ) : (
          <div className="space-y-3">
            {(rfqs ?? []).map((rfq) => {
              const respList = rfq.rfq_responses ?? [];
              const quotedCount = respList.filter((r) => r.status === "quoted").length;
              const totalInvited = respList.length;
              const myResponse = isSupplier
                ? respList.find((r) => r.supplier_id === mySupplier?.id)
                : null;

              return (
                <div
                  key={rfq.id}
                  className="rounded-xl bg-card/60 border border-white/5 p-4 hover:border-white/10 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs text-muted-foreground">
                          {rfq.rfq_number ?? "RFQ"}
                        </span>
                        {rfq.auto_generated && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 px-2 py-0.5 text-[10px] font-medium">
                            ⚡ Auto — shortfall
                          </span>
                        )}
                        <span className="text-sm font-medium">{rfq.title ?? "Material"}</span>
                        <span className="text-xs text-muted-foreground">
                          × {Number(rfq.quantity).toLocaleString()}
                        </span>
                        <StatusBadge
                          status={
                            rfq.status === "converted"
                              ? "completed"
                              : rfq.status === "sent"
                                ? "active"
                                : "pending"
                          }
                        />
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-1">
                        {rfq.notes ?? "—"} · Created {safeDate(rfq.created_at)}
                      </div>
                      {!isSupplier && rfq.status === "sent" && (
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {quotedCount} of {totalInvited} suppliers quoted
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Procurement Manager Actions */}
                      {!isSupplier && rfq.status === "draft" && (
                        <>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={() => {
                              setEditRfq(rfq);
                              setEditForm({
                                quantity: String(rfq.quantity ?? 1),
                                notes: rfq.notes ?? "",
                                response_deadline: rfq.response_deadline ?? "",
                              });
                            }}
                          >
                            <FileText className="h-3 w-3 mr-1" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => {
                              setShowSendTo(rfq.id);
                              setSelectedSuppliers([]);
                            }}
                            disabled={sendRfq.isPending}
                          >
                            <Send className="h-3 w-3 mr-1" /> Send to Suppliers
                          </Button>
                        </>
                      )}

                      {!isSupplier && (rfq.status === "sent" || rfq.status === "converted") && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => setViewRfq(rfq)}
                        >
                          <Eye className="h-3 w-3 mr-1" /> View Quotes
                        </Button>
                      )}

                      {/* Supplier Actions */}
                      {isSupplier && rfq.status === "sent" && !myResponse && (
                        <Button
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setRespondTo(rfq.id)}
                        >
                          <Reply className="h-3 w-3 mr-1" /> Submit Quote
                        </Button>
                      )}

                      {isSupplier && myResponse && (
                        <div className="text-xs text-muted-foreground">
                          {myResponse.status === "quoted" && (
                            <span className="text-success">✓ Quote Submitted</span>
                          )}
                          {myResponse.status === "accepted" && (
                            <span className="text-success font-medium">✓ Quote Accepted → PO</span>
                          )}
                          {myResponse.status === "declined" && (
                            <span className="text-muted-foreground">Declined</span>
                          )}
                          {myResponse.status === "pending" && (
                            <span className="text-warning">Awaiting your response</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quote Summary for Procurement */}
                  {!isSupplier && respList.length > 0 && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {respList.map((r) => (
                        <div
                          key={r.id}
                          className="rounded-lg bg-muted/30 border border-white/5 p-2.5 text-xs"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{r.suppliers?.name ?? "Supplier"}</span>
                            <StatusBadge status={r.status} />
                          </div>
                          {r.status === "quoted" && (
                            <div className="text-muted-foreground mt-1">
                              {fmtMoney(r.unit_price)} / unit · {r.delivery_days ?? "—"} days
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
