import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, StatusBadge, Kpi } from "@/components/ui-parts";
import { ModuleCopilot } from "@/components/module-status";
import { safeDate } from "@/lib/utils";
import { ShieldCheck, AlertTriangle, UserX, Lock, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform/security")({
  head: () => ({
    meta: [
      { title: "Security Center — FactoryOS AI" },
      { name: "description", content: "Platform-wide security posture — sign-in activity, suspensions and RLS policy health." },
    ],
  }),
  component: SecurityCenter,
});

function SecurityCenter() {
  // Real sign-in activity across every tenant (aggregate only — no per-user drill-down)
  const access = useQuery({
    queryKey: ["sec-access"],
    queryFn: async () =>
      (await supabase.from("access_logs").select("id, role, status, action, company_id, created_at").order("created_at", { ascending: false }).limit(500)).data ?? [],
  });

  const companies = useQuery({
    queryKey: ["sec-companies"],
    queryFn: async () =>
      (await supabase.from("companies").select("id, name, status").order("created_at", { ascending: false })).data ?? [],
  });

  const settings = useQuery({
    queryKey: ["sec-settings"],
    queryFn: async () => (await supabase.from("platform_settings").select("key, value")).data ?? [],
  });

  const audit = useQuery({
    queryKey: ["sec-audit"],
    queryFn: async () =>
      (
        await supabase
          .from("audit_logs")
          .select("id, action, user_id, created_at")
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
  });

  const logs = access.data ?? [];
  const failed = logs.filter((l) => l.status === "failed");
  const logins = logs.filter((l) => l.action === "login" && l.status === "success").length;
  const suspended = (companies.data ?? []).filter((c) => c.status === "suspended").length;
  const pending = (companies.data ?? []).filter((c) => c.status === "pending").length;
  const active = (companies.data ?? []).filter((c) => (c.status ?? "active") === "active").length;
  const settingMap = new Map((settings.data ?? []).map((s) => [s.key, s.value]));

  const roleCounts = new Map<string, number>();
  for (const l of logs.filter((x) => x.action === "login")) {
    const r = l.role ?? "unknown";
    roleCounts.set(r, (roleCounts.get(r) ?? 0) + 1);
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Platform"
        title="Security Center"
        sub="Platform-wide posture — real sign-in activity across all tenants, suspensions and RLS policy health."
        actions={<ModuleCopilot moduleName="security" />}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        <Kpi label="Tenants" value={String(companies.data?.length ?? 0)} icon={ShieldCheck} tone="primary" />
        <Kpi label="Active" value={String(active)} icon={ShieldCheck} tone="success" />
        <Kpi label="Suspended" value={String(suspended)} icon={UserX} tone="destructive" />
        <Kpi label="Failed sign-ins" value={String(failed.length)} icon={AlertTriangle} tone="warning" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Panel title="Sign-in activity (real access_logs)" className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-card/40 border border-white/5 p-3">
              <div className="text-[11px] text-muted-foreground">Successful logins (500 recent)</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{logins}</div>
            </div>
            <div className="rounded-lg bg-card/40 border border-white/5 p-3">
              <div className="text-[11px] text-muted-foreground">Failed attempts</div>
              <div className="text-2xl font-semibold tabular-nums mt-1 text-warning">{failed.length}</div>
            </div>
            <div className="rounded-lg bg-card/40 border border-white/5 p-3">
              <div className="text-[11px] text-muted-foreground">Platform audit events</div>
              <div className="text-2xl font-semibold tabular-nums mt-1">{audit.data?.length ?? 0}</div>
            </div>
          </div>
          <div className="mt-4">
            <div className="text-xs text-muted-foreground mb-2">Recent failed sign-ins</div>
            <div className="divide-y divide-white/5 text-sm">
              {failed.slice(0, 6).map((f) => (
                <div key={f.id} className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                    <span className="capitalize">{f.role?.replace(/_/g, " ") ?? "unknown"}</span>
                    <span className="text-[11px] text-muted-foreground">{f.company_id?.slice(0, 8) ?? "platform"}</span>
                  </div>
                  <div className="text-xs text-muted-foreground tabular-nums">{safeDate(f.created_at, true)}</div>
                </div>
              ))}
              {failed.length === 0 && (
                <div className="py-3 text-xs text-muted-foreground">No failed sign-ins recorded.</div>
              )}
            </div>
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">
            Login/logout events are written to access_logs by the app's session tracking — aggregate
            counts only, no per-user details beyond role.
          </p>
        </Panel>

        <div className="space-y-4">
          <Panel title="Tenant posture">
            <div className="space-y-2 text-sm">
              {suspended > 0 ? (
                (companies.data ?? [])
                  .filter((c) => c.status === "suspended")
                  .map((c) => (
                    <div key={c.id} className="flex items-center justify-between">
                      <span>{c.name}</span>
                      <StatusBadge status="suspended" />
                    </div>
                  ))
              ) : (
                <div className="text-xs text-muted-foreground py-2">No suspended tenants.</div>
              )}
              <div className="pt-2 border-t border-white/5 text-xs text-muted-foreground">
                {pending} pending · {active} active
              </div>
            </div>
          </Panel>
          <Panel title="Platform security settings">
            <div className="space-y-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">MFA required</span>
                <span>{settingMap.get("require_mfa") ? "On" : "Off"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Self-registration</span>
                <span>{settingMap.get("allow_self_registration") ? "Open (whitelist)" : "Invite-only"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Session timeout</span>
                <span>{String(settingMap.get("session_timeout_minutes") ?? "—")} min</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Audit retention</span>
                <span>{String(settingMap.get("audit_retention_days") ?? "—")} days</span>
              </div>
            </div>
          </Panel>
        </div>
      </div>

      <div className="mt-4">
        <Panel
          title="Latest platform audit events"
          right={<Lock className="h-4 w-4 text-muted-foreground" />}
        >
          <div className="divide-y divide-white/5 text-sm">
            {(audit.data ?? []).map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="font-medium">{l.action}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">{safeDate(l.created_at, true)}</div>
              </div>
            ))}
            {(audit.data ?? []).length === 0 && (
              <div className="py-6 text-xs text-muted-foreground text-center">No platform audit events yet.</div>
            )}
          </div>
        </Panel>
      </div>
    </div>
  );
}
