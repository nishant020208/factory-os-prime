import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ScrollText, Wrench, TrendingUp, Clock, AlertOctagon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/machine-history")({
  head: () => ({
    meta: [
      { title: "Machine History — FactoryOS AI" },
      { name: "description", content: "Full lifecycle of every asset from status logs and breakdowns." },
    ],
  }),
  component: MachineHistoryPage,
});

function MachineHistoryPage() {
  const { companyId } = useAuth();

  const { data: machines } = useQuery({
    queryKey: ["mh-machines"],
    queryFn: async () =>
      (await supabase.from("machines").select("*").order("name")).data ?? [],
  });

  const { data: statusLog } = useQuery({
    queryKey: ["mh-status-log", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("machine_status_log")
          .select("*, machines!left(name)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
          .limit(200)
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: breakdowns } = useQuery({
    queryKey: ["mh-breakdowns", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("machine_breakdowns")
          .select("*, machines!left(name)")
          .eq("company_id", companyId!)
          .order("downtime_start", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const totalBreakdowns = (breakdowns ?? []).length;
  const totalDowntimeH = (breakdowns ?? [])
    .filter((b: any) => b.downtime_start && b.downtime_end)
    .reduce(
      (s: number, b: any) =>
        s + (new Date(b.downtime_end).getTime() - new Date(b.downtime_start).getTime()) / 3600000,
      0,
    );
  const machinesWithIssues = new Set((breakdowns ?? []).map((b: any) => b.machine_id)).size;

  const byMachine = (machines ?? []).map((m: any) => {
    const bd = (breakdowns ?? []).filter((b: any) => b.machine_id === m.id);
    const downtime = bd
      .filter((b: any) => b.downtime_start && b.downtime_end)
      .reduce(
        (s: number, b: any) =>
          s + (new Date(b.downtime_end).getTime() - new Date(b.downtime_start).getTime()) / 3600000,
        0,
      );
    const lastBreakdown = bd[0]?.downtime_start ?? null;
    return {
      ...m,
      breakdownCount: bd.length,
      downtimeHours: downtime,
      lastBreakdown,
    };
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Maintenance"
        title="Machine History"
        sub="Status changes and breakdown history per machine — uptime signals from real logs."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Machines" value={String(machines?.length ?? 0)} icon={ScrollText} tone="primary" />
        <Kpi label="Breakdowns Logged" value={String(totalBreakdowns)} icon={AlertOctagon} tone="warning" />
        <Kpi label="Total Downtime" value={`${totalDowntimeH.toFixed(1)}h`} icon={Clock} tone="info" />
        <Kpi label="Machines w/ Issues" value={String(machinesWithIssues)} icon={Wrench} tone="destructive" />
      </div>

      <div className="mt-4">
        <Panel title="Machine Health Summary">
          {(byMachine ?? []).length === 0 ? (
            <EmptyState title="No machines yet" sub="Machine health appears once machines are added." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Machine", "Status", "Breakdowns", "Downtime", "Last Breakdown", "Uptime Signal"].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {byMachine.map((m: any) => {
                    const up = m.breakdownCount === 0 ? 100 : Math.max(0, 100 - m.downtimeHours / 24);
                    return (
                      <tr key={m.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                        <td className="py-2.5 px-2 font-medium">{m.name}</td>
                        <td className="py-2.5 px-2">
                          <StatusBadge status={m.status} />
                        </td>
                        <td className="py-2.5 px-2 tabular-nums">{m.breakdownCount}</td>
                        <td className="py-2.5 px-2 tabular-nums">{m.downtimeHours.toFixed(1)}h</td>
                        <td className="py-2.5 px-2 text-xs text-muted-foreground">
                          {m.lastBreakdown ? safeDate(m.lastBreakdown) : "—"}
                        </td>
                        <td className="py-2.5 px-2">
                          <div className="flex items-center gap-2 w-36">
                            <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${up >= 90 ? "bg-success" : up >= 70 ? "bg-warning" : "bg-destructive"}`}
                                style={{ width: `${up}%` }}
                              />
                            </div>
                            <span className="tabular-nums text-xs w-10 text-right">{Math.round(up)}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Status Change Log">
          {(statusLog ?? []).length === 0 ? (
            <EmptyState title="No status changes logged" sub="Machine status changes (maintenance, breakdowns, service) appear here." />
          ) : (
            <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
              {(statusLog ?? []).map((s: any) => (
                <div key={s.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <StatusBadge status={s.to_status} />
                  <span className="font-medium">{s.machines?.name ?? "Machine"}</span>
                  <span className="text-xs text-muted-foreground">
                    {s.from_status} → {s.to_status}
                  </span>
                  <span className="text-[11px] text-muted-foreground flex-1 truncate">{s.reason ?? "—"}</span>
                  <span className="text-[11px] text-muted-foreground shrink-0">
                    {safeDate(s.created_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
