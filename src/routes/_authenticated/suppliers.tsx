import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Truck, Star, DollarSign, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({ meta: [
    { title: "Suppliers — FactoryOS AI" },
    { name: "description", content: "Supplier management, performance tracking and procurement." },
  ]}),
  component: SuppliersPage,
});

const SUPPLIER_FORM_FIELDS: FormField[] = [
  { key: "name", label: "Company Name", type: "text", placeholder: "Supplier Inc", required: true },
  { key: "contact_email", label: "Contact Email", type: "email", placeholder: "sales@supplier.com" },
  { key: "contact_phone", label: "Phone", type: "text", placeholder: "+46 8 123 456" },
  { key: "rating", label: "Rating (0-5)", type: "number", placeholder: "4.5", defaultValue: "4.0" },
  { key: "status", label: "Status", type: "select", defaultValue: "active", options: [
    { value: "active", label: "Active" },
    { value: "inactive", label: "Inactive" },
    { value: "blacklisted", label: "Blacklisted" },
  ]},
];

function SuppliersPage() {
  const queryClient = useQueryClient();
  const { companyId } = useAuth();

  const { data } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("*").order("name")).data ?? [],
  });

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const { error } = await supabase.from("suppliers").insert({
        company_id: companyId!,
        name: formData.name,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        rating: parseFloat(formData.rating) || 0,
        status: formData.status || "active",
      });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Supplier created"); },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase.from("suppliers").update({
        name: data.name,
        contact_email: data.contact_email || null,
        contact_phone: data.contact_phone || null,
        rating: parseFloat(data.rating) || 0,
        status: data.status || "active",
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Supplier updated"); },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("suppliers").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["suppliers"] }); toast.success("Supplier deleted"); },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <ResourceView
      eyebrow="Procurement"
      title="Suppliers"
      sub="Supplier accounts, performance ratings and procurement history."
      moduleName="suppliers"
      rows={data}
      searchKeys={["name", "contact_email", "contact_phone"]}
      formFields={SUPPLIER_FORM_FIELDS}
      onSubmit={async (formData, editingRow) => {
        if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        else await createMutation.mutateAsync(formData);
      }}
      onDelete={(row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi label="Active Suppliers" value={String(data?.filter(s => s.status === "active").length ?? 0)} icon={Truck} tone="primary" />
          <Kpi label="Avg Rating" value={data?.length ? (data.reduce((s, r) => s + Number(r.rating ?? 0), 0) / data.length).toFixed(1) : "—"} icon={Star} tone="success" />
          <Kpi label="Total Suppliers" value={String(data?.length ?? 0)} icon={DollarSign} tone="info" />
          <Kpi label="With Rating" value={String(data?.filter(s => Number(s.rating ?? 0) > 0).length ?? 0)} icon={Clock} tone="warning" />
        </>
      }
      columns={[
        { key: "name", header: "Supplier", render: (r) => <span className="font-medium">{r.name}</span> },
        { key: "contact_email", header: "Contact", hideOnMobile: true },
        { key: "rating", header: "Rating", render: (r) => (
          <div className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400 fill-amber-400" />
            <span className="text-sm tabular-nums">{Number(r.rating ?? 0).toFixed(1)}</span>
          </div>
        )},
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
