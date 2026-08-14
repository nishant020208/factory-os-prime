import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Factory, Loader2, Gauge, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar } from "@/components/module-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/hooks/use-auth";
import { safeDate } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/in-process-inspection")({
  head: () => ({
    meta: [
      { title: "In-Process Inspection — FactoryOS AI" },
      { name: "description", content: "Quality checks during production" },
    ],
  }),
  component: InProcessInspectionPage,
});

function InProcessInspectionPage() {
  const { companyId } = useAuth();

  const { data: wos, isLoading } = useQuery({
    queryKey: ["ipi-wos", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("work_orders")
        .select("id, wo_number, operation, status, progress_percent, quantity, due_date")
        .eq("company_id", companyId!)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const inProgress = wos?.filter((w) => w.status !== "completed" && w.status !== "cancelled").length ?? 0;
  const atGate = wos?.filter((w) => Number(w.progress_percent ?? 0) >= 100 && w.status !== "completed").length ?? 0;
  const completed = wos?.filter((w) => w.status === "completed").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="in-process-inspection" />
      <PageHeader
        eyebrow="Quality"
        title="In-Process Inspection"
        sub="Live view of every work order on the shop floor — progress %, stage and readiness for the final quality gate."
      />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6">
        <Kpi label="Work Orders In Progress" value={String(inProgress)} icon={Factory} tone="primary" />
        <Kpi label="At Final Gate (100%)" value={String(atGate)} icon={Gauge} tone="warning" />
        <Kpi label="Completed" value={String(completed)} icon={CheckCircle2} tone="success" />
      </div>
      <Panel title={`${wos?.length ?? 0} Work Orders`}>
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
          </div>
        ) : (wos ?? []).length === 0 ? (
          <EmptyState title="No work orders" sub="Work orders created by Production Manager appear here." />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-white/5">
                  {["Work Order", "Operation", "Qty", "Progress", "Due", "Status"].map((h) => (
                    <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                      {h}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {(wos ?? []).map((wo) => (
                  <TableRow key={wo.id} className="border-white/5">
                    <TableCell className="font-mono text-xs font-medium">{wo.wo_number}</TableCell>
                    <TableCell className="text-sm">{wo.operation}</TableCell>
                    <TableCell className="tabular-nums">{Number(wo.quantity ?? 1).toLocaleString()}</TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full ${Number(wo.progress_percent ?? 0) >= 100 ? "bg-success" : "bg-primary"}`}
                            style={{ width: `${Math.min(Number(wo.progress_percent ?? 0), 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums">{wo.progress_percent ?? 0}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {wo.due_date ? new Date(wo.due_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>
                      <StatusBadge
                        status={
                          Number(wo.progress_percent ?? 0) >= 100
                            ? "ready"
                            : wo.status === "completed"
                              ? "completed"
                              : "in_progress"
                        }
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <div className="mt-3 text-[11px] text-muted-foreground">
          Updated live from the work_orders table — batches at 100% flow into the Final Inspection queue automatically.
        </div>
      </Panel>
    </div>
  );
}
