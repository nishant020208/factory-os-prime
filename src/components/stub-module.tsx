import { PageHeader, Panel } from "@/components/ui-parts";
import { Sparkles, Wrench } from "lucide-react";

export function StubModule({
  eyebrow, title, sub,
}: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        sub={sub ?? "This module is wired into your role sidebar and permissions. Rich CRUD, charts, and AI insights are being built out next."}
      />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Status">
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary border border-primary/20 grid place-items-center">
              <Wrench className="h-4 w-4" />
            </div>
            <div>
              <div className="text-sm font-medium">Scaffolded</div>
              <div className="text-xs text-muted-foreground mt-1">
                Route is protected by RLS and role permissions. Ready for the domain UI.
              </div>
            </div>
          </div>
        </Panel>
        <Panel title="Interconnection">
          <div className="text-xs text-muted-foreground leading-relaxed">
            This module receives realtime events from related modules
            (Inventory ↔ Procurement ↔ Warehouse ↔ Finance ↔ AI) via Postgres
            triggers + Supabase Realtime; any change elsewhere invalidates
            queries here automatically.
          </div>
        </Panel>
        <Panel title="AI Copilot" right={<span className="text-[10px] text-primary">Available</span>}>
          <div className="flex items-start gap-3">
            <div className="h-9 w-9 rounded-xl bg-primary/15 text-primary border border-primary/20 grid place-items-center">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="text-xs text-muted-foreground">
              Ask the Copilot for a natural-language rollup of this module's KPIs, anomalies and recommendations.
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}
