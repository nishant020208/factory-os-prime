import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Wallet, DollarSign, Users, FileText, CheckCircle2, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — FactoryOS AI" },
      { name: "description", content: "Payroll processing, salary management and payslips." },
    ],
  }),
  component: PayrollPage,
});

function PayrollPage() {
  const { companyId } = useAuth();
  // REAL payroll records — same table Finance/HR use, scoped by RLS.
  const { data: payrollRows } = useQuery({
    queryKey: ["pay-records", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("payroll")
        .select("*, profiles!left(full_name)")
        .eq("company_id", companyId)
        .order("period", { ascending: false })
        .limit(200);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const headcount = new Set((payrollRows ?? []).map((r: any) => r.employee_id)).size;
  const estimatedPayroll = (payrollRows ?? []).reduce(
    (s, r) => s + Number(r.gross_amount ?? 0),
    0,
  );
  const processed = (payrollRows ?? []).filter((r: any) => r.status === "processed").length;
  const totalRecords = payrollRows?.length ?? 0;

  const payrollRecords = (payrollRows ?? []).slice(0, 50).map((r: any) => ({
    id: r.id,
    name: r.profiles?.full_name ?? "Employee",
    period: r.period ?? "",
    base: Number(r.gross_amount ?? 0),
    overtime: 0,
    deductions: Number(r.deductions ?? 0),
    net: Number(r.net_amount ?? 0),
    status: r.status ?? "pending",
  }));

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Finance"
        title="Payroll"
        sub="Payroll processing, salary management and payslip generation."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Headcount" value={String(headcount)} icon={Users} tone="primary" />
        <Kpi
          label="Gross (Total)"
          value={`$${(estimatedPayroll / 1000).toFixed(0)}k`}
          icon={DollarSign}
          tone="success"
        />
        <Kpi
          label="Processed"
          value={`${processed}/${totalRecords}`}
          icon={CheckCircle2}
          tone="info"
        />
        <Kpi label="Pending" value={String(totalRecords - processed)} icon={Clock} tone="warning" />
      </div>
      <div className="mt-4">
        <Panel title="Payroll Records">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Employee
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Period
                  </th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Gross
                  </th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Deductions
                  </th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Deductions
                  </th>
                  <th className="text-right text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Net
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {payrollRecords.map((r) => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 font-medium">{r.name}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">
                      {r.period ?? "—"}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs">
                      ${r.base.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs text-destructive hidden md:table-cell">
                      -${r.deductions.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs font-medium">
                      ${r.net.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={r.status} />
                    </td>
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
