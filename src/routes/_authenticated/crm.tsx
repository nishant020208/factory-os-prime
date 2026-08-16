import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { HeartPulse, Target, Phone, Mail, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";
import { fmtMoneyK } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated/crm")({
  head: () => ({
    meta: [
      { title: "CRM — FactoryOS AI" },
      { name: "description", content: "Customer relationship management, leads and pipeline." },
    ],
  }),
  component: CRMPage,
});

const LEADS = [
  {
    id: "LD-001",
    name: "Tesla Gigafactory",
    contact: "procurement@tesla.com",
    stage: "proposal",
    value: 245000,
    source: "Referral",
  },
  {
    id: "LD-002",
    name: "Boeing Defense",
    contact: "supply@boeing.com",
    stage: "negotiation",
    value: 180000,
    source: "Trade Show",
  },
  {
    id: "LD-003",
    name: "Medtronic Labs",
    contact: "buying@medtronic.com",
    stage: "qualified",
    value: 95000,
    source: "Website",
  },
  {
    id: "LD-004",
    name: "Samsung SDI",
    contact: "parts@samsung.com",
    stage: "discovery",
    value: 320000,
    source: "Cold Outreach",
  },
  {
    id: "LD-005",
    name: "Siemens Healthineers",
    contact: "mfg@siemens-health.com",
    stage: "proposal",
    value: 175000,
    source: "Referral",
  },
];

function CRMPage() {
  const { companyId } = useAuth();
  const { data: customers } = useQuery({
    queryKey: ["crm-customers", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("customers").select("*").eq("company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const pipelineValue = LEADS.reduce((s, l) => s + l.value, 0);
  const stages = ["discovery", "qualified", "proposal", "negotiation"];

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Commerce"
        title="CRM"
        sub="Customer relationship management, lead pipeline and account tracking."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Customers"
          value={String(customers?.length ?? 0)}
          icon={HeartPulse}
          tone="primary"
        />
        <Kpi label="Active Leads" value={String(LEADS.length)} icon={Target} tone="info" />
        <Kpi
          label="Pipeline Value"
          value={fmtMoneyK(pipelineValue)}
          icon={TrendingUp}
          tone="success"
        />
        <Kpi label="Win Rate" value="34%" icon={Target} tone="warning" />
      </div>
      <div className="mt-4">
        <Panel title="Sales Pipeline">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {stages.map((stage) => {
              const stageLeads = LEADS.filter((l) => l.stage === stage);
              return (
                <div key={stage} className="rounded-xl bg-card/40 border border-white/5 p-3">
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                    {stage} ({stageLeads.length})
                  </div>
                  <div className="space-y-2">
                    {stageLeads.map((l) => (
                      <div
                        key={l.id}
                        className="rounded-lg bg-background/60 border border-white/5 p-2.5"
                      >
                        <div className="font-medium text-xs">{l.name}</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          ${(l.value / 1000).toFixed(0)}k · {l.source}
                        </div>
                        <div className="flex items-center gap-1 mt-1 text-[10px] text-muted-foreground">
                          <Mail className="h-2.5 w-2.5" />
                          {l.contact}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      </div>
    </div>
  );
}
