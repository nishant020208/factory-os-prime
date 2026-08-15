import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Gauge, ListTodo, Cog, Layers3, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/capacity-planning")({
  head: () => ({
    meta: [
      { title: "Capacity Planning — FactoryOS AI" },
      { name: "description", content: "Department load and machine utilization from live work orders." },
    ],
  }),
  component: CapacityPlanningPage,
});

function CapacityPlanningPage() {
  const { companyId } = useAuth();

  const { data: workOrders } = useQuery({
    queryKey: ["cap-wos", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("*, departments!left(name), machines!left(name)")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data ?? []).map((w: any) => ({
        ...w,
        department_name: w.departments?.name ?? "Unassigned",
        machine_name: w.machines?.name ?? "—",
      }));
    },
    enabled: !!companyId,
  });

  const { data: machines } = useQuery({
    queryKey: ["cap-machines", companyId],
    queryFn: async () =>
      (await supabase.from("machines").select("*").eq("company_id", companyId!)).data ?? [],
    enabled: !!companyId,
  });

  const { data: departments } = useQuery({
    queryKey: ["cap-depts", companyId],
    queryFn: async () =>
      (await supabase.from("departments").select("*").eq("company_id", companyId!).order("name"))
        .data ?? [],
    enabled: !!companyId,
  });

  const byDept = (departments ?? []).map((d: any) => {
    const wos = (workOrders ?? []).filter((w: any) => w.department_id === d.id);
    const active = wos.filter((w: any) => w.status === "in_progress" || w.status === "pending");
    const totalLoad = wos.reduce((s: number, w: any) => s + Number(w.quantity ?? 0), 0);
    const avgProgress = active.length
      ? Math.round(
          active.reduce((s: number, w: any) => s + Number(w.progress_percent ?? 0), 0) / active.length,
        )
      : 0;
    return { dept: d, wos, active, totalLoad, avgProgress };
  });

  const operational = (machines ?? []).filter((m: any) => m.status === "operational").length;
  const totalWos = workOrders?.length ?? 0;
  const inProgress = (workOrders ?? []).filter((w: any) => w.status === "in_progress").length;
  const utilization =
    machines?.length && operational
      ? Math.round((operational / machines.length) * 100)
      : 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Production"
        title="Capacity Planning"
        sub="Work order load per department and machine availability — computed live from the real production tables."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Total Work Orders" value={String(totalWos)} icon={ListTodo} tone="primary" />
        <Kpi label="In Progress" value={String(inProgress)} icon={Clock} tone="info" />
        <Kpi label="Machines Operational" value={`${operational}/${machines?.length ?? 0}`} icon={Cog} tone="success" />
        <Kpi label="Fleet Utilization" value={`${utilization}%`} icon={Gauge} tone="warning" />
      </div>

      <Panel title="Department Load">
        {byDept.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                  {["Department", "Active WOs", "Total WOs", "Units Load", "Avg Progress"].map((h) => (
                    <th key={h} className="py-2 px-2 font-medium">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {byDept.map(({ dept, active, wos, totalLoad, avgProgress }) => (
                  <tr key={dept.id} className="border-b border-white/5 last:border-0">
                    <td className="py-2 px-2 font-medium">{dept.name}</td>
                    <td className="py-2 px-2"><StatusBadge status={active.length ? "in_progress" : "idle"} /></td>
                    <td className="py-2 px-2 tabular-nums">{wos.length}</td>
                    <td className="py-2 px-2 tabular-nums">{totalLoad}</td>
                    <td className="py-2 px-2">
                      <div className="flex items-center gap-2 w-28">
                        <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div
                            className="h-full bg-[image:var(--gradient-primary)]"
                            style={{ width: `${avgProgress}%` }}
                          />
                        </div>
                        <span className="tabular-nums text-xs w-8 text-right">{avgProgress}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No departments" sub="Departments appear here once created." />
        )}
      </Panel>

      <Panel title="Machine Capacity" className="mt-4">
        {machines?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(machines ?? []).map((m: any) => (
              <div
                key={m.id}
                className="rounded-xl border border-border/50 bg-card/50 p-3 flex items-center justify-between"
              >
                <div>
                  <div className="font-medium text-sm">{m.name}</div>
                  <div className="text-[11px] text-muted-foreground">{m.type ?? "—"}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Layers3 className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="tabular-nums text-sm font-medium">
                    {Math.round(Number(m.utilization ?? 0))}%
                  </span>
                  <StatusBadge status={m.status ?? "unknown"} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title="No machines" sub="Machines appear here once registered." />
        )}
      </Panel>
    </div>
  );
}
