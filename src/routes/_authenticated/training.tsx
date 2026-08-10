import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { GraduationCap, CheckCircle2, Clock, BookOpen, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge } from "@/components/ui-parts";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/training")({
  head: () => ({
    meta: [
      { title: "Training — FactoryOS AI" },
      {
        name: "description",
        content: "Employee training programs, certifications and compliance tracking.",
      },
    ],
  }),
  component: TrainingPage,
});

const TRAININGS = [
  {
    id: "TR-001",
    title: "Safety Awareness Refresher",
    category: "Safety",
    duration: "2h",
    status: "completed",
    completions: 48,
    total: 50,
    deadline: "2026-06-30",
  },
  {
    id: "TR-002",
    title: "CNC Programming Advanced",
    category: "Technical",
    duration: "8h",
    status: "in_progress",
    completions: 12,
    total: 20,
    deadline: "2026-08-15",
  },
  {
    id: "TR-003",
    title: "ISO 9001 Internal Auditor",
    category: "Quality",
    duration: "16h",
    status: "scheduled",
    completions: 0,
    total: 8,
    deadline: "2026-09-01",
  },
  {
    id: "TR-004",
    title: "Fire Safety & Evacuation",
    category: "Safety",
    duration: "1h",
    status: "completed",
    completions: 50,
    total: 50,
    deadline: "2026-05-15",
  },
  {
    id: "TR-005",
    title: "Lean Manufacturing Fundamentals",
    category: "Operations",
    duration: "4h",
    status: "in_progress",
    completions: 30,
    total: 40,
    deadline: "2026-07-31",
  },
  {
    id: "TR-006",
    title: "Forklift Operation Certification",
    category: "Safety",
    duration: "6h",
    status: "scheduled",
    completions: 0,
    total: 15,
    deadline: "2026-10-01",
  },
];

function TrainingPage() {
  const { companyId } = useAuth();
  const queryClient = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) return;
      const { error } = await supabase.from("knowledge_articles").insert({
        company_id: companyId,
        title,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Training program created");
      setShowNew(false);
      queryClient.invalidateQueries({ queryKey: ["training"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const completed = TRAININGS.filter((t) => t.status === "completed").length;
  const inProgress = TRAININGS.filter((t) => t.status === "in_progress").length;
  const totalCompletions = TRAININGS.reduce((s, t) => s + t.completions, 0);
  const totalEnrolled = TRAININGS.reduce((s, t) => s + t.total, 0);

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Development"
        title="Training"
        sub="Employee training programs, certifications and compliance tracking."
        actions={
          <Button
            className="bg-[image:var(--gradient-primary)] shadow-glow"
            onClick={() => setShowNew(true)}
          >
            <Plus className="h-4 w-4 mr-1.5" />
            New Program
          </Button>
        }
      />
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>New Training Program</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Safety Awareness Refresher"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Safety, Technical, Quality"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!title || createMutation.isPending}
              className="bg-[image:var(--gradient-primary)]"
            >
              Create Program
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Programs" value={String(TRAININGS.length)} icon={BookOpen} tone="primary" />
        <Kpi label="Completed" value={String(completed)} icon={CheckCircle2} tone="success" />
        <Kpi label="In Progress" value={String(inProgress)} icon={Clock} tone="info" />
        <Kpi
          label="Completion Rate"
          value={`${Math.round((totalCompletions / totalEnrolled) * 100)}%`}
          icon={GraduationCap}
          tone="warning"
        />
      </div>
      <div className="mt-4">
        <Panel title="Training Programs">
          <div className="space-y-3">
            {TRAININGS.map((t) => {
              const pct = t.total > 0 ? Math.round((t.completions / t.total) * 100) : 0;
              return (
                <div key={t.id} className="rounded-xl bg-card/60 border border-white/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[10px] text-muted-foreground">{t.id}</span>
                        <span className="font-medium text-sm">{t.title}</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {t.category} · {t.duration} · Due {t.deadline}
                      </div>
                    </div>
                    <StatusBadge status={t.status} />
                  </div>
                  <div className="mt-3 flex items-center gap-3">
                    <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-[image:var(--gradient-primary)] rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] tabular-nums text-muted-foreground">
                      {t.completions}/{t.total} ({pct}%)
                    </span>
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
