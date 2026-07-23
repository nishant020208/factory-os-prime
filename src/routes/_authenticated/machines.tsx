import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Cog, GaugeCircle, Wrench, Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ResourceView } from "@/components/resource-view";
import { Kpi, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/machines")({
  head: () => ({ meta: [
    { title: "Machines — FactoryOS AI" },
    { name: "description", content: "Machine registry, utilization, uptime and predictive maintenance." },
  ]}),
  component: MachinesPage,
});

function MachinesPage() {
  const { data } = useQuery({
    queryKey: ["machines"],
    queryFn: async () => (await supabase.from("machines").select("*").order("code")).data ?? [],
  });
  const avg = data?.length ? Math.round((data.reduce((s, m) => s + Number(m.utilization ?? 0), 0) / data.length) * 10) / 10 : 0;
  const down = data?.filter(m => m.status !== "operational").length ?? 0;

  return (
    <ResourceView
      eyebrow="Assets"
      title="Machines & Equipment"
      sub="Every asset on the shop floor with real-time utilization and health."
      rows={data}
      searchKeys={["name", "code", "type"]}
      kpis={
        <>
          <Kpi label="Total Machines" value={String(data?.length ?? 0)} icon={Cog} tone="primary" />
          <Kpi label="Avg Utilization" value={`${avg}%`} delta="+2.1%" icon={GaugeCircle} tone="info" />
          <Kpi label="Under Maintenance" value={String(down)} icon={Wrench} tone="warning" />
          <Kpi label="Uptime (7d)" value="94.1%" delta="+0.8%" icon={Activity} tone="success" />
        </>
      }
      columns={[
        { key: "code", header: "Code", render: (r) => <span className="font-mono text-xs">{r.code}</span> },
        { key: "name", header: "Machine" },
        { key: "type", header: "Type", render: (r) => <span className="text-muted-foreground">{r.type ?? "—"}</span> },
        { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
        { key: "utilization", header: "Utilization", render: (r) => (
          <div className="flex items-center gap-2 w-40">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
              <div className="h-full bg-[image:var(--gradient-primary)]" style={{ width: `${r.utilization ?? 0}%` }} />
            </div>
            <span className="tabular-nums text-xs w-10 text-right">{Number(r.utilization ?? 0).toFixed(0)}%</span>
          </div>
        )},
      ]}
    />
  );
}
