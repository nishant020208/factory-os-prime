import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, Users, Clock, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/_authenticated/recruitment")({
  head: () => ({ meta: [
    { title: "Recruitment — FactoryOS AI" },
    { name: "description", content: "Job postings, candidate tracking and hiring pipeline." },
  ]}),
  component: RecruitmentPage,
});

const POSITIONS = [
  { id: "REQ-001", title: "CNC Machinist", dept: "Production", applicants: 12, status: "open", posted: "2 weeks ago", urgency: "high" },
  { id: "REQ-002", title: "Quality Inspector", dept: "Quality", applicants: 8, status: "interviewing", posted: "1 month ago", urgency: "medium" },
  { id: "REQ-003", title: "Maintenance Technician", dept: "Maintenance", applicants: 15, status: "open", posted: "1 week ago", urgency: "high" },
  { id: "REQ-004", title: "Warehouse Associate", dept: "Warehouse", applicants: 22, status: "offer", posted: "3 weeks ago", urgency: "low" },
  { id: "REQ-005", title: "Production Supervisor", dept: "Production", applicants: 6, status: "closed", posted: "2 months ago", urgency: "medium" },
];

function RecruitmentPage() {
  const { companyId } = useAuth();
  const { data: profiles } = useQuery({
    queryKey: ["rec-profiles", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase.from("profiles").select("id").eq("company_id", companyId);
      return data ?? [];
    },
    enabled: !!companyId,
  });

  const open = POSITIONS.filter(p => p.status === "open").length;
  const totalApplicants = POSITIONS.reduce((s, p) => s + p.applicants, 0);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="HR" title="Recruitment" sub="Job postings, candidate pipeline and hiring management." />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Open Positions" value={String(open)} icon={UserPlus} tone="primary" />
        <Kpi label="Total Applicants" value={String(totalApplicants)} icon={Users} tone="info" />
        <Kpi label="In Interview" value={String(POSITIONS.filter(p => p.status === "interviewing").length)} icon={Clock} tone="warning" />
        <Kpi label="Offers Made" value={String(POSITIONS.filter(p => p.status === "offer").length)} icon={CheckCircle2} tone="success" />
      </div>
      <div className="mt-4">
        <Panel title="Open Positions">
          <div className="divide-y divide-white/5">
            {POSITIONS.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-3 py-3 px-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs text-muted-foreground">{p.id}</span>
                    <span className="font-medium text-sm">{p.title}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">{p.dept} · {p.applicants} applicants · Posted {p.posted}</div>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
