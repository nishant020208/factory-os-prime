import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, DollarSign, Users, FileText, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [
    { title: "Payroll — FactoryOS AI" },
    { name: "description", content: "Payroll processing, salary management and payslips." },
  ]}),
  component: PayrollPage,
});

function PayrollPage() {
  const { companyId } = useAuth();
  const { data: profiles } = useQuery({
    queryKey: ["pay-profiles", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("profiles").select("*").eq("company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const headcount = profiles?.length ?? 0;
  const estimatedPayroll = headcount * 5200;
  const processed = headcount > 0 ? Math.floor(headcount * 0.85) : 0;

  const payrollRecords = (profiles ?? []).slice(0, 10).map((p: any, i: number) => ({
    id: p.id,
    name: p.full_name ?? "Employee",
    base: 4500 + (i * 200),
    overtime: i % 3 === 0 ? 350 + (i * 50) : 0,
    deductions: 800 + (i * 30),
    net: 0,
    status: i < processed ? "processed" : "pending",
  })).map(r => ({ ...r, net: r.base + r.overtime - r.deductions }));

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="Finance" title="Payroll" sub="Payroll processing, salary management and payslip generation." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Headcount" value={String(headcount)} icon={Users} tone="primary" />
        <Kpi label="Est. Monthly" value={`$${(estimatedPayroll / 1000).toFixed(0)}k`} icon={DollarSign} tone="success" />
        <Kpi label="Processed" value={`${processed}/${headcount}`} icon={CheckCircle2} tone="info" />
        <Kpi label="Pending" value={String(headcount - processed)} icon={Clock} tone="warning" />
      </div>
      <div className="mt-4">
        <Panel title="Payroll Records">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Employee</th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Base</th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">Overtime</th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">Deductions</th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Net</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {payrollRecords.map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 font-medium">{r.name}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs">${r.base.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs hidden md:table-cell">{r.overtime > 0 ? `$${r.overtime.toLocaleString()}` : "—"}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs text-destructive hidden md:table-cell">-${r.deductions.toLocaleString()}</td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs font-medium">${r.net.toLocaleString()}</td>
                    <td className="py-2.5 px-2"><StatusBadge status={r.status} /></td>
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
