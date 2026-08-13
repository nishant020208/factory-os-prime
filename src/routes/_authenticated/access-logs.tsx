import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { safeDate } from "@/lib/utils";
import { Download, KeyRound, Loader2, RefreshCw, LogIn, LogOut, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
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

export const Route = createFileRoute("/_authenticated/access-logs")({
  head: () => ({
    meta: [
      { title: "Access Logs — FactoryOS AI" },
      {
        name: "description",
        content: "Login history per user: who signed in, when, from what role, success or failure.",
      },
    ],
  }),
  component: AccessLogsPage,
});

interface AccessLogRow {
  id: string;
  email: string | null;
  role: string | null;
  action: string;
  status: string;
  ip_address: string | null;
  created_at: string;
}

const ACTION_META: Record<string, { label: string; icon: typeof LogIn }> = {
  login: { label: "Login", icon: LogIn },
  login_failed: { label: "Login failed", icon: KeyRound },
  logout: { label: "Logout", icon: LogOut },
  signup: { label: "Sign up", icon: UserPlus },
};

function AccessLogsPage() {
  const { companyId } = useAuth();
  const [emailFilter, setEmailFilter] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["access-logs", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      return (data ?? []) as AccessLogRow[];
    },
  });

  const filtered = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (emailFilter && !(r.email ?? "").toLowerCase().includes(emailFilter.toLowerCase()))
        return false;
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (fromDate && new Date(r.created_at) < new Date(fromDate)) return false;
      if (toDate && new Date(r.created_at) > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [data, emailFilter, actionFilter, statusFilter, fromDate, toDate]);

  const failed = (data ?? []).filter((r) => r.status === "failed").length;
  const success = (data ?? []).filter((r) => r.status === "success").length;
  const uniqueUsers = new Set((data ?? []).map((r) => r.email ?? "")).size;

  function handleExport() {
    const head = ["Time", "User", "Role", "Action", "Status", "IP"];
    const body = filtered.map((r) =>
      [
        r.created_at,
        r.email ?? "",
        r.role ?? "",
        r.action,
        r.status,
        r.ip_address ?? "",
      ]
        .map((s) => `"${String(s).replace(/"/g, '""')}"`)
        .join(","),
    );
    const blob = new Blob([head.join(",") + "\n" + body.join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `access-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} access events`);
  }

  return (
    <div className="max-w-[1400px] mx-auto">
      <ModuleStatusBar moduleName="access-logs" />
      <PageHeader
        eyebrow="Compliance"
        title="Access Logs"
        sub="Login history per user — who signed in, when, from what role, and whether the attempt succeeded. Append-only."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ModuleCopilot moduleName="access-logs" />
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Refresh
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <StatCard label="Total events" value={String(data?.length ?? 0)} />
        <StatCard label="Successful logins" value={String(success)} />
        <StatCard label="Failed attempts" value={String(failed)} />
        <StatCard label="Distinct users" value={String(uniqueUsers)} />
      </div>

      <Panel title={`${filtered.length} access event${filtered.length !== 1 ? "s" : ""}`}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">User email</Label>
            <Input
              value={emailFilter}
              onChange={(e) => setEmailFilter(e.target.value)}
              placeholder="Search email…"
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Event</Label>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All events</SelectItem>
                {Object.entries(ACTION_META).map(([v, m]) => (
                  <SelectItem key={v} value={v}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Status</Label>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">From</Label>
            <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="h-9 text-xs" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">To</Label>
            <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="h-9 text-xs" />
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading access history…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No access events yet"
            sub="Login attempts are recorded automatically as users sign in and out — successes and failures alike."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">User</th>
                  <th className="px-3 py-2 font-medium">Role</th>
                  <th className="px-3 py-2 font-medium">Event</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">IP</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const meta = ACTION_META[r.action] ?? { label: r.action.replace(/_/g, " "), icon: KeyRound };
                  const Icon = meta.icon;
                  return (
                    <tr key={r.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {safeDate(r.created_at, true)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-medium">{r.email ?? "—"}</td>
                      <td className="px-3 py-2.5 text-xs">
                        {r.role ? r.role.replace(/_/g, " ") : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex items-center gap-1.5 text-xs">
                          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          {meta.label}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        {r.status === "success" ? (
                          <span className="text-[11px] font-medium text-emerald-400">SUCCESS</span>
                        ) : (
                          <span className="text-[11px] font-medium text-destructive">FAILED</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-muted-foreground">{r.ip_address ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-card/40 p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
