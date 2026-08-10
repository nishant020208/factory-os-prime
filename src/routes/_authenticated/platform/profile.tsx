import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, User, Save, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useEffect } from "react";

export const Route = createFileRoute("/_authenticated/platform/profile")({
  head: () => ({ meta: [{ title: "Profile — FactoryOS AI" }] }),
  component: PlatformProfile,
});

function PlatformProfile() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", job_title: "" });

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
      // Root Super Admin edits directly - NO audit log generated (per spec)
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: form.full_name,
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

  const initials = (form.full_name || "?")
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="max-w-[800px] mx-auto space-y-4">
      <PageHeader
        eyebrow="Root Super Admin"
        title="Your Profile"
        sub="Edit your profile directly. Changes are NOT logged to audit (by design)."
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
            <Input value={form.email} disabled className="h-10 opacity-70" />
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
    </div>
  );
}
