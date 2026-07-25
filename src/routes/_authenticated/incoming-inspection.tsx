import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardCheck, Package, AlertTriangle, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/incoming-inspection")({
  head: () => ({ meta: [
    { title: "Incoming Inspection — FactoryOS AI" },
    { name: "description", content: "Inbound material quality inspection and acceptance." },
  ]}),
  component: IncomingInspectionPage,
});

function IncomingInspectionPage() {
  const { data: suppliers } = useQuery({
    queryKey: ["ii-suppliers"],
    queryFn: async () => (await supabase.from("suppliers").select("id, name, rating")).data ?? [],
  });
  const { data: pos } = useQuery({
    queryKey: ["ii-pos"],
    queryFn: async () => (await supabase.from("purchase_orders").select("*")).data ?? [],
  });

  const receivedPOs = pos?.filter((p: any) => p.status === "received").length ?? 0;
  const pendingPOs = pos?.filter((p: any) => p.status === "approved").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="Quality" title="Incoming Inspection" sub="Inbound material quality inspection, acceptance and rejection tracking." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Pending Inspection" value={String(pendingPOs)} icon={Package} tone="warning" />
        <Kpi label="Accepted" value={String(receivedPOs)} icon={ShieldCheck} tone="success" />
        <Kpi label="Rejected" value="1" icon={AlertTriangle} tone="destructive" />
        <Kpi label="Inspection Rate" value="97.2%" icon={ClipboardCheck} tone="info" />
      </div>
      <div className="mt-4">
        <Panel title="Recent Inspections">
          <div className="divide-y divide-white/5 text-sm">
            {(suppliers ?? []).slice(0, 5).map((s: any, i: number) => (
              <div key={s.id} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] items-center gap-2 py-3 px-2">
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="text-[11px] text-muted-foreground">PO received · {["2 days ago", "5 days ago", "1 week ago", "2 weeks ago", "3 weeks ago"][i]}</div>
                </div>
                <StatusBadge status={i === 3 ? "pending" : "completed"} />
                <div className="text-xs text-muted-foreground tabular-nums">
                  Quality: {s.rating ? `${Number(s.rating).toFixed(1)}/5.0` : "—"}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
