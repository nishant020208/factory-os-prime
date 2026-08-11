import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { AlertOctagon, ShieldCheck, Clock, Package } from "lucide-react";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/defects")({
  head: () => ({
    meta: [
      { title: "Defects — FactoryOS AI" },
      { name: "description", content: "Defect tracking, classification and root cause analysis." },
    ],
  }),
  component: DefectsPage,
});

const DEFECTS = [
  {
    id: "DEF-2026-042",
    product: "FRN-DT-001 Dining Table — Teak",
    type: "Uneven Polish/Finish",
    severity: "high",
    status: "open",
    detected: "2 days ago",
    batch: "FRN-B-2287",
  },
  {
    id: "DEF-2026-041",
    product: "FRN-SF-003 3-Seater Fabric Sofa",
    type: "Fabric Stitching Defect",
    severity: "medium",
    status: "in_progress",
    detected: "3 days ago",
    batch: "FRN-B-2285",
  },
  {
    id: "DEF-2026-040",
    product: "FRN-WD-004 4-Door Wardrobe",
    type: "Hardware Misalignment (Hinges)",
    severity: "medium",
    status: "in_progress",
    detected: "5 days ago",
    batch: "FRN-B-2280",
  },
  {
    id: "DEF-2026-039",
    product: "FRN-BD-005 Queen Size Bed Frame",
    type: "Wobbly Joints",
    severity: "critical",
    status: "open",
    detected: "1 day ago",
    batch: "FRN-B-2290",
  },
  {
    id: "DEF-2026-038",
    product: "FRN-OC-002 Executive Office Chair",
    type: "Surface Scratch/Dent",
    severity: "low",
    status: "resolved",
    detected: "1 week ago",
    batch: "FRN-B-2275",
  },
];

function DefectsPage() {
  const open = DEFECTS.filter((d) => d.status === "open").length;
  const critical = DEFECTS.filter((d) => d.severity === "critical").length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Quality"
        title="Defects"
        sub="Defect tracking, classification, severity and root cause analysis."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Open Defects" value={String(open)} icon={AlertOctagon} tone="warning" />
        <Kpi label="Critical" value={String(critical)} icon={AlertOctagon} tone="destructive" />
        <Kpi
          label="In Progress"
          value={String(DEFECTS.filter((d) => d.status === "in_progress").length)}
          icon={Clock}
          tone="info"
        />
        <Kpi
          label="Resolved"
          value={String(DEFECTS.filter((d) => d.status === "resolved").length)}
          icon={ShieldCheck}
          tone="success"
        />
      </div>
      <div className="mt-4">
        <Panel title="Defect Register">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    ID
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Product
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Type
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Severity
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Status
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Batch
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Detected
                  </th>
                </tr>
              </thead>
              <tbody>
                {DEFECTS.map((d) => (
                  <tr key={d.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 font-mono text-xs">{d.id}</td>
                    <td className="py-2.5 px-2 font-medium">{d.product}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">
                      {d.type}
                    </td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={d.severity} />
                    </td>
                    <td className="py-2.5 px-2">
                      <StatusBadge
                        status={
                          d.status === "in_progress"
                            ? "in_progress"
                            : d.status === "resolved"
                              ? "completed"
                              : "pending"
                        }
                      />
                    </td>
                    <td className="py-2.5 px-2 font-mono text-xs hidden md:table-cell">
                      {d.batch}
                    </td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground">{d.detected}</td>
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
