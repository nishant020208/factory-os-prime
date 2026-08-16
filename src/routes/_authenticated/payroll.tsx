import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Wallet, DollarSign, Users, CheckCircle2, Clock, Calculator, Loader2, BadgeDollarSign } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoneyK } from "@/lib/currency";
import { notifyPayrollPaid } from "@/lib/notifications";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "Payroll — FactoryOS AI" },
      { name: "description", content: "Payroll processing, salary management and payslips." },
    ],
  }),
  component: PayrollPage,
});

const MONTHS_AGO = (n: number) => {
  const d = new Date();
  d.setDate(1);
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 7);
};

function PayrollPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [period, setPeriod] = useState(MONTHS_AGO(1));

  const { data: payrollRows } = useQuery({
    queryKey: ["pay-records", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("payroll")
          .select("*, profiles!left(full_name, email)")
          .eq("company_id", companyId!)
          .order("period", { ascending: false })
          .limit(300)
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: employees } = useQuery({
    queryKey: ["pay-employees", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("employees")
          .select("*")
          .eq("company_id", companyId!)
          .eq("status", "active")
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: profiles } = useQuery({
    queryKey: ["pay-profiles", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("profiles")
          .select("id, email, full_name")
          .eq("company_id", companyId!)
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: attendance } = useQuery({
    queryKey: ["pay-attendance", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("attendance")
          .select("employee_id, date, status")
          .eq("company_id", companyId!)
      ).data ?? [],
    enabled: !!companyId,
  });

  const profileByEmail = new Map(
    (profiles ?? []).map((p: any) => [(p.email ?? "").toLowerCase(), p.id]),
  );

  const headcount = new Set((payrollRows ?? []).map((r: any) => r.employee_id)).size;
  const grossTotal = (payrollRows ?? []).reduce((s, r: any) => s + Number(r.gross_amount ?? 0), 0);
  const processed = (payrollRows ?? []).filter((r: any) => r.status === "paid").length;
  const totalRecords = payrollRows?.length ?? 0;

  // Real calculation: monthly gross from the salary structure, deductions =
  // income tax (18%) + unpaid absent days × daily rate. Approved leave is paid.
  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !user) throw new Error("Not authenticated");
      const [y, m] = period.split("-").map(Number);
      const daysInMonth = new Date(y, m, 0).getDate();
      const monthKey = (d: string) => d.slice(0, 7);
      const absences = new Map<string, number>();
      for (const a of attendance ?? []) {
        if (monthKey(a.date) === period && a.status === "absent") {
          absences.set(a.employee_id, (absences.get(a.employee_id) ?? 0) + 1);
        }
      }
      const existing = new Set(
        (payrollRows ?? []).filter((r: any) => r.period === period).map((r: any) => r.employee_id),
      );
      const inserts: any[] = [];
      for (const e of employees ?? []) {
        const pid = profileByEmail.get((e.email ?? "").toLowerCase());
        if (!pid) continue; // payroll rows are linked to a system profile
        const monthly = (Number(e.salary ?? 0) / 12).toFixed(2);
        const daily = Number(monthly) / 22;
        const absentDays = Math.min(absences.get(pid) ?? 0, daysInMonth);
        const tax = Number(monthly) * 0.18;
        const absentDeduction = absentDays * daily;
        const net = Math.max(0, Number(monthly) - tax - absentDeduction);
        if (!existing.has(pid)) {
          inserts.push({
            company_id: companyId,
            employee_id: pid,
            period,
            gross_amount: Number(monthly),
            deductions: Math.round((tax + absentDeduction) * 100) / 100,
            net_amount: Math.round(net * 100) / 100,
            status: "pending",
          });
        }
      }
      if (inserts.length === 0) {
        // Nothing new to insert — allow marking existing pending rows paid.
        return { inserted: 0 };
      }
      const { error } = await supabase.from("payroll").insert(inserts);
      if (error) throw error;
      return { inserted: inserts.length };
    },
    onSuccess: (res: any) => {
      toast.success(
        res?.inserted
          ? `Payroll run for ${period} generated (${res.inserted} employees)`
          : `Payroll run for ${period} already exists`,
      );
      queryClient.invalidateQueries({ queryKey: ["pay-records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markPaidMutation = useMutation({
    mutationFn: async (row: any) => {
      const { data, error } = await supabase
        .from("payroll")
        .update({ status: "paid", paid_at: new Date().toISOString() })
        .eq("id", row.id)
        .select();
      if (error) throw error;
      // Notify that specific employee only (to_user = their profiles.id).
      await notifyPayrollPaid(companyId!, row.employee_id, row.period, Number(row.net_amount ?? 0));
      return data;
    },
    onSuccess: () => {
      toast.success("Payroll marked paid — employee notified");
      queryClient.invalidateQueries({ queryKey: ["pay-records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markAllPaidMutation = useMutation({
    mutationFn: async () => {
      const pend = (payrollRows ?? []).filter((r: any) => r.period === period && r.status !== "paid");
      for (const row of pend) {
        await supabase
          .from("payroll")
          .update({ status: "paid", paid_at: new Date().toISOString() })
          .eq("id", row.id);
        await notifyPayrollPaid(companyId!, row.employee_id, row.period, Number(row.net_amount ?? 0));
      }
      return pend.length;
    },
    onSuccess: (n: number) => {
      toast.success(n ? `${n} payslips marked paid` : "Nothing pending for this period");
      queryClient.invalidateQueries({ queryKey: ["pay-records"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const payrollRecords = (payrollRows ?? [])
    .slice(0, 100)
    .map((r: any) => ({
      id: r.id,
      name: r.profiles?.full_name ?? "Employee",
      period: r.period ?? "",
      base: Number(r.gross_amount ?? 0),
      deductions: Number(r.deductions ?? 0),
      net: Number(r.net_amount ?? 0),
      status: r.status ?? "pending",
      employee_id: r.employee_id,
      paid_at: r.paid_at,
    }));

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="People"
        title="Payroll"
        sub="Payroll runs computed from real salary structure, attendance and leave."
        actions={
          !isAuditor ? (
            <div className="flex items-center gap-2">
              <input
                type="month"
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              />
              <Button
                className="bg-[image:var(--gradient-primary)]"
                onClick={() => generateMutation.mutate()}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Calculator className="h-4 w-4 mr-1" />
                )}
                Generate Payroll Run
              </Button>
            </div>
          ) : null
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Headcount" value={String(headcount)} icon={Users} tone="primary" />
        <Kpi label="Gross (Total)" value={fmtMoneyK(grossTotal)} icon={DollarSign} tone="success" />
        <Kpi label="Paid" value={`${processed}/${totalRecords}`} icon={CheckCircle2} tone="info" />
        <Kpi label="Pending" value={String(totalRecords - processed)} icon={Clock} tone="warning" />
      </div>

      <div className="mt-4">
        <Panel
          title="Payroll Records"
          right={
            !isAuditor && (payrollRows ?? []).some((r: any) => r.period === period && r.status !== "paid") ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs text-success"
                onClick={() => markAllPaidMutation.mutate()}
                disabled={markAllPaidMutation.isPending}
              >
                <BadgeDollarSign className="h-3 w-3 mr-1" />
                Mark all {period} paid
              </Button>
            ) : null
          }
        >
          {payrollRecords.length === 0 ? (
            <EmptyState
              title="No payroll records yet"
              sub="Pick a period and run Generate Payroll Run."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/5">
                    {["Employee", "Period", "Gross", "Deductions", "Net", "Status", ""].map((h) => (
                      <th key={h} className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {payrollRecords.map((r) => (
                    <tr key={r.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2 font-medium">{r.name}</td>
                      <td className="py-2.5 px-2 text-xs text-muted-foreground">{r.period}</td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs">
                        ${r.base.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs text-destructive">
                        -${r.deductions.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2 text-right tabular-nums font-mono text-xs font-medium">
                        ${r.net.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-2">
                        <StatusBadge status={r.status === "paid" ? "paid" : "pending"} />
                      </td>
                      <td className="py-2.5 px-2">
                        {!isAuditor && r.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-success"
                            onClick={() => markPaidMutation.mutate(r)}
                            disabled={markPaidMutation.isPending}
                          >
                            <Wallet className="h-3 w-3 mr-1" />
                            Mark Paid
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
