import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Kpi, PageHeader, Panel, StatusBadge } from "@/components/ui-parts";
import { ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { safeDate } from "@/lib/utils";
import { Building2, FileCheck2, Timer, ClipboardX, ScrollText, Activity } from "lucide-react";

export const Route = createFileRoute("/_authenticated/platform/")({
  head: () => ({
    meta: [
      { title: "Platform Console — FactoryOS AI" },
      { name: "description", content: "Root Super Admin platform overview." },
    ],
  }),
  component: PlatformHome,
});

function PlatformHome() {
  const companies = useQuery({
    queryKey: ["p-companies"],
    queryFn: async () =>
      (await supabase.from("companies").select("*").order("created_at", { ascending: false }))
        .data ?? [],
  });
  const whitelist = useQuery({
    queryKey: ["p-whitelist"],
    queryFn: async () =>
      (
        await supabase
          .from("whitelist")
          .select("*")
          .eq("role", "company_admin")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });
  const audit = useQuery({
    queryKey: ["p-audit"],
    queryFn: async () =>
      (
        await supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(20)
      ).data ?? [],
  });

  const approved = companies.data?.filter((c) => (c.status ?? "active") === "active").length ?? 0;
  const suspended = companies.data?.filter((c) => c.status === "suspended").length ?? 0;
  const pending = whitelist.data?.filter((w) => w.status === "pending").length ?? 0;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Platform"
        title="Platform Console"
        sub="Manage tenants, whitelist Company Admins and monitor platform-wide activity."
        actions={
          <>
            <ModuleCopilot moduleName="platform" />
            <Button variant="outline" className="glass border-white/5">
              <Activity className="h-4 w-4 mr-1.5" />
              Live
            </Button>
          </>
        }
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Total Companies"
          value={String(companies.data?.length ?? 0)}
          icon={Building2}
          tone="primary"
        />
        <Kpi label="Active" value={String(approved)} icon={Building2} tone="success" />
        <Kpi label="Suspended" value={String(suspended)} icon={ClipboardX} tone="destructive" />
        <Kpi label="Pending Admin Invites" value={String(pending)} icon={Timer} tone="warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4">
        <div className="lg:col-span-2">
          <Panel title="Recent tenants">
            <div className="divide-y divide-white/5 text-sm">
              {(companies.data ?? []).slice(0, 8).map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 py-2.5 items-center"
                >
                  <div>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {c.industry ?? "—"} · {c.country ?? "—"}
                    </div>
                  </div>
                  <StatusBadge status={c.status ?? "active"} />
                  <div className="text-xs text-muted-foreground">{safeDate(c.created_at)}</div>
                </div>
              ))}
              {companies.isFetched && (companies.data ?? []).length === 0 && (
                <div className="py-6 text-xs text-muted-foreground">
                  No companies yet — whitelist a Company Admin to onboard your first tenant.
                </div>
              )}
            </div>
          </Panel>
        </div>
        <Panel
          title="Recent whitelist activity"
          right={<FileCheck2 className="h-4 w-4 text-muted-foreground" />}
        >
          <div className="divide-y divide-white/5 text-sm">
            {(whitelist.data ?? []).slice(0, 6).map((w) => (
              <div key={w.id} className="grid grid-cols-[1fr_auto] gap-3 py-2 items-center">
                <div className="truncate">
                  <div className="font-medium truncate">{w.email}</div>
                  <div className="text-[11px] text-muted-foreground capitalize">
                    {w.role.replace(/_/g, " ")}
                  </div>
                </div>
                <StatusBadge status={w.status} />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-4">
        <Panel
          title="Latest platform audit events"
          right={<ScrollText className="h-4 w-4 text-muted-foreground" />}
        >
          <div className="divide-y divide-white/5 text-sm">
            {(audit.data ?? []).map((l) => (
              <div key={l.id} className="grid grid-cols-[1fr_auto] gap-3 py-2 items-center">
                <div>
                  <span className="font-medium">{l.action}</span>{" "}
                  <span className="text-muted-foreground">· {l.entity ?? "system"}</span>
                </div>
                <div className="text-xs text-muted-foreground tabular-nums">
                  {safeDate(l.created_at, true)}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
