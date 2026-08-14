import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertOctagon, Wrench, Loader2, Play, CheckCircle2, Clock } from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { safeDate } from "@/lib/utils";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated/breakdowns")({
  head: () => ({
    meta: [
      { title: "Breakdowns — FactoryOS AI" },
      { name: "description", content: "Machine breakdown tickets reported by operators." },
    ],
  }),
  component: BreakdownsPage,
});

function BreakdownsPage() {
  const queryClient = useQueryClient();
  const { user, roles } = useAuth();
  const isAuditor = roles.includes("auditor");
  const canAct = roles.some((r) =>
    ["maintenance_engineer", "company_admin", "production_manager", "warehouse_manager"].includes(r),
  );
  const [resolveDialog, setResolveDialog] = useState<{ open: boolean; ticket: any | null; notes: string }>({
    open: false,
    ticket: null,
    notes: "",
  });

  // REAL tickets reported by Production Operators (verified in the Operator
  // build) — routed by issue type to Maintenance / Warehouse / PM.
  const { data: tickets } = useQuery({
    queryKey: ["bd-tickets"],
    queryFn: async () =>
      (
        await supabase
          .from("maintenance_tickets")
          .select("*, machines(name, code), reporter:profiles!maintenance_tickets_reported_by_fkey(full_name)")
          .order("created_at", { ascending: false })
      ).data ?? [],
  });

  const { data: machines } = useQuery({
    queryKey: ["bd-machines"],
    queryFn: async () =>
      (await supabase.from("machines").select("id, name, status").order("name")).data ?? [],
  });

  const open = (tickets ?? []).filter((t: any) => t.status === "open").length;
  const inProgress = (tickets ?? []).filter((t: any) => t.status === "in_progress").length;
  const resolved = (tickets ?? []).filter((t: any) => t.status === "resolved").length;
  const machinesDown = (machines ?? []).filter((m: any) => m.status === "down" || m.status === "maintenance").length;

  const acknowledgeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("maintenance_tickets")
        .update({ status: "in_progress", assigned_to: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ticket acknowledged — in progress");
      queryClient.invalidateQueries({ queryKey: ["bd-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resolveMutation = useMutation({
    mutationFn: async () => {
      if (!resolveDialog.ticket || !user) return;
      const { error } = await supabase
        .from("maintenance_tickets")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolved_by: user.id,
          resolution_notes: resolveDialog.notes.trim() || null,
        })
        .eq("id", resolveDialog.ticket.id);
      if (error) throw error;

      // Machine back to operational + logged in machine_status_log.
      const machine = resolveDialog.ticket.machines;
      if (machine?.id) {
        await supabase
          .from("machines")
          .update({ status: "operational", last_maintenance: new Date().toISOString() })
          .eq("id", machine.id);
        await supabase.from("machine_status_log").insert({
          company_id: resolveDialog.ticket.company_id,
          machine_id: machine.id,
          from_status: "down",
          to_status: "operational",
          reason: resolveDialog.notes.trim() || "Breakdown resolved",
          changed_by: user.id,
        });
      }
      // The workflow trigger notifies the reporting operator (to_user) to resume.
    },
    onSuccess: () => {
      toast.success("Ticket resolved — operator notified to resume");
      setResolveDialog({ open: false, ticket: null, notes: "" });
      queryClient.invalidateQueries({ queryKey: ["bd-tickets"] });
      queryClient.invalidateQueries({ queryKey: ["bd-machines"] });
      queryClient.invalidateQueries({ queryKey: ["maint-tickets"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow="Maintenance"
        title="Breakdown Tickets"
        sub="Machine breakdowns reported by Production Operators — routed by issue type."
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi label="Open" value={String(open)} icon={AlertOctagon} tone="warning" />
        <Kpi label="In Progress" value={String(inProgress)} icon={Play} tone="info" />
        <Kpi label="Resolved" value={String(resolved)} icon={CheckCircle2} tone="success" />
        <Kpi label="Machines Down" value={String(machinesDown)} icon={Wrench} tone="destructive" />
      </div>

      <div className="mt-4">
        <Panel title={`${(tickets ?? []).length} Breakdown Tickets`}>
          {(tickets ?? []).length === 0 ? (
            <EmptyState
              title="No breakdown tickets"
              sub="Operator-reported machine issues land here, correctly attributed to the real operator and machine."
            />
          ) : (
            <div className="divide-y divide-white/5">
              {(tickets ?? []).map((t: any) => (
                <div key={t.id} className="py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-xs text-muted-foreground">
                        {t.ticket_number ?? t.id.slice(0, 8)}
                      </span>
                      <div className="min-w-0">
                        <div className="font-medium text-sm">
                          {t.machines?.name ?? "Machine"} · {t.issue_type}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate max-w-[380px]">
                          {t.issue_description}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span>
                        Reported by {t.reporter?.full_name ?? "—"} · {safeDate(t.created_at)}
                      </span>
                      <StatusBadge status={t.status} />
                      {canAct && t.status === "open" && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => acknowledgeMutation.mutate(t.id)}
                          disabled={acknowledgeMutation.isPending}
                        >
                          <Play className="h-3 w-3 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                      {canAct && !["resolved", "closed", "cancelled"].includes(t.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs text-success"
                          onClick={() => setResolveDialog({ open: true, ticket: t, notes: t.resolution_notes ?? "" })}
                          disabled={resolveMutation.isPending}
                        >
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                  {(t.resolution_notes || t.resolved_at) && (
                    <div className="mt-1.5 text-[11px] text-muted-foreground flex items-center gap-1.5">
                      <Clock className="h-3 w-3" />
                      {t.resolution_notes ?? "Resolved"}
                      {t.resolved_at && ` · ${safeDate(t.resolved_at)}`}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Resolve dialog */}
      <Dialog open={resolveDialog.open} onOpenChange={(o) => setResolveDialog((d) => ({ ...d, open: o }))}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Resolve Breakdown Ticket</DialogTitle>
          </DialogHeader>
          {resolveDialog.ticket && (
            <div className="space-y-3 py-2">
              <div className="text-sm">
                <span className="font-medium">{resolveDialog.ticket.machines?.name}</span> ·{" "}
                {resolveDialog.ticket.issue_description}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Resolution Notes</Label>
                <Input
                  value={resolveDialog.notes}
                  onChange={(e) => setResolveDialog((d) => ({ ...d, notes: e.target.value }))}
                  placeholder="e.g. replaced drive belt, recalibrated spindle"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">
                On resolve: the machine flips back to Operational, the status change is logged, and the reporting operator is notified (to_user) to resume their work order.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveDialog({ open: false, ticket: null, notes: "" })}>
              Cancel
            </Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={() => resolveMutation.mutate()} disabled={resolveMutation.isPending}>
              {resolveMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Resolve Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
