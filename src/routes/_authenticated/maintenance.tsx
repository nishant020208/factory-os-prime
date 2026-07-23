import { createFileRoute } from "@tanstack/react-router";
import { Wrench, Calendar, AlertCircle, TrendingUp } from "lucide-react";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/maintenance")({
  head: () => ({ meta: [
    { title: "Maintenance — FactoryOS AI" },
    { name: "description", content: "Preventive, corrective and AI-driven predictive maintenance." },
  ]}),
  component: MaintenancePage,
});

const wo = [
  { id: "WO-2026-0087", machine: "CNC Mill Alpha-1",     type: "Preventive",  due: "In 2 days",   status: "planned",     ai: 94 },
  { id: "WO-2026-0086", machine: "Robotic Assembly R-7", type: "Corrective",  due: "In progress", status: "in_progress", ai: null },
  { id: "WO-2026-0085", machine: "Injection Molder IM-3",type: "Predictive",  due: "In 5 days",   status: "planned",     ai: 82 },
  { id: "WO-2026-0084", machine: "Laser Cutter LC-9",    type: "Preventive",  due: "In 12 days",  status: "planned",     ai: 71 },
];

function MaintenancePage() {
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="Reliability" title="Maintenance" sub="Preventive and AI-driven predictive maintenance across every asset." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="MTBF" value="428 h" delta="+12h" icon={TrendingUp} tone="success" />
        <Kpi label="MTTR" value="1.8 h" delta="-0.4h" icon={Wrench} tone="info" />
        <Kpi label="Scheduled PMs" value="14" icon={Calendar} tone="primary" />
        <Kpi label="Predicted Failures" value="3" delta="+1" icon={AlertCircle} tone="warning" />
      </div>

      <div className="mt-4">
        <Panel title="Work Orders">
          <div className="divide-y divide-white/5">
            {wo.map(w => (
              <div key={w.id} className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-3 py-3 text-sm">
                <div className="font-mono text-xs">{w.id}</div>
                <div>{w.machine} <span className="text-muted-foreground text-xs">· {w.type}</span></div>
                <div className="text-xs text-muted-foreground">{w.due}</div>
                <StatusBadge status={w.status} />
                {w.ai !== null && <span className="text-[10px] text-primary bg-primary/10 border border-primary/20 rounded-full px-2 py-0.5">AI · {w.ai}%</span>}
                {w.ai === null && <span />}
                <span />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
