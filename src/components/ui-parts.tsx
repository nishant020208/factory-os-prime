import { motion } from "framer-motion";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div className="min-w-0">
        {eyebrow && (
          <div className="text-xs uppercase tracking-widest text-primary/90">{eyebrow}</div>
        )}
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight mt-1">{title}</h1>
        {sub && <p className="text-sm text-muted-foreground mt-1 max-w-2xl">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  delta,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  delta?: string;
  icon?: LucideIcon;
  tone?: "primary" | "success" | "warning" | "info" | "destructive";
}) {
  const toneMap: Record<string, string> = {
    primary: "text-primary bg-primary/15 border-primary/20",
    success: "text-success bg-success/15 border-success/20",
    warning: "text-warning bg-warning/15 border-warning/20",
    info: "text-info bg-info/15 border-info/20",
    destructive: "text-destructive bg-destructive/15 border-destructive/20",
  };
  const up = delta?.startsWith("+");
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-5 shadow-card"
    >
      <div className="flex items-start justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        {Icon && (
          <div className={`h-9 w-9 rounded-xl border grid place-items-center ${toneMap[tone]}`}>
            <Icon className="h-4 w-4" />
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl sm:text-3xl font-semibold tabular-nums">{value}</div>
      {delta && (
        <div
          className={`mt-1 text-xs inline-flex items-center gap-0.5 ${up ? "text-success" : "text-destructive"}`}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}{" "}
          {delta}
        </div>
      )}
    </motion.div>
  );
}

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Card className={`glass border-white/5 shadow-card ${className}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {right}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = (status ?? "unknown").toLowerCase();
  const map: Record<string, string> = {
    active: "bg-success/15 text-success border-success/30",
    operational: "bg-success/15 text-success border-success/30",
    completed: "bg-success/15 text-success border-success/30",
    approved: "bg-success/15 text-success border-success/30",
    received: "bg-success/15 text-success border-success/30",
    in_progress: "bg-info/15 text-info border-info/30",
    running: "bg-info/15 text-info border-info/30",
    planned: "bg-muted text-muted-foreground border-white/10",
    draft: "bg-muted text-muted-foreground border-white/10",
    pending: "bg-warning/15 text-warning border-warning/30",
    maintenance: "bg-warning/15 text-warning border-warning/30",
    high: "bg-warning/15 text-warning border-warning/30",
    critical: "bg-destructive/15 text-destructive border-destructive/30",
    down: "bg-destructive/15 text-destructive border-destructive/30",
    revoked: "bg-destructive/15 text-destructive border-destructive/30",
    accepted: "bg-success/15 text-success border-success/30",
    inactive: "bg-destructive/15 text-destructive border-destructive/30",
  };
  return (
    <Badge
      variant="outline"
      className={`text-[10px] font-medium capitalize ${map[s] ?? "bg-muted text-muted-foreground"}`}
    >
      {s.replace(/_/g, " ")}
    </Badge>
  );
}

export function EmptyState({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="glass rounded-2xl p-12 text-center">
      <div className="text-lg font-medium">{title}</div>
      {sub && <div className="text-sm text-muted-foreground mt-1">{sub}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
