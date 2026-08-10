import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { ClipboardCheck, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";

export const Route = createFileRoute("/_authenticated/final-inspection")({
  head: () => ({
    meta: [
      { title: "Final Inspection — FactoryOS AI" },
      { name: "description", content: "Final product quality inspection before dispatch." },
    ],
  }),
  component: FinalInspectionPage,
});

const INSPECTIONS = [
  {
    id: "FI-2026-088",
    product: "Ti Bracket TB-500",
    batch: "B-2287",
    qty: 250,
    pass: 242,
    fail: 8,
    inspector: "Sarah Chen",
    date: "2026-07-23",
  },
  {
    id: "FI-2026-087",
    product: "Al Housing AH-220",
    batch: "B-2285",
    qty: 500,
    pass: 497,
    fail: 3,
    inspector: "James Miller",
    date: "2026-07-22",
  },
  {
    id: "FI-2026-086",
    product: "Control Board CB-X1",
    batch: "B-2280",
    qty: 100,
    pass: 98,
    fail: 2,
    inspector: "Sarah Chen",
    date: "2026-07-21",
  },
  {
    id: "FI-2026-085",
    product: "Servo Motor SM-3000",
    batch: "B-2278",
    qty: 50,
    pass: 49,
    fail: 1,
    inspector: "Lisa Wang",
    date: "2026-07-20",
  },
];

function FinalInspectionPage() {
  const totalPass = INSPECTIONS.reduce((s, i) => s + i.pass, 0);
  const totalFail = INSPECTIONS.reduce((s, i) => s + i.fail, 0);
  const totalQty = INSPECTIONS.reduce((s, i) => s + i.qty, 0);
  const yieldRate = totalQty > 0 ? ((totalPass / totalQty) * 100).toFixed(1) : "0";

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Quality"
        title="Final Inspection"
        sub="Last-stop quality gate before products ship to customers."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Total Inspected"
          value={totalQty.toLocaleString()}
          icon={ClipboardCheck}
          tone="primary"
        />
        <Kpi label="Passed" value={totalPass.toLocaleString()} icon={CheckCircle2} tone="success" />
        <Kpi label="Failed" value={String(totalFail)} icon={AlertTriangle} tone="destructive" />
        <Kpi label="First-Pass Yield" value={`${yieldRate}%`} icon={Clock} tone="info" />
      </div>
      <div className="mt-4">
        <Panel title="Inspection Results">
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
                    Batch
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Qty
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Pass
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Fail
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">
                    Yield
                  </th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">
                    Inspector
                  </th>
                </tr>
              </thead>
              <tbody>
                {INSPECTIONS.map((i) => {
                  const yieldPct = i.qty > 0 ? ((i.pass / i.qty) * 100).toFixed(1) : "0";
                  return (
                    <tr key={i.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                      <td className="py-2.5 px-2 font-mono text-xs">{i.id}</td>
                      <td className="py-2.5 px-2 font-medium">{i.product}</td>
                      <td className="py-2.5 px-2 font-mono text-xs hidden md:table-cell">
                        {i.batch}
                      </td>
                      <td className="py-2.5 px-2 tabular-nums">{i.qty}</td>
                      <td className="py-2.5 px-2 tabular-nums text-success">{i.pass}</td>
                      <td className="py-2.5 px-2 tabular-nums text-destructive">{i.fail}</td>
                      <td className="py-2.5 px-2">
                        <span
                          className={`tabular-nums ${Number(yieldPct) >= 98 ? "text-success" : Number(yieldPct) >= 95 ? "text-warning" : "text-destructive"}`}
                        >
                          {yieldPct}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">
                        {i.inspector}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
