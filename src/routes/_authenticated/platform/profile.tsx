import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  User,
  Save,
  Crown,
  Shield,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { safeDate } from "@/lib/utils";
import { applyApprovedProfileChange, profileFieldLabel } from "@/lib/profile-change";
import {
  notifyChangeRequestApproved,
  notifyChangeRequestRejected,
} from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/platform/profile")({
  head: () => ({ meta: [{ title: "Profile — FactoryOS AI" }] }),
  component: PlatformProfile,
});

function PlatformProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", job_title: "" });
  const [rejectionInput, setRejectionInput] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!user) return;
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (data) {
        setForm({
          full_name: data.full_name ?? "",
          email: data.email ?? "",
          phone: data.phone ?? "",
          job_title: data.job_title ?? "",
        });
      }
    }
    load();
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      // Root Super Admin edits directly. Every profile write is still recorded
      // in audit_logs by the trg_audit_write DB trigger (old→new diff + actor).
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || null,
          job_title: form.job_title || null,
        })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Root sees every pending request; the ones that matter are Company Admins'
  // escalations, but Root may review any pending request.
  const { data: pendingRequests } = useQuery({
    queryKey: ["root-pending-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profile_change_requests")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(50);
      const rows = data ?? [];
      const ids = [...new Set(rows.map((r: any) => r.user_id))];
      const names: Record<string, string> = {};
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, full_name, email")
          .in("id", ids);
        for (const p of profs ?? []) {
          names[p.id] = p.full_name ?? p.email ?? p.id?.slice(0, 8);
        }
      }
      return rows.map((r: any) => ({ ...r, requester_name: names[r.user_id] }));
    },
    enabled: !!user,
  });

  async function handleReview(requestId: string, action: "approved" | "rejected") {
    try {
      const req = pendingRequests?.find((r: any) => r.id === requestId);
      if (!req) return;

      if (action === "approved") {
        const applyError = await applyApprovedProfileChange(req);
        if (applyError) {
          toast.error(`Could not apply change: ${applyError}`);
          return;
        }
      }

      setBusyId(requestId);
      const { error } = await supabase
        .from("profile_change_requests")
        .update({
          status: action,
          reviewed_by: user?.id,
          reviewed_at: new Date().toISOString(),
          rejection_reason:
            action === "rejected"
              ? (rejectionInput[requestId] ?? "Not approved by Root Super Admin")
              : null,
        })
        .eq("id", requestId);
      if (error) throw error;

      const label = profileFieldLabel(req.field_name);
      if (action === "approved") {
        await notifyChangeRequestApproved(req.company_id, req.user_id, label);
      } else {
        await notifyChangeRequestRejected(
          req.company_id,
          req.user_id,
          label,
          rejectionInput[requestId] ?? "Not approved by Root Super Admin",
        );
      }

      queryClient.invalidateQueries({ queryKey: ["root-pending-requests"] });
      toast.success(action === "approved" ? "Change approved and applied" : "Change rejected");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const initials = (form.full_name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const pendingCount = pendingRequests?.filter((r: any) => r.status === "pending").length ?? 0;

  return (
    <div className="max-w-[900px] mx-auto space-y-4">
      <PageHeader
        eyebrow="Root Super Admin"
        title="Your Profile"
        sub="Edit your profile directly — every change is written to the audit log."
        actions={<ModuleCopilot moduleName="profile" />}
      />

      <Panel title="Personal Information">
        <div className="flex items-center gap-4 mb-6">
          <Avatar className="h-16 w-16 ring-2 ring-amber-400/30">
            <AvatarFallback className="bg-amber-500/15 text-amber-400 text-lg">
              <Crown className="h-6 w-6" />
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium">{form.full_name || "Root Super Admin"}</div>
            <div className="text-xs text-muted-foreground">{form.email}</div>
            <div className="text-xs text-amber-400 mt-0.5">Root Super Admin · Platform Owner</div>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Full Name</Label>
            <Input
              value={form.full_name}
              onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Phone</Label>
            <Input
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              placeholder="+1 555-0123"
              className="h-10"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Job Title</Label>
            <Input
              value={form.job_title}
              onChange={(e) => setForm((f) => ({ ...f, job_title: e.target.value }))}
              placeholder="Platform Owner"
              className="h-10"
            />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <Button
            className="bg-[image:var(--gradient-primary)] shadow-glow"
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-1.5" />
            )}
            Save Profile
          </Button>
        </div>
      </Panel>

      {/* ── Pending Profile Requests (Company Admin escalations) ── */}
      <Panel
        title={`Pending Profile Requests${pendingCount > 0 ? ` (${pendingCount})` : ""}`}
      >
        {pendingCount === 0 && (
          <div className="text-sm text-muted-foreground py-6 text-center">
            No pending requests. When a Company Admin requests a profile change, it appears here.
          </div>
        )}
        <div className="divide-y divide-white/5">
          {(pendingRequests ?? []).map((req: any) => (
            <div key={req.id} className="py-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2 text-sm flex-wrap">
                  <span className="font-medium">{req.requester_name ?? req.user_id?.slice(0, 8)}</span>
                  <span className="text-xs text-muted-foreground">wants to change</span>
                  <span className="font-medium capitalize">{profileFieldLabel(req.field_name)}</span>
                  <span className="text-[10px] rounded-full bg-blue-500/15 text-blue-400 px-2 py-0.5">
                    Company Admin request
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1">
                  Old: <span className="line-through">{req.old_value || "—"}</span>
                  <span className="mx-1">→</span>
                  New: <span className="text-primary font-medium">{req.new_value}</span>
                </div>
                <div className="text-[10px] text-muted-foreground mt-0.5">
                  {safeDate(req.created_at, true)}
                </div>
                <div className="mt-2 flex items-center gap-1.5 max-w-md">
                  <Input
                    placeholder="Rejection reason (for Reject)"
                    value={rejectionInput[req.id] ?? ""}
                    onChange={(e) =>
                      setRejectionInput((s) => ({ ...s, [req.id]: e.target.value }))
                    }
                    className="h-8 text-xs"
                  />
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-success"
                  disabled={busyId === req.id}
                  onClick={() => handleReview(req.id, "approved")}
                >
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-destructive"
                  disabled={busyId === req.id}
                  onClick={() => handleReview(req.id, "rejected")}
                >
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Reject
                </Button>
                {busyId === req.id && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      {/* Resolved history */}
      {pendingRequests && pendingRequests.length > 0 && (
        <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5" />
          Resolved requests move out of this list; the requester is notified of every decision.
        </div>
      )}
    </div>
  );
}
