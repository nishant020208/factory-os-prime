import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AlertOctagon, ShieldCheck, Clock, Loader2, FileWarning } from "lucide-react";
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

export const Route = createFileRoute("/_authenticated/defects")({
  head: () => ({
    meta: [
      { title: "Defects — FactoryOS AI" },
      { name: "description", content: "Defect tracking, classification and root cause analysis." },
    ],
  }),
  component: DefectsPage,
});

function DefectsPage() {
  const { companyId } = useAuth();

  const { data: ncrs, isLoading } = useQuery({
    queryKey: ["defects-ncrs", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("ncr")
          .select("*")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const open = ncrs?.filter((n) => n.status !== "closed").length ?? 0;
  const critical = ncrs?.filter((n) => n.severity === "critical" || n.severity === "high").length ?? 0;
  const resolved = ncrs?.filter((n) => n.status === "closed").length ?? 0;

  const breakdown = (ncrs ?? []).reduce<Record<string, number>>((acc, n) => {
    acc[n.defect_category] = (acc[n.defect_category] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="defects" />
      <PageHeader
        eyebrow="Quality"
        title="Defects"
        sub="Defect tracking, classification, severity and root cause analysis — every row comes from a real NCR."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <Kpi label="Open Defects" value={String(open)} icon={AlertOctagon} tone="warning" />
        <Kpi label="High / Critical" value={String(critical)} icon={FileWarning} tone="destructive" />
        <Kpi label="Resolved" value={String(resolved)} icon={ShieldCheck} tone="success" />
        <Kpi label="Total NCRs" value={String(ncrs?.length ?? 0)} icon={Clock} tone="info" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Defect Breakdown by Category">
          {Object.keys(breakdown).length === 0 ? (
            <EmptyState title="No defects yet" sub="NCRs will be categorized here." />
          ) : (
            <div className="space-y-3">
              {Object.entries(breakdown)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, count]) => (
                  <div key={cat} className="rounded-xl bg-card/60 border border-white/5 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">{cat}</span>
                      <span className="font-semibold tabular-nums">{count}</span>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Panel>

        <div className="lg:col-span-2">
          <Panel title={`${ncrs?.length ?? 0} NCR Log`}>
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading…
              </div>
            ) : (ncrs ?? []).length === 0 ? (
              <EmptyState title="No NCRs" sub="Defects recorded from inspections and manual NCRs appear here." />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent border-white/5">
                      {["NCR #", "Batch", "Defect Category", "Severity", "Description", "Status", "Raised"].map((h) => (
                        <TableHead key={h} className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {h}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(ncrs ?? []).map((n) => (
                      <TableRow key={n.id} className="border-white/5">
                        <TableCell className="font-mono text-xs">{n.ncr_number}</TableCell>
                        <TableCell className="font-mono text-xs">{n.batch_number ?? "—"}</TableCell>
                        <TableCell className="text-sm">{n.defect_category}</TableCell>
                        <TableCell>
                          <StatusBadge
                            status={
                              n.severity === "critical"
                                ? "critical"
                                : n.severity === "high"
                                  ? "warning"
                                  : "info"
                            }
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                          {n.description ?? "—"}
                        </TableCell>
                        <TableCell>
                          <StatusBadge
                            status={n.status === "closed" ? "completed" : n.status === "in_rework" ? "in_progress" : "pending"}
                          />
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{safeDate(n.created_at)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </Panel>
        </div>
      </div>
    </div>
  );
}
