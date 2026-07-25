import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Calendar, Users, Clock, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/leaves")({
  head: () => ({ meta: [
    { title: "Leaves — FactoryOS AI" },
    { name: "description", content: "Employee leave requests, approvals and balance tracking." },
  ]}),
  component: LeavesPage,
});

const LEAVE_REQUESTS = [
  { id: "LV-001", employee: "James Miller", type: "Annual", from: "2026-08-01", to: "2026-08-05", days: 5, status: "approved", balance: 15 },
  { id: "LV-002", employee: "Sarah Chen", type: "Sick", from: "2026-07-25", to: "2026-07-25", days: 1, status: "approved", balance: 10 },
  { id: "LV-003", employee: "Mike Johnson", type: "Annual", from: "2026-08-10", to: "2026-08-14", days: 5, status: "pending", balance: 20 },
  { id: "LV-004", employee: "Lisa Wang", type: "Personal", from: "2026-07-28", to: "2026-07-29", days: 2, status: "pending", balance: 8 },
  { id: "LV-005", employee: "David Park", type: "Annual", from: "2026-07-20", to: "2026-07-22", days: 3, status: "completed", balance: 12 },
];

function LeavesPage() {
  const { companyId } = useAuth();
  const { data: profiles } = useQuery({
    queryKey: ["leave-profiles", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("profiles").select("id, full_name").eq("company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const pending = LEAVE_REQUESTS.filter(l => l.status === "pending").length;
  const totalDays = LEAVE_REQUESTS.reduce((s, l) => s + l.days, 0);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="HR" title="Leaves" sub="Leave requests, approvals and balance management." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Employees" value={String(profiles?.length ?? 0)} icon={Users} tone="primary" />
        <Kpi label="Pending Requests" value={String(pending)} icon={Clock} tone="warning" />
        <Kpi label="Total Leave Days" value={String(totalDays)} icon={Calendar} tone="info" />
        <Kpi label="On Leave Today" value="2" icon={AlertTriangle} tone="destructive" />
      </div>
      <div className="mt-4">
        <Panel title="Leave Requests">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Employee</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Type</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">From</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">To</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Days</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Status</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">Balance</th>
                </tr>
              </thead>
              <tbody>
                {LEAVE_REQUESTS.map(l => (
                  <tr key={l.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 font-medium">{l.employee}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">{l.type}</td>
                    <td className="py-2.5 px-2 font-mono text-xs hidden md:table-cell">{l.from}</td>
                    <td className="py-2.5 px-2 font-mono text-xs hidden md:table-cell">{l.to}</td>
                    <td className="py-2.5 px-2 tabular-nums">{l.days}</td>
                    <td className="py-2.5 px-2"><StatusBadge status={l.status} /></td>
                    <td className="py-2.5 px-2 tabular-nums hidden md:table-cell">{l.balance}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
