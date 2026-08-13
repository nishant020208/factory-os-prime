import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Landmark, TrendingUp, Receipt, PiggyBank } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView, type FormField } from "@/components/resource-view";
import { Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/finance")({
  head: () => ({
    meta: [
      { title: "Finance — FactoryOS AI" },
      {
        name: "description",
        content: "GL, AP/AR, budgets, cost centers and executive financial analytics.",
      },
    ],
  }),
  component: FinancePage,
});

// We build finance records from purchase_orders + production_orders since there's no invoices table yet
const PURCHASE_FORM_FIELDS: FormField[] = [
  {
    key: "po_number",
    label: "PO Number",
    type: "text",
    placeholder: "PUR-2026-0004",
    required: true,
  },
  {
    key: "total_amount",
    label: "Amount ($)",
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

const cashflow = Array.from({ length: 12 }, (_, i) => ({
  m: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][i],
  inflow: 1200 + i * 60 + Math.round(Math.random() * 200),
  outflow: 950 + i * 45 + Math.round(Math.random() * 180),
}));

type FinanceRow = {
  id: string;
  po_number: string;
  total_amount: number | null;
  status: string;
  expected_date: string | null;
  created_at: string;
  _type: string;
};

function FinancePage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");

  // Query purchase orders as financial records
  const { data: purchaseOrders } = useQuery({
    queryKey: ["fin-pos", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("purchase_orders")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []).map((p: any) => ({ ...p, _type: "purchase" }) as FinanceRow);
    },
  });

  // Also query production orders to show revenue side
  const { data: prodOrders } = useQuery({
    queryKey: ["fin-prod", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("production_orders")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []).map(
        (p: any) =>
          ({
            ...p,
            po_number: p.order_number,
            total_amount: Number(p.quantity ?? 0) * 42,
            _type: "production",
          }) as FinanceRow,
      );
    },
  });

  const allRecords = [...(purchaseOrders ?? []), ...(prodOrders ?? [])];

  const totalRevenue = allRecords
    .filter((r: any) => r.status === "received" || r.status === "completed")
    .reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const arOutstanding = allRecords
    .filter((r: any) => r.status === "pending" || r.status === "approved")
    .reduce((s, r) => s + Number(r.total_amount ?? 0), 0);
  const apOutstanding = allRecords
    .filter((r: any) => r._type === "purchase" && r.status !== "received")
    .reduce((s, r) => s + Number(r.total_amount ?? 0), 0);

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
      queryClient.invalidateQueries({ queryKey: ["fin-pos"] });
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
      queryClient.invalidateQueries({ queryKey: ["fin-pos"] });
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
      queryClient.invalidateQueries({ queryKey: ["fin-pos"] });
      toast.success("Purchase order deleted");
    },
    onError: (err: any) => toast.error(err.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <ResourceView
        eyebrow="Finance"
        title="Financial Command"
        sub="Purchase orders, revenue tracking, cash flow and executive financial analytics."
        moduleName="finance"
        rows={allRecords}
        searchKeys={["po_number", "status"]}
        formFields={isAuditor ? undefined : PURCHASE_FORM_FIELDS}
        onSubmit={isAuditor ? undefined : async (formData, editingRow) => {
          if (editingRow) await updateMutation.mutateAsync({ id: editingRow.id, data: formData });
          else await createMutation.mutateAsync(formData);
        }}
        onDelete={isAuditor ? undefined : (row) => deleteMutation.mutateAsync(row.id)}
        kpis={
          <>
            <Kpi
              label="Revenue (Settled)"
              value={`$${(totalRevenue / 1000).toFixed(0)}k`}
              delta="+11.4%"
              icon={TrendingUp}
              tone="success"
            />
            <Kpi
              label="Outstanding"
              value={`$${(arOutstanding / 1000).toFixed(0)}k`}
              icon={Receipt}
              tone="warning"
            />
            <Kpi
              label="AP Pending"
              value={`$${(apOutstanding / 1000).toFixed(0)}k`}
              icon={Landmark}
              tone="info"
            />
            <Kpi
              label="Cash Position"
              value="$6.7M"
              delta="+3.1%"
              icon={PiggyBank}
              tone="primary"
            />
          </>
        }
        columns={[
          {
            key: "po_number",
            header: "Reference #",
            render: (r) => <span className="font-mono text-xs font-medium">{r.po_number}</span>,
          },
          {
            key: "_type",
            header: "Type",
            render: (r) => (
              <span className="text-xs capitalize">{r._type === "purchase" ? "AP" : "AR"}</span>
            ),
          },
          {
            key: "total_amount",
            header: "Amount",
            render: (r) => (
              <span className="font-mono text-xs">
                ${Number(r.total_amount ?? 0).toLocaleString()}
              </span>
            ),
          },
          { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
          {
            key: "expected_date",
            header: "Date",
            hideOnMobile: true,
            render: (r) => (r.expected_date ? new Date(r.expected_date).toLocaleDateString() : "—"),
          },
        ]}
      />
      <div className="mt-4">
        <Panel title="Cash Flow · Last 12 Months">
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={cashflow}>
                <defs>
                  <linearGradient id="fin-in" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="fin-out" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="oklch(0.62 0.23 25)" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="oklch(0.62 0.23 25)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="m" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                <Tooltip
                  contentStyle={{
                    background: "oklch(0.20 0.025 260)",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="inflow"
                  stroke="oklch(0.72 0.19 145)"
                  fill="url(#fin-in)"
                  strokeWidth={2}
                />
                <Area
                  type="monotone"
                  dataKey="outflow"
                  stroke="oklch(0.62 0.23 25)"
                  fill="url(#fin-out)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
    </div>
  );
}
