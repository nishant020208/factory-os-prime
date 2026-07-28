import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SaveAll, Loader2, User, Settings as SettingsIcon, Shield, Clock, Send, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useI18n, LOCALES, type Locale } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({ meta: [
    { title: "Settings — FactoryOS AI" },
    { name: "description", content: "Profile, preferences and change requests." },
  ]}),
  component: SettingsPage,
});

// Fields that are safe to edit directly (no approval needed)
const DIRECT_FIELDS = ["full_name", "phone", "job_title", "avatar_url"];
// Fields that require approval from Company Admin
const APPROVAL_FIELDS = ["email", "role", "department"];

function SettingsPage() {
  const queryClient = useQueryClient();
  const { profile, user, roles, companyId } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const [tab, setTab] = useState("profile");
  const [profileForm, setProfileForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    job_title: "",
    avatar_url: "",
  });
  const [changeRequestForm, setChangeRequestForm] = useState({
    field: "",
    requested_value: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const isRootOrCompanyAdmin = roles.includes("root_super_admin") || roles.includes("company_admin");
  const canEditDirectly = isRootOrCompanyAdmin;

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name ?? "",
        email: profile.email ?? "",
        phone: "",
        job_title: "",
        avatar_url: profile.avatar_url ?? "",
      });
    }
  }, [profile]);

  // Fetch change requests (Company Admin sees all pending)
  const { data: changeRequests } = useQuery({
    queryKey: ["change-requests", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("profile_change_requests")
        .select("*, profiles!inner(full_name, email)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!companyId && isRootOrCompanyAdmin,
  });

  // Direct profile update (for root/company admin)
  const updateProfileMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("profiles").update({
        full_name: data.full_name,
        phone: data.phone || null,
        job_title: data.job_title || null,
        avatar_url: data.avatar_url || null,
      }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Profile updated");
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Submit change request (for non-admin roles)
  const submitChangeRequestMutation = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: string }) => {
      if (!user || !companyId) throw new Error("Not authenticated");
      const { error } = await supabase.from("profile_change_requests").insert({
        company_id: companyId,
        user_id: user.id,
        field_name: field,
        current_value: profile?.[field as keyof typeof profile] ?? "",
        requested_value: value,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      toast.success("Change request submitted for approval");
      setChangeRequestForm({ field: "", requested_value: "" });
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Approve/reject change request (Company Admin)
  const handleChangeRequest = async (requestId: string, action: "approved" | "rejected") => {
    try {
      const req = changeRequests?.find((r: any) => r.id === requestId);
      if (!req) return;

      if (action === "approved") {
        // Apply the change to the profile
        // @ts-expect-error — Supabase types reject computed keys
        await supabase.from("profiles").update({
          [req.field_name]: req.requested_value,
        }).eq("id", req.user_id);
      }

      // Update the change request status
      await supabase.from("profile_change_requests").update({
        status: action,
        approver_id: user?.id,
        resolved_at: new Date().toISOString(),
      }).eq("id", requestId);

      queryClient.invalidateQueries({ queryKey: ["change-requests"] });
      toast.success(action === "approved" ? "Change approved" : "Change rejected");
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const initials = (profileForm.full_name || "?").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      <ModuleStatusBar moduleName="settings" />
      <PageHeader
        eyebrow="Configuration"
        title="Profile & Settings"
        sub={canEditDirectly ? "Edit your profile directly. Changes take effect immediately." : "Edit your profile. Sensitive fields require Company Admin approval."}
        actions={<ModuleCopilot moduleName="settings" />}
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="profile"><User className="h-4 w-4 mr-1.5" />Profile</TabsTrigger>
          <TabsTrigger value="preferences"><SettingsIcon className="h-4 w-4 mr-1.5" />Preferences</TabsTrigger>
          {isRootOrCompanyAdmin && (
            <TabsTrigger value="change-requests">
              <Shield className="h-4 w-4 mr-1.5" />
              Change Requests
              {(changeRequests?.filter((r: any) => r.status === "pending").length ?? 0) > 0 && (
                <span className="ml-1.5 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-medium text-white flex items-center justify-center">
                  {changeRequests?.filter((r: any) => r.status === "pending").length}
                </span>
              )}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile">
          <Panel title="Personal Information">
            <div className="flex items-center gap-4 mb-6">
              <Avatar className="h-16 w-16">
                <AvatarFallback className="bg-primary/15 text-primary text-lg">{initials}</AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{profileForm.full_name || "Your Name"}</div>
                <div className="text-xs text-muted-foreground">{profileForm.email}</div>
                <div className="text-xs text-muted-foreground mt-0.5 capitalize">{roles[0]?.replace(/_/g, " ")}</div>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Full Name</Label>
                {canEditDirectly ? (
                  <Input
                    value={profileForm.full_name}
                    onChange={(e) => setProfileForm(f => ({ ...f, full_name: e.target.value }))}
                    className="h-10"
                  />
                ) : (
                  <div className="flex gap-2">
                    <Input value={profileForm.full_name} disabled className="h-10 opacity-70" />
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 shrink-0"
                      onClick={() => submitChangeRequestMutation.mutate({ field: "full_name", value: profileForm.full_name })}
                    >
                      <Send className="h-3 w-3 mr-1" />Request
                    </Button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Email</Label>
                <Input value={profileForm.email} disabled className="h-10 opacity-70" />
                <div className="text-[10px] text-muted-foreground">Email changes require Company Admin approval</div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Phone</Label>
                <Input
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="+1 555-0123"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Job Title</Label>
                <Input
                  value={profileForm.job_title}
                  onChange={(e) => setProfileForm(f => ({ ...f, job_title: e.target.value }))}
                  placeholder="e.g. CNC Operator"
                  className="h-10"
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs text-muted-foreground">Avatar URL</Label>
                <Input
                  value={profileForm.avatar_url}
                  onChange={(e) => setProfileForm(f => ({ ...f, avatar_url: e.target.value }))}
                  placeholder="https://example.com/avatar.jpg"
                  className="h-10"
                />
              </div>
            </div>
            {canEditDirectly && (
              <div className="flex justify-end mt-4">
                <Button
                  className="bg-[image:var(--gradient-primary)] shadow-glow"
                  onClick={() => updateProfileMutation.mutate(profileForm as any)}
                  disabled={updateProfileMutation.isPending}
                >
                  {updateProfileMutation.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <SaveAll className="h-4 w-4 mr-1.5" />}
                  Save Profile
                </Button>
              </div>
            )}
          </Panel>

          {/* Change Request Form (for non-admin roles) */}
          {!canEditDirectly && (
            <div className="mt-4">
            <Panel title="Request a Change">
              <div className="text-sm text-muted-foreground mb-4">
                Need to update your role, email, or department? Submit a change request and your Company Admin will review it.
              </div>
              <div className="grid sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Field</Label>
                  <Select
                    value={changeRequestForm.field}
                    onValueChange={(v) => setChangeRequestForm(f => ({ ...f, field: v }))}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {APPROVAL_FIELDS.map(f => (
                        <SelectItem key={f} value={f}>{f.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Requested Value</Label>
                  <Input
                    value={changeRequestForm.requested_value}
                    onChange={(e) => setChangeRequestForm(f => ({ ...f, requested_value: e.target.value }))}
                    placeholder="New value..."
                    className="h-10"
                  />
                </div>
                <div className="space-y-1.5 pt-5">
                  <Button
                    className="w-full"
                    onClick={() => submitChangeRequestMutation.mutate({ field: changeRequestForm.field, value: changeRequestForm.requested_value })}
                    disabled={!changeRequestForm.field || !changeRequestForm.requested_value || submitChangeRequestMutation.isPending}
                  >
                    <Send className="h-4 w-4 mr-1.5" />Submit Request
                  </Button>
                </div>
              </div>
            </Panel>
            </div>
          )}
        </TabsContent>

        {/* Preferences Tab */}
        <TabsContent value="preferences">
          <Panel title="Preferences">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Notifications</Label>
                <Select defaultValue="all">
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All notifications</SelectItem>
                    <SelectItem value="important">Important only</SelectItem>
                    <SelectItem value="none">None</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Theme</Label>
                <Select defaultValue="system">
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">System</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="light">Light</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Time Format</Label>
                <Select defaultValue="12h">
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12h">12-hour</SelectItem>
                    <SelectItem value="24h">24-hour</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Language</Label>
                <Select defaultValue="en">
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                    <SelectItem value="de">German</SelectItem>
                    <SelectItem value="ja">Japanese</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </Panel>
        </TabsContent>

        {/* Change Requests Tab (Company Admin only) */}
        <TabsContent value="change-requests">
          <Panel title="Pending Change Requests">
            {(!changeRequests || changeRequests.length === 0) && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No pending change requests. When employees request profile changes, they'll appear here.
              </div>
            )}
            <div className="divide-y divide-white/5">
              {(changeRequests ?? []).map((req: any) => (
                <div key={req.id} className="py-3 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{req.profiles?.full_name ?? req.user_id?.slice(0, 8)}</span>
                      <span className="text-xs text-muted-foreground">wants to change</span>
                      <span className="font-medium capitalize">{req.field_name.replace(/_/g, " ")}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Current: <span className="line-through">{req.current_value || "—"}</span>
                      <span className="mx-1">→</span>
                      New: <span className="text-primary font-medium">{req.requested_value}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(req.created_at).toLocaleString()}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {req.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-success"
                          onClick={() => handleChangeRequest(req.id, "approved")}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-destructive"
                          onClick={() => handleChangeRequest(req.id, "rejected")}
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />Reject
                        </Button>
                      </>
                    )}
                    {req.status !== "pending" && (
                      <StatusBadge status={req.status} />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
