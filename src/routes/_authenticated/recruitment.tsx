import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  UserPlus,
  Users,
  Clock,
  CheckCircle2,
  Plus,
  Loader2,
  Briefcase,
  BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/recruitment")({
  head: () => ({
    meta: [
      { title: "Recruitment — FactoryOS AI" },
      { name: "description", content: "Job postings, candidate tracking and hiring pipeline." },
    ],
  }),
  component: RecruitmentPage,
});

const CANDIDATE_STATUSES = ["applied", "interview", "offered", "rejected", "hired"];

function RecruitmentPage() {
  const queryClient = useQueryClient();
  const { companyId, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const [showPosition, setShowPosition] = useState(false);
  const [showCandidate, setShowCandidate] = useState(false);
  const [posForm, setPosForm] = useState({ title: "", department: "", location: "", openings: "1" });
  const [candForm, setCandForm] = useState({
    job_posting_id: "",
    name: "",
    email: "",
    phone: "",
    position: "",
    notes: "",
  });

  // REAL job postings + candidates.
  const { data: postings } = useQuery({
    queryKey: ["rec-postings", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("job_postings")
          .select("*")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: candidates } = useQuery({
    queryKey: ["rec-candidates", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("candidates")
          .select("*, job_postings!left(title)")
          .eq("company_id", companyId!)
          .order("created_at", { ascending: false })
      ).data ?? [],
    enabled: !!companyId,
  });

  const { data: departments } = useQuery({
    queryKey: ["rec-departments", companyId],
    queryFn: async () =>
      (await supabase.from("departments").select("id, name").order("name")).data ?? [],
  });

  const openPositions = (postings ?? []).filter((p: any) => p.status === "open").length;
  const interviews = (candidates ?? []).filter((c: any) => c.status === "interview").length;
  const offered = (candidates ?? []).filter((c: any) => c.status === "offered").length;
  const hired = (candidates ?? []).filter((c: any) => c.status === "hired").length;

  const addPositionMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!posForm.title.trim()) throw new Error("Title is required");
      const { error } = await supabase.from("job_postings").insert({
        company_id: companyId,
        title: posForm.title.trim(),
        department: posForm.department.trim() || null,
        location: posForm.location.trim() || null,
        openings: parseInt(posForm.openings) || 1,
        status: "open",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Position posted");
      setShowPosition(false);
      setPosForm({ title: "", department: "", location: "", openings: "1" });
      queryClient.invalidateQueries({ queryKey: ["rec-postings"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addCandidateMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) throw new Error("No company");
      if (!candForm.name.trim()) throw new Error("Candidate name is required");
      const { error } = await supabase.from("candidates").insert({
        company_id: companyId,
        job_posting_id: candForm.job_posting_id || null,
        name: candForm.name.trim(),
        email: candForm.email.trim() || null,
        phone: candForm.phone.trim() || null,
        position: candForm.position.trim() || null,
        notes: candForm.notes.trim() || null,
        status: "applied",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate added");
      setShowCandidate(false);
      setCandForm({ job_posting_id: "", name: "", email: "", phone: "", position: "", notes: "" });
      queryClient.invalidateQueries({ queryKey: ["rec-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const setStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("candidates").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate status updated");
      queryClient.invalidateQueries({ queryKey: ["rec-candidates"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Hired → create the employment record in the real employees table.
  const hireMutation = useMutation({
    mutationFn: async (cand: any) => {
      if (!companyId) throw new Error("No company");
      const { error: statusErr } = await supabase
        .from("candidates")
        .update({ status: "hired" })
        .eq("id", cand.id);
      if (statusErr) throw statusErr;
      const { error } = await supabase.from("employees").insert({
        company_id: companyId,
        employee_code: `EMP-${Date.now().toString().slice(-6)}`,
        full_name: cand.name,
        email: cand.email || null,
        phone: cand.phone || null,
        job_title: cand.position || null,
        department_id: cand.job_postings?.department_id ?? null,
        status: "active",
        hire_date: new Date().toISOString().slice(0, 10),
        salary: 0,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Candidate hired — employee record created");
      queryClient.invalidateQueries({ queryKey: ["rec-candidates"] });
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="HR"
        title="Recruitment"
        sub="Job postings, candidate pipeline and hiring management."
        actions={
          !isAuditor ? (
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowCandidate(true)}>
                <UserPlus className="h-4 w-4 mr-1" />
                Add Candidate
              </Button>
              <Button className="bg-[image:var(--gradient-primary)]" size="sm" onClick={() => setShowPosition(true)}>
                <Plus className="h-4 w-4 mr-1" />
                Post Position
              </Button>
            </div>
          ) : null
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Open Positions" value={String(openPositions)} icon={Briefcase} tone="primary" />
        <Kpi label="In Interview" value={String(interviews)} icon={Clock} tone="warning" />
        <Kpi label="Offers Made" value={String(offered)} icon={BadgeCheck} tone="info" />
        <Kpi label="Hired" value={String(hired)} icon={CheckCircle2} tone="success" />
      </div>

      <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Panel title={`${(postings ?? []).length} Positions`}>
          {(postings ?? []).length === 0 ? (
            <EmptyState title="No positions posted" sub="Post an opening to start recruiting." />
          ) : (
            <div className="divide-y divide-white/5">
              {(postings ?? []).map((p: any) => (
                <div key={p.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <div className="font-medium text-sm">{p.title}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {[p.department, p.location, p.openings > 1 ? `${p.openings} openings` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={`${(candidates ?? []).length} Candidates`}>
          {(candidates ?? []).length === 0 ? (
            <EmptyState title="No candidates yet" sub="Add a candidate to start the pipeline." />
          ) : (
            <div className="divide-y divide-white/5">
              {(candidates ?? []).map((c: any) => (
                <div key={c.id} className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-medium text-sm">{c.name}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {[c.position, c.job_postings?.title].filter(Boolean).join(" · ") || "General"}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isAuditor && (
                        <>
                          <Select
                            value={c.status}
                            onValueChange={(v) => setStatusMutation.mutate({ id: c.id, status: v })}
                          >
                            <SelectTrigger className="h-7 w-[110px] text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {CANDIDATE_STATUSES.map((s) => (
                                <SelectItem key={s} value={s} className="capitalize">
                                  {s}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          {c.status !== "hired" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 text-xs text-success"
                              onClick={() => hireMutation.mutate(c)}
                              disabled={hireMutation.isPending}
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Hire
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {c.status === "hired" && (
                    <div className="text-[10px] text-success mt-1">
                      ✓ Employee record created in Employees
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Post position dialog */}
      <Dialog open={showPosition} onOpenChange={setShowPosition}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Post a Position</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Title *</Label>
              <Input value={posForm.title} onChange={(e) => setPosForm((f) => ({ ...f, title: e.target.value }))} placeholder="CNC Machinist" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Department</Label>
                <Input value={posForm.department} onChange={(e) => setPosForm((f) => ({ ...f, department: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Location</Label>
                <Input value={posForm.location} onChange={(e) => setPosForm((f) => ({ ...f, location: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Openings</Label>
              <Input type="number" value={posForm.openings} onChange={(e) => setPosForm((f) => ({ ...f, openings: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPosition(false)}>
              Cancel
            </Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={() => addPositionMutation.mutate()} disabled={addPositionMutation.isPending}>
              {addPositionMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add candidate dialog */}
      <Dialog open={showCandidate} onOpenChange={setShowCandidate}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Add Candidate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <Input value={candForm.name} onChange={(e) => setCandForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Position Applied</Label>
              <Input value={candForm.position} onChange={(e) => setCandForm((f) => ({ ...f, position: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={candForm.email} onChange={(e) => setCandForm((f) => ({ ...f, email: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input value={candForm.phone} onChange={(e) => setCandForm((f) => ({ ...f, phone: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Applying For</Label>
              <Select value={candForm.job_posting_id} onValueChange={(v) => setCandForm((f) => ({ ...f, job_posting_id: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {(postings ?? []).map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCandidate(false)}>
              Cancel
            </Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={() => addCandidateMutation.mutate()} disabled={addCandidateMutation.isPending}>
              {addCandidateMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Add Candidate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
