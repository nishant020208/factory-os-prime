import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Factory, TrendingUp, ClipboardList, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/production")({
  head: () => ({ meta: [
    { title: "Production Orders — FactoryOS AI" },
    { name: "description", content: "Plan, schedule and execute production orders across every plant." },
  ]}),
  component: ProductionPage,
});

function ProductionPage() {
  const { data } = useQuery({
    queryKey: ["production_orders"],
    queryFn: async () => (await supabase.from("production_orders").select("*").order("due_date")).data ?? [],
  });
  const active = data?.filter(p => p.status === "in_progress").length ?? 0;
  const done = data?.filter(p => p.status === "completed").length ?? 0;
  const critical = data?.filter(p => p.priority === "critical").length ?? 0;

  return (
    <ResourceView
      eyebrow="Manufacturing"
      title="Production Orders"
      sub="Work orders released, in progress and completed across your plants."
      rows={data}
      searchKeys={["order_number", "status", "priority"]}
      kpis={
        <>
          <Kpi label="Total Orders" value={String(data?.length ?? 0)} icon={ClipboardList} tone="primary" />
          <Kpi label="In Progress" value={String(active)} delta="+2" icon={Factory} tone="info" />
          <Kpi label="Completed" value={String(done)} delta="+1" icon={TrendingUp} tone="success" />
          <Kpi label="Critical" value={String(critical)} icon={AlertCircle} tone="destructive" />
        </>
      }
      columns={[
        { key: "order_number", header: "Order #", render: (r) => <span className="font-medium">{r.order_number}</span> },
        { key: "quantity", header: "Qty", render: (r) => Number(r.quantity).toLocaleString() },
        { key: "priority", header: "Priority", render: (r) => <StatusBadge status={r.priority} /> },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        { key: "progress", header: "Progress", render: (r) => (
          <div className="flex items-center gap-2 w-40">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${r.progress ?? 0}%` }} />
            </div>
            <span className="tabular-nums text-xs w-10 text-right">{Math.round(Number(r.progress ?? 0))}%</span>
          </div>
        )},
        { key: "due_date", header: "Due", render: (r) => r.due_date ? new Date(r.due_date).toLocaleDateString() : "—" },
      ]}
    />
  );
}
