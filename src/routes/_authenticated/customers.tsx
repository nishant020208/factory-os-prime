import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { UserRound, DollarSign, ShoppingBag, Repeat, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — FactoryOS AI" },
      { name: "description", content: "Customer accounts, segments and lifetime value." },
    ],
  }),
  component: CustomersPage,
});

/** Builds a human-readable billing address label from structured fields */
function formatBillingAddress(row: any): string {
  const parts: string[] = [];
  if (row.billing_address) parts.push(row.billing_address);
  if (row.billing_city)    parts.push(row.billing_city);
  if (row.billing_state)   parts.push(row.billing_state);
  if (row.billing_postal)  parts.push(row.billing_postal);
  if (row.billing_country) parts.push(row.billing_country);
  return parts.join(", ");
}

const CUSTOMER_FORM_FIELDS: FormField[] = [
  { key: "name", label: "Company Name", type: "text", placeholder: "Acme Corp", required: true },
  { key: "contact_email", label: "Contact Email", type: "email", placeholder: "proc@acme.com" },
  { key: "contact_phone", label: "Phone", type: "text", placeholder: "+1 555-0123" },
  {
    key: "segment",
    label: "Segment",
    type: "select",
    placeholder: "Select segment",
    options: [
      { value: "Aerospace", label: "Aerospace" },
      { value: "Automotive", label: "Automotive" },
      { value: "Medical", label: "Medical" },
      { value: "Industrial", label: "Industrial" },
      { value: "Consumer", label: "Consumer" },
      { value: "Energy", label: "Energy" },
      { value: "Defense", label: "Defense" },
    ],
  },
  {
    key: "status",
    label: "Status",
    type: "select",
    defaultValue: "active",
    options: [
      { value: "active", label: "Active" },
      { value: "inactive", label: "Inactive" },
      { value: "prospect", label: "Prospect" },
    ],
  },
  // ── Billing Address ─────────────────────────────────────────────────────────
  { key: "billing_address", label: "Billing Street Address", type: "text", placeholder: "123 Main Street" },
  { key: "billing_city",    label: "City", type: "text", placeholder: "Mumbai" },
  { key: "billing_state",   label: "State / Province", type: "text", placeholder: "Maharashtra" },
  { key: "billing_postal",  label: "Postal / ZIP Code", type: "text", placeholder: "400001" },
  { key: "billing_country", label: "Country", type: "text", placeholder: "India" },
];

function CustomersPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");

  const { data, isLoading } = useQuery({
    queryKey: ["customers"],
    queryFn: async () =>
      (
        await supabase
          .from("customers")
          .select(
            "id,name,contact_email,contact_phone,segment,status,billing_address,billing_city,billing_state,billing_postal,billing_country"
          )
          .order("name")
      ).data ?? [],
  });

  const createMutation = useMutation({
    mutationFn: async (formData: Record<string, string>) => {
      const { error } = await supabase.from("customers").insert({
        company_id: companyId!,
        name: formData.name,
        contact_email: formData.contact_email || null,
        contact_phone: formData.contact_phone || null,
        segment: formData.segment || null,
        status: formData.status || "active",
        billing_address: formData.billing_address || null,
        billing_city:    formData.billing_city    || null,
        billing_state:   formData.billing_state   || null,
        billing_postal:  formData.billing_postal  || null,
        billing_country: formData.billing_country || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer created");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, string> }) => {
      const { error } = await supabase
        .from("customers")
        .update({
          name: data.name,
          contact_email: data.contact_email || null,
          contact_phone: data.contact_phone || null,
          segment: data.segment || null,
          status: data.status || "active",
          billing_address: data.billing_address || null,
          billing_city:    data.billing_city    || null,
          billing_state:   data.billing_state   || null,
          billing_postal:  data.billing_postal  || null,
          billing_country: data.billing_country || null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("customers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Customer deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <ResourceView
      eyebrow="Commercial"
      title="Customers"
      sub="Every account you serve, from aerospace to consumer goods."
      moduleName="customers"
      rows={data}
      searchKeys={["name", "contact_email", "segment", "contact_phone", "billing_city", "billing_country"]}
      formFields={isAuditor ? undefined : CUSTOMER_FORM_FIELDS}
      onSubmit={isAuditor ? undefined : async (formData, editingRow) => {
        if (editingRow) {
          await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
        } else {
          await createMutation.mutateAsync(formData);
        }
      }}
      onDelete={isAuditor ? undefined : (row) => deleteMutation.mutateAsync(row.id)}
      kpis={
        <>
          <Kpi
            label="Active Accounts"
            value={String(data?.filter((c) => c.status === "active").length ?? 0)}
            icon={UserRound}
            tone="primary"
          />
          <Kpi
            label="Total Customers"
            value={String(data?.length ?? 0)}
            icon={DollarSign}
            tone="success"
          />
          <Kpi
            label="Segments"
            value={String(new Set(data?.map((c) => c.segment).filter(Boolean)).size)}
            icon={ShoppingBag}
            tone="info"
          />
          <Kpi
            label="With Address"
            value={String(data?.filter((c) => c.billing_city).length ?? 0)}
            icon={MapPin}
            tone="warning"
          />
        </>
      }
      columns={[
        {
          key: "name",
          header: "Customer",
          render: (r) => <span className="font-medium">{r.name}</span>,
        },
        {
          key: "segment",
          header: "Segment",
          render: (r) =>
            r.segment ? (
              <Badge
                variant="outline"
                className="text-[10px] font-medium bg-info/10 text-info border-info/20"
              >
                {r.segment}
              </Badge>
            ) : (
              <span className="text-muted-foreground">—</span>
            ),
        },
        { key: "contact_email", header: "Contact", className: "hidden md:table-cell" },
        { key: "contact_phone", header: "Phone", hideOnMobile: true },
        {
          key: "billing_city",
          header: "Billing Location",
          hideOnMobile: true,
          render: (r) => {
            const label = formatBillingAddress(r);
            return label ? (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 shrink-0 text-primary/60" />
                {label}
              </span>
            ) : (
              <span className="text-muted-foreground text-xs">—</span>
            );
          },
        },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
      ]}
    />
  );
}
