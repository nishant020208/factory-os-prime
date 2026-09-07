import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardCheck,
  Package,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Warehouse,
  Search,
  RefreshCw,
  Loader2,
  FileText,
  Clock,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Kpi, Panel, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { safeDate } from "@/lib/utils";
import { fmtNumberShort } from "@/lib/currency";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/incoming-inspection")({
  head: () => ({
    meta: [
      { title: "Incoming Inspection — FactoryOS AI" },
      { name: "description", content: "Inbound material quality inspection, acceptance and quarantine." },
    ],
  }),
  component: IncomingInspectionPage,
});

export function IncomingInspectionPage() {
  const queryClient = useQueryClient();
  const { companyId, user, roles, plantId } = useAuth();
  const isAuditor = roles.includes("auditor");
  const isQcOrAdmin =
    roles.includes("quality_inspector") ||
    roles.includes("company_admin") ||
    roles.includes("plant_admin");

  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [notesState, setNotesState] = useState<Record<string, string>>({});
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Reject dialog
  const [rejectDialogItem, setRejectDialogItem] = useState<any | null>(null);
  const [rejectReason, setRejectReason] = useState("Defects found / out of specification");
  const [rejectNotes, setRejectNotes] = useState("");

  // Live incoming inspections
  const {
    data: inspections,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["incoming-inspections", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await (supabase.from("incoming_material_inspections" as any) as any)
        .select(
          "*, materials(id, name, unit), warehouses(id, name, code, plant_id), purchase_orders(id, po_number, suppliers(name))",
        )
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!companyId,
  });

  // Warehouses list for filtering
  const { data: warehouses } = useQuery({
    queryKey: ["ii-warehouses", companyId],
    queryFn: async () =>
      (
        await supabase
          .from("warehouses")
          .select("id, name, code")
          .eq("company_id", companyId ?? "")
          .order("name")
      ).data ?? [],
    enabled: !!companyId,
  });

  // Realtime subscription for fresh inbound receipts
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`incoming-inspections-${companyId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "incoming_material_inspections" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["incoming-inspections"] });
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [companyId, queryClient]);

  // Process Inspection Mutation (Approve / Reject)
  const processMutation = useMutation({
    mutationFn: async ({
      id,
      decision,
      notes,
      reason,
    }: {
      id: string;
      decision: "approved" | "rejected";
      notes?: string;
      reason?: string;
    }) => {
      setProcessingId(id);
      const { data, error } = await (supabase.rpc as any)("process_incoming_inspection", {
        p_inspection_id: id,
        p_decision: decision,
        p_notes: notes ?? notesState[id] ?? null,
        p_rejection_reason: decision === "rejected" ? reason || "Failed incoming QC" : null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: ["incoming-inspections"] });
      queryClient.invalidateQueries({ queryKey: ["wh-inventory"] });
      queryClient.invalidateQueries({ queryKey: ["tr-stock"] });
      setProcessingId(null);
      setRejectDialogItem(null);
      setRejectNotes("");
      if (vars.decision === "approved") {
        toast.success("✅ Material approved — stock credited to warehouse inventory");
      } else {
        toast.error("❌ Material rejected — quantity quarantined and logged");
      }
    },
    onError: (err: any) => {
      setProcessingId(null);
      toast.error(err.message ?? "Failed to process inspection");
    },
  });

  // KPIs
  const rows = inspections ?? [];
  const pendingCount = rows.filter((r: any) => r.status === "pending").length;
  const approvedCount = rows.filter((r: any) => r.status === "approved" || r.result === "approved").length;
  const rejectedCount = rows.filter((r: any) => r.status === "rejected" || r.result === "rejected").length;
  const totalQtyInspected = rows.reduce(
    (acc: number, r: any) => (r.status !== "pending" ? acc + Number(r.quantity ?? 0) : acc),
    0,
  );

  const filtered = useMemo(() => {
    return rows.filter((r: any) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (warehouseFilter !== "all" && r.warehouse_id !== warehouseFilter) return false;
      if (q.trim()) {
        const needle = q.toLowerCase();
        const mat = (r.materials?.name ?? "").toLowerCase();
        const po = (r.purchase_orders?.po_number ?? "").toLowerCase();
        const supp = (r.purchase_orders?.suppliers?.name ?? "").toLowerCase();
        const wh = (r.warehouses?.name ?? "").toLowerCase();
        if (!mat.includes(needle) && !po.includes(needle) && !supp.includes(needle) && !wh.includes(needle)) {
          return false;
        }
      }
      return true;
    });
  }, [rows, statusFilter, warehouseFilter, q]);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <PageHeader
        eyebrow="Quality Assurance & Warehouse QC"
        title="Incoming Material Inspection"
        sub="Verify, test, and approve inbound raw materials upon warehouse arrival before release into production."
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Kpi
          label="Awaiting Inspection"
          value={String(pendingCount)}
          icon={Clock}
          tone={pendingCount > 0 ? "warning" : undefined}
        />
        <Kpi
          label="Approved & Stocked"
          value={String(approvedCount)}
          icon={ShieldCheck}
          tone="success"
        />
        <Kpi
          label="Quarantined / Rejected"
          value={String(rejectedCount)}
          icon={ShieldAlert}
          tone={rejectedCount > 0 ? "destructive" : undefined}
        />
        <Kpi
          label="Total Units Checked"
          value={fmtNumberShort(totalQtyInspected)}
          icon={ClipboardCheck}
          tone="info"
        />
      </div>

      {/* Control bar */}
      <Panel title="Inspection Filters & Search">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[220px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search material, PO, supplier..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-8 h-9 text-xs"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>

            <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Warehouse" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Warehouses</SelectItem>
                {(warehouses ?? []).map((w: any) => (
                  <SelectItem key={w.id} value={w.id}>
                    {w.name} ({w.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isLoading}
            className="h-9 gap-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </Panel>

      {/* Inspections Table */}
      <Panel title={`Inbound Quality Inspection Queue (${filtered.length})`}>
        {filtered.length === 0 ? (
          <EmptyState
            title="No incoming inspections"
            sub="When the warehouse confirms a Goods Receipt from inbound POs, pending quality inspections will appear here for the Quality Inspector."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>PO & Supplier</TableHead>
                  <TableHead>Delivery Warehouse</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Received Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Inspector Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((item: any) => {
                  const isPending = item.status === "pending";
                  const isProcessing = processingId === item.id;
                  const isApproved = item.status === "approved" || item.result === "approved";
                  const isRejected = item.status === "rejected" || item.result === "rejected";

                  return (
                    <TableRow key={item.id} className="hover:bg-white/[0.02]">
                      <TableCell>
                        <div className="font-semibold text-foreground">
                          {item.materials?.name ?? "Raw Material"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Unit: {item.materials?.unit ?? "pcs"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="font-mono text-xs text-primary font-medium">
                          {item.purchase_orders?.po_number ?? "—"}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {item.purchase_orders?.suppliers?.name ?? "Supplier"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-secondary/40 text-xs">
                          <Warehouse className="h-3 w-3 text-muted-foreground" />
                          <span>{item.warehouses?.name ?? "Main Warehouse"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {fmtNumberShort(Number(item.quantity ?? 0))} {item.materials?.unit ?? "units"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {safeDate(item.created_at)}
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={item.status ?? "pending"} />
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        {isPending && isQcOrAdmin && !isAuditor ? (
                          <Input
                            placeholder="Add test notes..."
                            value={notesState[item.id] ?? ""}
                            onChange={(e) =>
                              setNotesState((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            className="h-7 text-xs bg-background/50"
                          />
                        ) : (
                          <span className="text-xs text-muted-foreground truncate block">
                            {item.inspection_notes || item.rejection_reason || "—"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {isPending ? (
                          isQcOrAdmin && !isAuditor ? (
                            <div className="inline-flex items-center gap-1.5">
                              <Button
                                size="sm"
                                variant="default"
                                className="h-7 px-2.5 bg-emerald-600 hover:bg-emerald-500 text-white gap-1 text-xs"
                                disabled={isProcessing}
                                onClick={() =>
                                  processMutation.mutate({
                                    id: item.id,
                                    decision: "approved",
                                    notes: notesState[item.id],
                                  })
                                }
                              >
                                {isProcessing ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                )}
                                Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="h-7 px-2.5 gap-1 text-xs"
                                disabled={isProcessing}
                                onClick={() => setRejectDialogItem(item)}
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-amber-500/80 italic">Awaiting QC</span>
                          )
                        ) : isApproved ? (
                          <span className="text-xs text-emerald-500 font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Stocked
                          </span>
                        ) : isRejected ? (
                          <span className="text-xs text-destructive font-medium inline-flex items-center gap-1">
                            <AlertTriangle className="h-3.5 w-3.5" /> Quarantined
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Panel>

      {/* Reject & Quarantine Dialog */}
      <Dialog
        open={!!rejectDialogItem}
        onOpenChange={(open) => {
          if (!open) setRejectDialogItem(null);
        }}
      >
        <DialogContent className="sm:max-w-[460px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Reject & Quarantine Material
            </DialogTitle>
          </DialogHeader>

          {rejectDialogItem && (
            <div className="space-y-4 py-2">
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs space-y-1">
                <div className="font-semibold text-foreground">
                  {rejectDialogItem.materials?.name} (Qty: {rejectDialogItem.quantity})
                </div>
                <div className="text-muted-foreground">
                  PO: {rejectDialogItem.purchase_orders?.po_number ?? "—"} · Warehouse:{" "}
                  {rejectDialogItem.warehouses?.name ?? "Main Warehouse"}
                </div>
                <div className="text-muted-foreground">
                  Rejecting will lock this quantity into <strong>Quarantined Stock</strong> and alert
                  procurement.
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Rejection Reason *</Label>
                <Select value={rejectReason} onValueChange={setRejectReason}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Defects found / out of specification">
                      Defects found / out of specification
                    </SelectItem>
                    <SelectItem value="Damaged in transit / packaging breach">
                      Damaged in transit / packaging breach
                    </SelectItem>
                    <SelectItem value="Moisture content out of tolerance">
                      Moisture content out of tolerance
                    </SelectItem>
                    <SelectItem value="Incorrect grade or dimensions">
                      Incorrect grade or dimensions
                    </SelectItem>
                    <SelectItem value="Missing manufacturer test certificate">
                      Missing manufacturer test certificate
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Detailed Quality Notes</Label>
                <Textarea
                  placeholder="Describe the failure, measurement results, or quarantine instructions..."
                  value={rejectNotes}
                  onChange={(e) => setRejectNotes(e.target.value)}
                  className="text-xs min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setRejectDialogItem(null)}
              disabled={processMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={processMutation.isPending}
              onClick={() => {
                if (!rejectDialogItem) return;
                processMutation.mutate({
                  id: rejectDialogItem.id,
                  decision: "rejected",
                  reason: rejectReason,
                  notes: rejectNotes,
                });
              }}
            >
              {processMutation.isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <ShieldAlert className="h-3.5 w-3.5 mr-1.5" />
              )}
              Confirm Quarantine
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
