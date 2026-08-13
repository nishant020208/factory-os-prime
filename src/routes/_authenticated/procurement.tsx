import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ShoppingCart, DollarSign, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({
    meta: [
      { title: "Procurement — FactoryOS AI" },
      { name: "description", content: "Purchase orders, RFQs and supplier commitments." },
    ],
  }),
  component: ProcurementPage,
});

const PO_FORM_FIELDS: FormField[] = [
  {
    key: "po_number",
    label: "PO Number",
    type: "text",
    placeholder: "PUR-2026-0004",
    required: true,
  },
  {
    key: "total_amount",
    label: "Total Amount ($)",
    type: "number",
    placeholder: "25000",
    required: true,
  },
  { key: "expected_date", label: "Expected Date", type: "date" },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "draft",
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
      const { error } = await supabase.from("purchase_orders").insert({
        company_id: companyId!,
        po_number: formData.po_number,
        total_amount: parseFloat(formData.total_amount) || 0,
        expected_date: formData.expected_date || null,
        status: formData.status || "draft",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
      toast.success("Purchase order created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data: d }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase
        .from("purchase_orders")
        .update({
          po_number: d.po_number,
          total_amount: parseFloat(d.total_amount) || 0,
          expected_date: d.expected_date || null,
          status: d.status || "draft",
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase_orders"] });
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
      formFields={isAuditor ? undefined : PO_FORM_FIELDS}
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
            value={`$${(total / 1000).toFixed(0)}k`}
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
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        {
          key: "total_amount",
          header: "Amount",
          render: (r) => (
            <span className="font-mono text-xs">
              ${Number(r.total_amount ?? 0).toLocaleString()}
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
