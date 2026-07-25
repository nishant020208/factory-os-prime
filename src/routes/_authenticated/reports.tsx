import { createFileRoute } from "@tanstack/react-router";
import { ClipboardList, Download } from "lucide-react";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [
    { title: "Reports — FactoryOS AI" },
    { name: "description", content: "Downloadable PDF/Excel/CSV reports across every module." },
  ]}),
  component: ReportsPage,
});

const reports = [
  { g: "Manufacturing", items: ["Production Output", "Work Order History", "Scrap & Rework", "OEE Breakdown"] },
  { g: "Inventory",     items: ["Stock Aging", "Reorder Report", "ABC Analysis", "Cycle Count Variance"] },
  { g: "Quality",       items: ["NCR Summary", "First-Pass Yield", "Supplier Quality", "CAPA Status"] },
  { g: "Finance",       items: ["Profit & Loss", "Balance Sheet", "AP Aging", "AR Aging"] },
  { g: "HR",            items: ["Headcount", "Attendance", "Payroll Summary", "Training Compliance"] },
];

function ReportsPage() {
  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="reports" />
      <PageHeader eyebrow="Reporting" title="Reports Library" sub="Every operational and financial report in PDF, Excel and CSV."
        actions={<ModuleCopilot moduleName="reports" />} />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.map(g => (
          <Panel key={g.g} title={g.g}>
            <div className="divide-y divide-white/5">
              {g.items.map(r => (
                <div key={r} className="flex items-center justify-between py-2.5 text-sm">
                  <div className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-muted-foreground" />{r}</div>
                  <Button variant="ghost" size="sm" className="h-7"><Download className="h-3.5 w-3.5" /></Button>
                </div>
              ))}
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}
