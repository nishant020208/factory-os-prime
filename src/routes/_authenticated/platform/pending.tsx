import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { safeDate } from "@/lib/utils";
import { Building2, CheckCircle2, XCircle, Loader2, Timer, Mail, Globe, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, Kpi, StatusBadge } from "@/components/ui-parts";
import { ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { notifyCompanyRegistrationApproved } from "@/lib/notifications";

export const Route = createFileRoute("/_authenticated/platform/pending")({
  head: () => ({ meta: [{ title: "Pending Requests — FactoryOS AI" }] }),
  component: PendingPage,
});

function PendingPage() {
  const queryClient = useQueryClient();

  // Fetch company registrations
  const { data: registrations } = useQuery({
    queryKey: ["pending-registrations"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_registrations")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Fetch whitelist company admins
  const { data: whitelist } = useQuery({
    queryKey: ["pending-whitelist"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whitelist")
        .select("*, companies!inner(name)")
        .eq("role", "company_admin")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  // Approve registration mutation
  const approveRegistration = useMutation({
    mutationFn: async (registration: any) => {
      // Create company
      const { data: newCompany, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: registration.company_name,
          legal_name: registration.legal_name || registration.company_name,
          country: registration.country || "US",
          industry: registration.industry || null,
          status: "active",
        })
        .select()
        .single();
      if (companyError) throw companyError;

      // Update registration status
      const { error: regError } = await supabase
        .from("company_registrations")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", registration.id);
      if (regError) throw regError;

      // Whitelist the registrant's email as company_admin
      const { error: whitelistError } = await supabase.from("whitelist").insert({
        email: registration.email,
        role: "company_admin",
        company_id: newCompany.id,
        status: "pending",
      });
      if (whitelistError) throw whitelistError;

      // Notify the new Company Admin (role-wide, scoped to the new company_id)
      // fireNotification is crash-proof (never throws), so a notification
      // failure can never fail the approval itself.
      await notifyCompanyRegistrationApproved(newCompany.id, newCompany.name);

      return newCompany;
    },
    onSuccess: (newCompany) => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      queryClient.invalidateQueries({ queryKey: ["pending-whitelist"] });
      queryClient.invalidateQueries({ queryKey: ["p-companies"] });
      toast.success(`Company "${newCompany.name}" approved and activated`);
    },
    onError: (err: any) => toast.error(err.message),
  });

  // Reject registration mutation
  const rejectRegistration = useMutation({
    mutationFn: async (registration: any) => {
      const { error } = await supabase
        .from("company_registrations")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", registration.id);
      if (error) throw error;
      // Note: the registrant has no auth account yet (they sign up after being
      // whitelisted on approval), so there is no in-app recipient on rejection.
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-registrations"] });
      toast.success("Registration rejected");
    },
    onError: (err: any) => toast.error(err.message),
  });

  const pendingCount = registrations?.length ?? 0;
  const whitelistPending = whitelist?.length ?? 0;

  return (
    <div className="max-w-[1200px] mx-auto space-y-4">
      <PageHeader
        eyebrow="Platform"
        title="Pending Requests"
        sub="Review and approve company registrations and admin whitelist requests."
        actions={<ModuleCopilot moduleName="pending" />}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Company Registrations"
          value={String(pendingCount)}
          icon={Building2}
          tone="primary"
        />
        <Kpi
          label="Whitelist Pending"
          value={String(whitelistPending)}
          icon={Timer}
          tone="warning"
        />
        <Kpi
          label="Total Pending"
          value={String(pendingCount + whitelistPending)}
          icon={Clock}
          tone="info"
        />
      </div>

      <Tabs defaultValue="registrations">
        <TabsList className="mb-4">
          <TabsTrigger value="registrations">
            <Building2 className="h-4 w-4 mr-1.5" />
            New Company Requests
            {pendingCount > 0 && (
              <span className="ml-1.5 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-medium text-white flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="whitelist">
            <Mail className="h-4 w-4 mr-1.5" />
            Admin Invites
            {whitelistPending > 0 && (
              <span className="ml-1.5 h-4 w-4 rounded-full bg-amber-500 text-[10px] font-medium text-white flex items-center justify-center">
                {whitelistPending}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="registrations">
          <Panel
            title={`${pendingCount} Pending Company Registration${pendingCount !== 1 ? "s" : ""}`}
          >
            {pendingCount === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No pending company registrations. When companies register, they'll appear here for
                approval.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {(registrations ?? []).map((reg: any) => (
                  <div key={reg.id} className="py-4 flex items-start justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-lg bg-primary/10 grid place-items-center">
                          <Building2 className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <div className="font-medium">{reg.company_name}</div>
                          <div className="text-xs text-muted-foreground">
                            {reg.email} · {reg.country ?? "—"}
                          </div>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-2">
                        {reg.legal_name && <span>Legal: {reg.legal_name}</span>}
                        {reg.industry && <span>Industry: {reg.industry}</span>}
                        {reg.phone && <span>Phone: {reg.phone}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        Registered {safeDate(reg.created_at, true)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-4">
                      <Button
                        size="sm"
                        className="h-8 text-success"
                        variant="ghost"
                        onClick={() => approveRegistration.mutate(reg)}
                        disabled={approveRegistration.isPending}
                      >
                        {approveRegistration.isPending ? (
                          <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                        )}
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-destructive"
                        variant="ghost"
                        onClick={() => rejectRegistration.mutate(reg)}
                        disabled={rejectRegistration.isPending}
                      >
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Reject
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>

        <TabsContent value="whitelist">
          <Panel
            title={`${whitelistPending} Pending Admin Invite${whitelistPending !== 1 ? "s" : ""}`}
          >
            {whitelistPending === 0 ? (
              <div className="text-sm text-muted-foreground py-8 text-center">
                No pending admin whitelist requests.
              </div>
            ) : (
              <div className="divide-y divide-white/5">
                {(whitelist ?? []).map((w: any) => (
                  <div key={w.id} className="py-3 flex items-center justify-between text-sm">
                    <div>
                      <div className="font-medium">{w.email}</div>
                      <div className="text-xs text-muted-foreground">
                        {w.companies?.name ?? "—"} · {w.role?.replace(/_/g, " ")}
                      </div>
                    </div>
                    <StatusBadge status={w.status} />
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}
