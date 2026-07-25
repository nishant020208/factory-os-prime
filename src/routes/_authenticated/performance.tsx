import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { Star, TrendingUp, Target, Award, Plus } from "lucide-react";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({ meta: [
    { title: "Performance — FactoryOS AI" },
    { name: "description", content: "Employee performance reviews, KPIs and goal tracking." },
  ]}),
  component: PerformancePage,
});

const REVIEWS = [
  { name: "James Miller", role: "CNC Operator", score: 92, goals: 5, achieved: 5, trend: "up", period: "Q2 2026" },
  { name: "Sarah Chen", role: "Quality Inspector", score: 88, goals: 4, achieved: 3, trend: "up", period: "Q2 2026" },
  { name: "Mike Johnson", role: "Maintenance Tech", score: 85, goals: 5, achieved: 4, trend: "stable", period: "Q2 2026" },
  { name: "Lisa Wang", role: "Production Lead", score: 94, goals: 6, achieved: 6, trend: "up", period: "Q2 2026" },
  { name: "David Park", role: "Warehouse Supervisor", score: 78, goals: 4, achieved: 2, trend: "down", period: "Q2 2026" },
  { name: "Emma Rodriguez", role: "Finance Analyst", score: 91, goals: 5, achieved: 4, trend: "up", period: "Q2 2026" },
];

function PerformancePage() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [empName, setEmpName] = useState("");
  const [score, setScore] = useState("80");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const { error } = await supabase.from("employees").insert({
        company_id: companyId,
        employee_code: `EMP-${Date.now()}`,
        full_name: empName,
        job_title: "New Hire",
        department: "Unassigned",
        status: "active",
        hire_date: new Date().toISOString().split("T")[0],
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Performance review initiated"); setShowNew(false); queryClient.invalidateQueries({ queryKey: ["perf"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const avgScore = Math.round(REVIEWS.reduce((s, r) => s + r.score, 0) / REVIEWS.length);
  const totalGoals = REVIEWS.reduce((s, r) => s + r.goals, 0);
  const totalAchieved = REVIEWS.reduce((s, r) => s + r.achieved, 0);
  const topPerformers = REVIEWS.filter(r => r.score >= 90).length;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow="People" title="Performance" sub="Employee performance reviews, KPIs and goal tracking."
        actions={<Button className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={() => setShowNew(true)}><Plus className="h-4 w-4 mr-1.5" />New Review</Button>} />
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader><DialogTitle>New Performance Review</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5"><Label>Employee Name</Label><Input value={empName} onChange={e => setEmpName(e.target.value)} placeholder="John Smith" /></div>
            <div className="space-y-1.5"><Label>Target Score</Label><Input type="number" value={score} onChange={e => setScore(e.target.value)} min={0} max={100} /></div>
          </div>
          <DialogFooter><Button onClick={() => createMutation.mutate()} disabled={!empName || createMutation.isPending} className="bg-[image:var(--gradient-primary)]">Create Review</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Avg Score" value={`${avgScore}%`} icon={Star} tone="primary" />
        <Kpi label="Goals Achieved" value={`${totalAchieved}/${totalGoals}`} icon={Target} tone="success" />
        <Kpi label="Top Performers" value={String(topPerformers)} icon={Award} tone="info" />
        <Kpi label="Reviews" value={String(REVIEWS.length)} icon={TrendingUp} tone="warning" />
      </div>
      <div className="mt-4">
        <Panel title="Performance Reviews">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Employee</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2 hidden md:table-cell">Role</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Score</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Goals</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Trend</th>
                  <th className="text-left text-[11px] uppercase tracking-wider text-muted-foreground py-2 px-2">Period</th>
                </tr>
              </thead>
              <tbody>
                {REVIEWS.map((r, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-2 font-medium">{r.name}</td>
                    <td className="py-2.5 px-2 text-muted-foreground hidden md:table-cell">{r.role}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full bg-white/5 overflow-hidden">
                          <div className={`h-full rounded-full ${r.score >= 90 ? "bg-success" : r.score >= 80 ? "bg-info" : "bg-warning"}`} style={{ width: `${r.score}%` }} />
                        </div>
                        <span className="tabular-nums text-xs">{r.score}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 tabular-nums">{r.achieved}/{r.goals}</td>
                    <td className="py-2.5 px-2">
                      <StatusBadge status={r.trend === "up" ? "completed" : r.trend === "down" ? "critical" : "pending"} />
                    </td>
                    <td className="py-2.5 px-2 text-xs text-muted-foreground">{r.period}</td>
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
