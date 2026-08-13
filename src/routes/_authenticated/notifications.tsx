import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  CheckCheck,
  Info,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  ExternalLink,
  Loader2,
  Inbox,
  ChevronRight,
  HelpCircle,
  Send,
  ShieldAlert,
  Building2,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { useNotifications } from "@/hooks/use-notifications";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import { ROLE_MAP } from "@/lib/roles";
import {
  NOTIFICATION_TRIGGERS,
  NOTIFICATION_COUNTS_BY_ROLE,
  fireNotification,
  type NotificationSeverity,
} from "@/lib/notifications";
import { ROLES } from "@/lib/roles";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/_authenticated/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — FactoryOS AI" },
      { name: "description", content: "Role-scoped notifications across the order lifecycle." },
    ],
  }),
  component: NotificationsPage,
});

const severityConfig: Record<
  NotificationSeverity,
  { icon: typeof Info; color: string; bg: string; border: string }
> = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
  warning: {
    icon: AlertTriangle,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  success: {
    icon: CheckCircle2,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  error: {
    icon: XCircle,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
};

function severityIcon(severity: string) {
  const conf = severityConfig[severity as NotificationSeverity] ?? severityConfig.info;
  const Icon = conf.icon;
  return <Icon className={`h-4 w-4 ${conf.color}`} />;
}

function roleLabel(r: string): string {
  return (ROLE_MAP as Record<string, { label: string }>)[r]?.label ?? r.replace(/_/g, " ");
}

function TriggerReferencePanel({ role }: { role: string | null }) {
  const [open, setOpen] = useState(false);

  if (!role) return null;

  const relevantTriggers = Object.entries(NOTIFICATION_TRIGGERS)
    .filter(([, t]) => (t.receivers as unknown as string[]).includes(role))
    .map(([name, t]) => ({ name, ...t }));

  const totalCount = NOTIFICATION_COUNTS_BY_ROLE[role] ?? 0;
  if (relevantTriggers.length === 0) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-white/5 bg-card/40 backdrop-blur-sm mb-8 overflow-hidden"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 text-sm hover:bg-card/60 transition-colors cursor-pointer group">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="font-medium">
            How notifications work for <span className="text-primary">{roleLabel(role)}</span>
          </span>
          <span className="text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
            {totalCount} trigger{totalCount !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground/70 leading-relaxed">
            These are the events that trigger a notification for your role. Every notification is{" "}
            <strong className="text-foreground/80">targeted</strong> — you only see what's relevant
            to you. Other roles never receive your notifications, and you never receive theirs.
          </p>
          <div className="space-y-2">
            {relevantTriggers.map((trigger) => (
              <div
                key={trigger.name}
                className="rounded-lg border border-white/5 bg-card/60 p-3 text-sm transition-colors hover:border-white/10"
              >
                <div className="flex items-center justify-between gap-2 mb-1">
                  <span className="font-medium text-xs">{trigger.name}</span>
                  <span className="text-[10px] text-muted-foreground bg-muted/20 px-1.5 py-0.5 rounded whitespace-nowrap">
                    {trigger.sender} →
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {trigger.description}
                </p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {trigger.receivers.map((r: string) => {
                    const isCurrentRole = r === role;
                    return (
                      <span
                        key={r}
                        className={`text-[10px] px-2 py-0.5 rounded-full border ${
                          isCurrentRole
                            ? "bg-primary/10 border-primary/20 text-primary font-medium"
                            : "bg-muted/20 border-white/5 text-muted-foreground"
                        }`}
                      >
                        {isCurrentRole ? "✦ " : ""}
                        {roleLabel(r)}
                      </span>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function SendNotificationForm({
  companyId,
  senderRole,
  isMainAdmin,
}: {
  companyId: string | null;
  senderRole: string | null;
  isMainAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [severity, setSeverity] = useState<NotificationSeverity>("info");
  const [sending, setSending] = useState(false);

  // Only the designated MAIN-ADMIN may send a manual message to Root Super Admin.
  // Enforced in the UI here AND at the RLS layer (notifications_insert_main_admin_only).
  const availableRoles = ROLES.filter(
    (r) => r.id !== senderRole && (r.id !== "root_super_admin" || isMainAdmin),
  );

  function toggleRole(roleId: string) {
    setSelectedRoles((prev) =>
      prev.includes(roleId) ? prev.filter((r) => r !== roleId) : [...prev, roleId],
    );
  }

  async function handleSend() {
    if (!companyId || !body.trim() || selectedRoles.length === 0) return;
    setSending(true);
    try {
      const notificationTitle =
        title.trim() || `📨 Manual message from ${roleLabel(senderRole ?? "unknown")}`;
      let sent = 0;
      for (const toRole of selectedRoles) {
        const ok = await fireNotification(
          companyId,
          toRole,
          null,
          notificationTitle,
          body.trim(),
          severity,
        );
        if (ok) sent += 1;
      }
      if (sent === 0) {
        toast.error("Notification delivery failed. Check the console or your permissions.");
        return;
      }
      toast.success(
        sent === selectedRoles.length
          ? `Notification sent to ${sent} role${sent > 1 ? "s" : ""}`
          : `Sent to ${sent} of ${selectedRoles.length} role${selectedRoles.length > 1 ? "s" : ""} (${selectedRoles.length - sent} failed)`,
      );
      setTitle("");
      setBody("");
      setSelectedRoles([]);
      setSeverity("info");
    } catch {
      toast.error("Failed to send notification");
    } finally {
      setSending(false);
    }
  }

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="rounded-xl border border-white/5 bg-card/40 backdrop-blur-sm mb-8 overflow-hidden"
    >
      <CollapsibleTrigger className="flex items-center justify-between w-full px-4 py-3 text-sm hover:bg-card/60 transition-colors cursor-pointer group">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="font-medium">Send a manual notification</span>
          {selectedRoles.length > 0 && (
            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {selectedRoles.length} role{selectedRoles.length > 1 ? "s" : ""} selected
            </span>
          )}
        </div>
        <ChevronRight
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-90" : ""}`}
        />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4">
          <p className="text-xs text-muted-foreground/70">
            Send a manual notification to specific roles. Select the roles you want to notify, write
            your message, and choose a severity level.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Title (optional)</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`📨 Message from ${roleLabel(senderRole ?? "user")}`}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Message *</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Type your notification message..."
              rows={3}
              className="text-sm resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Severity</Label>
            <div className="flex gap-2">
              {[
                {
                  value: "info" as const,
                  label: "Info",
                  color: "text-blue-400",
                  bg: "bg-blue-500/10",
                },
                {
                  value: "success" as const,
                  label: "Success",
                  color: "text-emerald-400",
                  bg: "bg-emerald-500/10",
                },
                {
                  value: "warning" as const,
                  label: "Warning",
                  color: "text-amber-400",
                  bg: "bg-amber-500/10",
                },
                {
                  value: "error" as const,
                  label: "Error",
                  color: "text-rose-400",
                  bg: "bg-rose-500/10",
                },
              ].map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setSeverity(opt.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                    severity === opt.value
                      ? `${opt.bg} ${opt.color} border-current`
                      : "bg-card/60 border-white/5 text-muted-foreground hover:border-white/20"
                  }`}
                >
                  <ShieldAlert className="h-3 w-3" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Send to roles *</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
              {availableRoles.map((r) => {
                const isSelected = selectedRoles.includes(r.id);
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    onClick={() => toggleRole(r.id)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs border transition-all ${
                      isSelected
                        ? "bg-primary/10 border-primary/30 text-primary"
                        : "bg-card/60 border-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{r.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="text-[10px] text-muted-foreground">
              {selectedRoles.length === 0
                ? "Select at least one role to notify"
                : `Will send to ${selectedRoles.length} role${selectedRoles.length > 1 ? "s" : ""}`}
            </div>
            <Button
              size="sm"
              className="bg-[image:var(--gradient-primary)]"
              onClick={handleSend}
              disabled={!body.trim() || selectedRoles.length === 0 || sending || !companyId}
            >
              {sending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <Send className="h-3.5 w-3.5 mr-1.5" />
              )}
              Send
            </Button>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

function RootNotificationsFeed() {
  const { data: registrations } = useQuery({
    queryKey: ["root-notif-registrations"],
    queryFn: async () => {
      try {
        const { data } = await supabase
          .from("company_registrations")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(25);
        return data ?? [];
      } catch {
        return [];
      }
    },
  });
  const pending = (registrations ?? []).filter((r: any) => r.status === "pending").length;

  return (
    <Panel
      title="Company Registration Requests"
      right={
        <span className="text-[10px] text-primary flex items-center gap-1">
          <Building2 className="h-3 w-3" />
          {pending} pending
        </span>
      }
    >
      {!registrations?.length ? (
        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
          <Inbox className="h-12 w-12 mb-3 opacity-30" />
          <div className="text-sm">No company registration requests yet</div>
          <div className="text-xs mt-1">New registrations will appear here in real time.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {(registrations ?? []).map((reg: any) => {
            const sev: NotificationSeverity =
              reg.status === "pending"
                ? "warning"
                : reg.status === "approved"
                  ? "success"
                  : "error";
            return (
              <div key={reg.id} className="rounded-xl border border-white/5 bg-card/60 p-3 text-sm">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-lg grid place-items-center shrink-0",
                      sev === "warning"
                        ? "bg-amber-500/10"
                        : sev === "success"
                          ? "bg-emerald-500/10"
                          : "bg-rose-500/10",
                    )}
                  >
                    {severityIcon(sev)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium truncate">🏢 {reg.company_name}</span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {timeAgo(reg.created_at)}
                      </span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {reg.email}
                      {reg.industry ? ` · ${reg.industry}` : ""} · status:{" "}
                      <span className="capitalize">{reg.status}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}

function NotificationsPage() {
  const { companyId, roles, isMainAdmin } = useAuth();
  const role = primaryRole(roles);
  const isRoot = role === "root_super_admin";
  const { notifications, unreadCount, loading, markAsRead, markAllAsRead } = useNotifications();
  const roleLabel = role ? ROLE_MAP[role]?.label : "";

  const grouped = notifications.reduce(
    (acc, n) => {
      const key = n.is_read ? "read" : "unread";
      if (!acc[key]) acc[key] = [];
      acc[key].push(n);
      return acc;
    },
    { unread: [] as typeof notifications, read: [] as typeof notifications },
  );

  return (
    <div className="max-w-[1200px] mx-auto">
      <ModuleStatusBar moduleName="notifications" />

      <PageHeader
        eyebrow="Notifications"
        title={`${roleLabel} Notifications`}
        sub="Real-time updates across your workflow. Each notification is targeted to your role only."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="outline"
              className="glass border-white/5 text-xs h-8"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3.5 w-3.5 mr-1.5" />
              Mark all as read ({unreadCount})
            </Button>
          ) : (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-success" />
              All caught up
            </div>
          )
        }
      />

      <TriggerReferencePanel role={role} />

      {isRoot ? (
        <RootNotificationsFeed />
      ) : role === "auditor" ? null : ( // Auditor receives zero notifications and cannot send any (writes blocked at DB level)
        <SendNotificationForm companyId={companyId} senderRole={role} isMainAdmin={isMainAdmin} />
      )}

      {isRoot ? null : loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Inbox className="h-12 w-12 mb-3 opacity-30" />
          <div className="text-sm">No notifications yet</div>
          <div className="text-xs mt-1">
            Role-specific notifications will appear here in real time.
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Unread Section */}
          {grouped.unread.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
                <h2 className="text-sm font-medium">Unread ({grouped.unread.length})</h2>
              </div>
              <AnimatePresence>
                <div className="space-y-2">
                  {grouped.unread.map((n) => (
                    <NotificationCard
                      key={n.id}
                      notification={n}
                      onMarkRead={() => markAsRead(n.id)}
                    />
                  ))}
                </div>
              </AnimatePresence>
            </div>
          )}

          {/* Read Section */}
          {grouped.read.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted-foreground mb-3">
                Earlier ({grouped.read.length})
              </h2>
              <div className="space-y-1.5 opacity-70">
                {grouped.read.map((n) => (
                  <NotificationCard key={n.id} notification={n} read />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function NotificationCard({
  notification: n,
  onMarkRead,
  read = false,
}: {
  notification: {
    id: string;
    title: string;
    body: string;
    severity: string;
    related_entity_type: string | null;
    related_entity_id: string | null;
    created_at: string;
    is_read: boolean;
  };
  onMarkRead?: () => void;
  read?: boolean;
}) {
  const sev = severityConfig[n.severity as NotificationSeverity] ?? severityConfig.info;

  return (
    <motion.div
      initial={read ? false : { opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      className={cn(
        "rounded-xl border p-4 text-sm transition-all duration-200",
        read
          ? "bg-card/30 border-white/5"
          : `${sev.bg} ${sev.border} bg-card/60 hover:border-primary/30`,
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "h-8 w-8 rounded-lg grid place-items-center shrink-0",
            read ? "bg-muted/30" : sev.bg,
          )}
        >
          {severityIcon(n.severity)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className={cn("font-medium truncate", read && "text-muted-foreground")}>
                {n.title}
              </span>
              {!read && <span className="h-2 w-2 rounded-full bg-primary shrink-0" />}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {timeAgo(n.created_at)}
              </span>
              {!read && onMarkRead && (
                <button
                  onClick={onMarkRead}
                  className="text-[10px] text-primary hover:text-primary/80 transition"
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
          <div
            className={cn(
              "mt-0.5 text-xs leading-relaxed",
              read ? "text-muted-foreground/60" : "text-muted-foreground",
            )}
          >
            {n.body}
          </div>
          {n.related_entity_type && (
            <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <ExternalLink className="h-3 w-3" />
              <span>
                {n.related_entity_type} · {n.related_entity_id?.slice(0, 8)}
              </span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
