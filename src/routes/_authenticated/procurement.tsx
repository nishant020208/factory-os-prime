import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoney, fmtMoneyK } from "@/lib/currency";
import { toast } from "sonner";
import { useMemo } from "react";

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({
    meta: [
      { title: "Procurement — FactoryOS AI" },
      { name: "description", content: "Purchase orders, RFQs and supplier commitments." },
    ],
  }),
  component: ProcurementPage,
});

// The PO total is NEVER typed — it is auto-calculated from the selected
// supplier's quoted RFQ price (unit price × RFQ quantity), exactly like the
// RFQ → Convert-to-PO flow. PO fields below stay supplier/date/status only.
const PO_BASE_FIELDS: FormField[] = [
  {
    key: "po_number",
    label: "PO Number",
    type: "text",
    placeholder: "PUR-2026-0004",
    required: true,
  },
  {
    key: "supplier_id",
    label: "Supplier",
    type: "select",
    required: true,
    options: [], // populated dynamically from the suppliers query
  },
  { key: "expected_date", label: "Expected Date", type: "date" },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "pending",
    options: [
      { value: "draft", label: "Draft" },
      { value: "pending", label: "Pending" },
      { value: "approved", label: "Approved" },
      { value: "received", label: "Received" },
    ],
  },
];

function ProcurementPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");

  // Fetch suppliers for the company
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", companyId],
    queryFn: async () =>
      (await supabase.from("suppliers").select("id, name").eq("company_id", companyId ?? "").order("name")).data ?? [],
    enabled: !!companyId,
  });

  // Open RFQ quotes (status=quoted on a sent RFQ) — the ONLY allowed source of
  // a PO's price. Keyed by supplier so the form can auto-derive the total.
  const { data: openQuotes } = useQuery({
    queryKey: ["open-rfq-quotes", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("rfq_responses")
          .select("id, supplier_id, unit_price, created_at, rfqs!inner(id, rfq_number, title, quantity, status)")
          .eq("status", "quoted")
          .eq("rfqs.status", "sent")
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const quoteBySupplier = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const q of openQuotes ?? []) {
      const arr = m.get(q.supplier_id) ?? [];
      arr.push(q);
      m.set(q.supplier_id, arr);
    }
    return m;
  }, [openQuotes]);

  // Supplier options + the auto-calculated Total Amount field (read-only).
  const formFields: FormField[] | undefined = useMemo(() => {
    if (!suppliers) return PO_BASE_FIELDS;
    const withSupplier = PO_BASE_FIELDS.map((f) =>
      f.key === "supplier_id"
        ? { ...f, options: suppliers.map((s) => ({ value: s.id, label: s.name })) }
        : f,
    );
    return [
      ...withSupplier,
      {
        key: "total_amount",
        label: "Total Amount",
        type: "number",
        placeholder: "Waiting for a quoted RFQ…",
        computed: (fd) => {
          const sid = fd.supplier_id;
          if (!sid) return "";
          const q = (quoteBySupplier.get(sid) ?? [])[0];
          if (!q) return "";
          return String(Number(q.unit_price) * Number(q.rfqs?.quantity ?? 0));
        },
      },
    ];
  }, [suppliers, quoteBySupplier]);

  // Build a supplier id→name lookup for the table
  const supplierMap = new Map((suppliers ?? []).map((s) => [s.id, s.name]));

  const { data } = useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async () =>
      (await supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });
  const total = (data ?? []).reduce((s, p) => s + Number(p.total_amount ?? 0), 0);
  const approved = data?.filter((p) => p.status === "approved").length ?? 0;
  const pending = data?.filter((p) => p.status === "pending").length ?? 0;
  const received = data?.filter((p) => p.status === "received").length ?? 0;

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      // Price is never manual: derive it from the supplier's open quote.
      const q = (quoteBySupplier.get(formData.supplier_id) ?? [])[0];
      if (!formData.supplier_id || !q) {
        throw new Error(
          "No open quote from this supplier to auto-price the PO. Send an RFQ and get their quote first.",
        );
      }
      const amount = Number(q.unit_price) * Number(q.rfqs?.quantity ?? 0);
      const { error } = await supabase.from("purchase_orders").insert({
        company_id: companyId!,
        po_number: formData.po_number,
        supplier_id: formData.supplier_id || null,
        total_amount: amount,
        expected_date: formData.expected_date || null,
        status: formData.status || "draft",
        created_by: companyId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      queryClient.invalidateQueries({ queryKey: ["open-rfq-quotes"] });
      toast.success("Purchase order created with the supplier's quoted price");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          po_number: d.po_number,
          supplier_id: d.supplier_id || null,
          total_amount: parseFloat(d.total_amount) || 0,
          expected_date: d.expected_date || null,
          status: d.status || "draft",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      queryClient.invalidateQueries({ queryKey: ["supplier-pos"] });
      toast.success("Purchase order updated");
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

  return (
    <ResourceView
      eyebrow="Supply Chain"
      title="Purchase Orders"
      sub="Every PO from request to receipt, with supplier scoring and AI recommendations."
      moduleName="procurement"
      rows={data}
      searchKeys={["po_number", "status"]}
      formFields={isAuditor ? undefined : formFields}
      onSubmit={isAuditor ? undefined : async (formData, editingRow) => {
        if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        else await createMutation.mutateAsync(formData);
      }}
      onDelete={isAuditor ? undefined : (row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi
            label="Total POs"
            value={String(data?.length ?? 0)}
            icon={ShoppingCart}
            tone="primary"
          />
          <Kpi
            label="Commit Value"
            value={fmtMoneyK(total)}
            delta="+6.4%"
            icon={DollarSign}
            tone="success"
          />
          <Kpi label="Approved" value={String(approved)} icon={CheckCircle2} tone="info" />
          <Kpi label="Pending" value={String(pending)} icon={Clock} tone="warning" />
        </>
      }
      columns={[
        {
          key: "po_number",
          header: "PO #",
          render: (r) => <span className="font-medium">{r.po_number}</span>,
        },
        {
          key: "supplier_id",
          header: "Supplier",
          render: (r) => (
            <span className="text-xs text-muted-foreground">
              {r.supplier_id ? (supplierMap.get(r.supplier_id) ?? "—") : "—"}
            </span>
          ),
        },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        {
          key: "total_amount",
          header: "Amount",
          render: (r) => (
            <span className="font-mono text-xs">
              {fmtMoney(r.total_amount)}
            </span>
          ),
        },
        {
          key: "expected_date",
          header: "Expected",
          render: (r) => (r.expected_date ? new Date(r.expected_date).toLocaleDateString() : "—"),
        },
        {
          key: "created_at",
          header: "Created",
          hideOnMobile: true,
          render: (r) => new Date(r.created_at).toLocaleDateString(),
        },
      ]}
    />
  );
}
