import { createFileRoute } from "@tanstack/react-router";
import { ShieldCheck, AlertOctagon, ClipboardCheck, ArrowUpRight } from "lucide-react";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export const Route = createFileRoute("/_authenticated/quality")({
  head: () => ({ meta: [
    { title: "Quality — FactoryOS AI" },
    { name: "description", content: "Incoming, in-process and final quality inspection with NCR and CAPA." },
  ]}),
  component: QualityPage,
});

const trend = Array.from({ length: 12 }, (_, i) => ({ w: `W${i + 1}`, defects: 12 - Math.round(i / 2) + Math.round(Math.random() * 3), yield: 96 + Math.random() * 3 }));
const ncr = [
  { id: "NCR-2026-014", product: "SKU-A1004 Servo Motor",  severity: "critical",  status: "pending",   opened: "2d ago" },
  { id: "NCR-2026-013", product: "SKU-A1001 Ti Bracket",   severity: "high",       status: "in_progress", opened: "3d ago" },
  { id: "NCR-2026-012", product: "SKU-A1002 Al Housing",   severity: "high",       status: "in_progress", opened: "5d ago" },
  { id: "NCR-2026-011", product: "SKU-A1005 Control Board",severity: "medium",     status: "completed", opened: "1w ago" },
];

function QualityPage() {
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="Quality" title="Quality Management" sub="Inspections, non-conformance reports and CAPA workflows." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="First-Pass Yield" value="97.8%" delta="+0.4%" icon={ShieldCheck} tone="success" />
        <Kpi label="Defect Rate" value="0.82%" delta="-0.3%" icon={AlertOctagon} tone="warning" />
        <Kpi label="Open NCRs" value="7" delta="-2" icon={ClipboardCheck} tone="info" />
        <Kpi label="CAPA On Track" value="94%" delta="+1%" icon={ShieldCheck} tone="primary" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Yield & defects · last 12 weeks">
            <div className="h-64">
              <ResponsiveContainer>
                <AreaChart data={trend}>
                  <defs>
                    <linearGradient id="y" x1="0" x2="0" y1="0" y2="1">
                      <stop offset="0%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0.5} />
                      <stop offset="100%" stopColor="oklch(0.72 0.19 145)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="w" stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={10} />
                  <Tooltip contentStyle={{ background: "oklch(0.20 0.025 260)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, fontSize: 12 }} />
                  <Area type="monotone" dataKey="yield" stroke="oklch(0.72 0.19 145)" fill="url(#y)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </div>
        <Panel title="AI Defect Prediction" right={<span className="text-[10px] text-primary">Vision-ready</span>}>
          <div className="space-y-3">
            {[
              { t: "Predicted micro-crack on Ti Bracket batch B-2287", c: 88, tone: "destructive" },
              { t: "Housing dimensional drift approaching upper limit", c: 76, tone: "warning" },
              { t: "Solder joint anomaly on CB-X1 · sample 42", c: 82, tone: "warning" },
            ].map((r, i) => (
              <div key={i} className="rounded-xl bg-card/60 border border-white/5 p-3">
                <div className="flex items-center justify-between text-[10px] text-primary"><span>Copilot</span><span>{r.c}% conf.</span></div>
                <div className="mt-1 text-sm">{r.t}</div>
                <button className="mt-2 text-[11px] text-primary flex items-center gap-1">Review <ArrowUpRight className="h-3 w-3" /></button>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel title="Open Non-Conformance Reports">
          <div className="divide-y divide-white/5">
            {ncr.map(n => (
              <div key={n.id} className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-3 py-3 text-sm">
                <div className="font-mono text-xs">{n.id}</div>
                <div>{n.product}</div>
                <StatusBadge status={n.severity} />
                <StatusBadge status={n.status} />
                <div className="text-xs text-muted-foreground">{n.opened}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
