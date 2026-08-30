import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { safeDate } from "@/lib/utils";
import {
  ScrollText,
  Download,
  UserRound,
  Loader2,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
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
import { ROLES } from "@/lib/roles";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({
    meta: [
      { title: "Audit Logs — FactoryOS AI" },
      {
        name: "description",
        content: "Immutable audit trail of every action across the platform.",
      },
    ],
  }),
  component: AuditPage,
});

interface AuditRow {
  id: string;
  company_id: string | null;
  user_id: string | null;
  action: string;
  entity: string | null;
  entity_id: string | null;
  metadata: {
    old_value?: unknown;
    new_value?: unknown;
    [k: string]: unknown;
  } | null;
  created_at: string;
  profiles?: { full_name: string | null; email: string | null } | null;
  user_roles?: Array<{ role: string }> | null;
}

const ACTION_OPTS = [
  { value: "all", label: "All actions" },
  { value: "insert", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
];

const ROLE_LABELS: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.id, r.label]),
);

function opOf(action: string): string {
  const m = /^(insert|update|delete)_/.exec(action);
  return m ? m[1] : "other";
}

function entityLabel(entity: string | null): string {
  if (!entity) return "system";
  return entity.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function actionLabel(action: string): string {
  const m = /^(insert|update|delete)_(.+)$/.exec(action);
  if (!m) return action.replace(/_/g, " ");
  const verb = { insert: "Created", update: "Updated", delete: "Deleted" }[
    m[1] as "insert" | "update" | "delete"
  ];
  return `${verb} ${entityLabel(m[2])}`;
}

function toCsv(rows: AuditRow[]): string {
  const head = ["Time", "Actor", "Role", "Action", "Module", "Record ID", "Old value", "New value"];
  const body = rows.map((r) => {
    const actor = r.profiles?.full_name ?? r.profiles?.email ?? r.user_id ?? "system";
    const role = r.user_roles?.map((u) => u.role).join(", ") ?? "";
    const oldV = r.metadata?.old_value ? JSON.stringify(r.metadata.old_value) : "";
    const newV = r.metadata?.new_value ? JSON.stringify(r.metadata.new_value) : "";
    return [r.created_at, actor, role, actionLabel(r.action), r.entity ?? "", r.entity_id ?? "", oldV, newV]
      .map((s) => `"${String(s ?? "").replace(/"/g, '""')}"`)
      .join(",");
  });
  return head.map((h) => `"${h}"`).join(",") + "\n" + body.join("\n");
}

function AuditPage() {
  const { companyId } = useAuth();
  const [roleFilter, setRoleFilter] = useState("all");
  const [entityFilter, setEntityFilter] = useState("all");
  const [opFilter, setOpFilter] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ["audit", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("audit_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      const rows = (data ?? []) as AuditRow[];
      // audit_logs has no FK to profiles/user_roles, so resolve actor
      // names + roles with separate company-scoped queries (RLS-scoped).
      const ids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean))) as string[];
      const [{ data: profs }, { data: roles }] = await Promise.all([
        ids.length ? supabase.from("profiles").select("id, full_name, email").in("id", ids) : Promise.resolve({ data: [] }),
        ids.length ? supabase.from("user_roles").select("user_id, role").in("user_id", ids) : Promise.resolve({ data: [] }),
      ]);
      const profMap = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const roleMap = new Map<string, string[]>();
      for (const ur of roles ?? []) {
        const list = roleMap.get((ur as any).user_id) ?? [];
        list.push((ur as any).role);
        roleMap.set((ur as any).user_id, list);
      }
      return rows.map((r) => ({
        ...r,
        profiles: r.user_id ? profMap.get(r.user_id) ?? null : null,
        user_roles: r.user_id ? (roleMap.get(r.user_id) ?? []).map((role) => ({ role })) : [],
      }));
    },
  });

  const entities = useMemo(() => {
    const s = new Set<string>();
    for (const r of data ?? []) if (r.entity) s.add(r.entity);
    return Array.from(s).sort();
  }, [data]);

  const filtered = useMemo(() => {
    return (data ?? []).filter((r) => {
      if (opFilter !== "all" && opOf(r.action) !== opFilter) return false;
      if (entityFilter !== "all" && (r.entity ?? "") !== entityFilter) return false;
      if (roleFilter !== "all") {
        const roles = r.user_roles?.map((u) => u.role) ?? [];
        if (!roles.includes(roleFilter)) return false;
      }
      if (fromDate && new Date(r.created_at) < new Date(fromDate)) return false;
      if (toDate && new Date(r.created_at) > new Date(`${toDate}T23:59:59`)) return false;
      return true;
    });
  }, [data, opFilter, entityFilter, roleFilter, fromDate, toDate]);

  function handleExport() {
    const csv = toCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filtered.length} audit events`);
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="audit" />
      <PageHeader
        eyebrow="Compliance"
        title="Audit Logs"
        sub="Immutable trail of every write across the company — who, what, when, and old → new values. Append-only: nothing here can be edited or deleted."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ModuleCopilot moduleName="audit" />
            <Button variant="outline" size="sm" onClick={handleExport} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-1" /> Export CSV
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 mr-1 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        }
      />

      {/* Filters */}
      <Panel title={`${filtered.length} event${filtered.length !== 1 ? "s" : ""} · append-only`}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Actor role</Label>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {ROLES.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Module</Label>
            <Select value={entityFilter} onValueChange={setEntityFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All modules</SelectItem>
                {entities.map((e) => (
                  <SelectItem key={e} value={e}>
                    {entityLabel(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">Action</Label>
            <Select value={opFilter} onValueChange={setOpFilter}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTION_OPTS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">From</Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] text-muted-foreground">To</Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading audit trail…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No audit events match"
            sub="Every write action across the company will appear here — immutable and filterable."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Old → New</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-border/40 hover:bg-muted/30 align-top"
                  >
                    <td className="px-3 py-2.5 whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                      {safeDate(r.created_at, true)}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <UserRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div>
                          <div className="text-xs font-medium">
                            {r.profiles?.full_name ?? r.profiles?.email ?? "system"}
                          </div>
                          <div className="text-[10px] text-muted-foreground">
                            {(r.user_roles ?? [])
                              .map((u) => ROLE_LABELS[u.role] ?? u.role.replace(/_/g, " "))
                              .join(", ") || "system"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <ShieldCheck className="h-3 w-3 text-primary/70" />
                        {actionLabel(r.action)}
                      </span>
                      {r.entity_id && (
                        <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                          {r.entity_id.slice(0, 8)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{entityLabel(r.entity)}</td>
                    <td className="px-3 py-2.5">
                      {r.metadata && (r.metadata.old_value !== undefined || r.metadata.new_value !== undefined) ? (
                        <ChangeCell
                          oldV={r.metadata.old_value}
                          newV={r.metadata.new_value}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

// Human-readable labels for common database field names
const FIELD_LABELS: Record<string, string> = {
  id: "Record ID",
  company_id: "Company",
  user_id: "User",
  status: "Status",
  notes: "Notes",
  issues: "Issues",
  plant_id: "Plant",
  created_at: "Created",
  updated_at: "Updated",
  report_date: "Report Date",
  submitted_by: "Submitted By",
  units_completed: "Units Completed",
  downtime_minutes: "Downtime (min)",
  attendance_summary: "Attendance",
  inspector_id: "Inspector",
  inspection_number: "Inspection #",
  inspection_type: "Inspection Type",
  batch_reference: "Batch Reference",
  quantity_checked: "Qty Checked",
  defects_found: "Defects Found",
  overall_notes: "Overall Notes",
  result: "Result",
  full_name: "Full Name",
  email: "Email",
  role: "Role",
  name: "Name",
  label: "Label",
  type: "Type",
  entity_type: "Entity Type",
  entity_id: "Entity ID",
  action: "Action",
  metadata: "Details",
  old_value: "Old Value",
  new_value: "New Value",
  amount: "Amount",
  total_amount: "Total Amount",
  po_number: "PO Number",
  so_number: "SO Number",
  supplier_id: "Supplier",
  customer_id: "Customer",
  order_total: "Order Total",
  advance_payment_percent: "Advance %",
  advance_amount: "Advance Amount",
  balance_due: "Balance Due",
  carrier: "Carrier",
  tracking_number: "Tracking #",
  destination: "Destination",
  expected_arrival: "Expected Arrival",
  shipped_date: "Shipped Date",
  delivered_date: "Delivered Date",
  paid_date: "Paid Date",
  invoice_number: "Invoice #",
  payment_method: "Payment Method",
  product_name: "Product",
  product: "Product",
  quantity: "Quantity",
  price: "Price",
  unit_price: "Unit Price",
  work_order_number: "Work Order #",
  machine_id: "Machine",
  priority: "Priority",
  category: "Category",
  description: "Description",
  title: "Title",
  severity: "Severity",
  assigned_to: "Assigned To",
  start_date: "Start Date",
  end_date: "End Date",
  due_date: "Due Date",
  target_date: "Target Date",
  actual_date: "Actual Date",
  material: "Material",
  species: "Species",
  grade: "Grade",
  moisture_content: "Moisture %",
  hardness: "Hardness",
  dimensions: "Dimensions",
  weight: "Weight",
  color: "Color",
  finish: "Finish",
  gloss_level: "Gloss Level",
  certificate_number: "Certificate #",
  issued_by: "Issued By",
  qr_data: "QR Data",
  qr_url: "QR URL",
  token: "Token",
  sub_label: "Sub Label",
  avatar_url: "Avatar URL",
  phone: "Phone",
  address: "Address",
  city: "City",
  state: "State",
  country: "Country",
  zip_code: "ZIP Code",
  website: "Website",
  tax_id: "Tax ID",
  currency: "Currency",
  timezone: "Timezone",
  language: "Language",
  theme: "Theme",
  is_active: "Active",
  is_approved: "Approved",
  approved_by: "Approved By",
  approved_at: "Approved At",
  rejection_reason: "Rejection Reason",
  rfq_number: "RFQ #",
  material_id: "Material",
  quantity_needed: "Qty Needed",
  target_delivery_date: "Target Delivery",
  response_deadline: "Response Deadline",
  supplier_ids: "Suppliers Invited",
  quoted_unit_price: "Quoted Price",
  estimated_delivery_days: "Est. Delivery (days)",
  minimum_order_quantity: "Min Order Qty",
  submitted_at: "Submitted At",
  converted_to_po: "Converted to PO",
};

function formatFieldValue(key: string, val: unknown): React.ReactNode {
  if (val === null || val === undefined || val === "") {
    return <span className="text-muted-foreground/60">empty</span>;
  }
  if (typeof val === "boolean") {
    return val ? "Yes" : "No";
  }
  if (typeof val === "number") {
    return String(val);
  }
  if (typeof val === "string") {
    // Format dates nicely
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      try {
        return new Date(val).toLocaleString();
      } catch {
        return val;
      }
    }
    // Format UUIDs as short IDs
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) {
      return val.slice(0, 8) + "…";
    }
    return val;
  }
  return String(val);
}

function humanizeDiff(obj: Record<string, unknown>): React.ReactNode[] {
  const entries = Object.entries(obj).filter(([k]) => k !== "id");
  if (entries.length === 0) return [];
  return entries.map(([key, val]) => {
    const label = FIELD_LABELS[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    return (
      <div key={key} className="flex items-start gap-2 py-0.5">
        <span className="text-muted-foreground shrink-0 w-28 truncate font-medium">{label}</span>
        <span>{formatFieldValue(key, val)}</span>
      </div>
    );
  });
}

function ChangeCell({ oldV, newV }: { oldV?: unknown; newV?: unknown }) {
  const [open, setOpen] = useState(false);

  if (oldV === undefined && newV === undefined) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs text-primary hover:text-primary/80 transition"
      >
        View diff →
      </button>
    );
  }

  // Compute changed fields for NEW
  const changedFields = (oldV && newV && typeof oldV === "object" && typeof newV === "object")
    ? Object.keys(newV as Record<string, unknown>).filter(
        (k) => JSON.stringify((oldV as any)[k]) !== JSON.stringify((newV as any)[k])
      )
    : [];

  const formatObject = (v: unknown) => {
    if (v === undefined || v === null) return <span className="text-muted-foreground/60">—</span>;
    if (typeof v === "object") {
      const entries = Object.entries(v as Record<string, unknown>).filter(([k]) => k !== "id");
      if (entries.length === 0) return <span className="text-muted-foreground/60">empty</span>;
      return (
        <div className="max-h-40 overflow-y-auto space-y-0.5">
          {humanizeDiff(v as Record<string, unknown>)}
        </div>
      );
    }
    return <span>{String(v)}</span>;
  };

  return (
    <div className="flex flex-col gap-1.5 text-xs">
      {oldV !== undefined && (
        <div className="flex items-start gap-1.5">
          <span className="text-destructive font-medium shrink-0">OLD</span>
          <div className="flex-1">{formatObject(oldV)}</div>
        </div>
      )}
      {newV !== undefined && (
        <div className="flex items-start gap-1.5">
          <span className="text-emerald-400 font-medium shrink-0">NEW</span>
          <div className="flex-1">
            {changedFields.length > 0 ? (
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {changedFields.map((k) => {
                  const label = FIELD_LABELS[k] ?? k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <div key={k} className="flex items-start gap-2 py-0.5">
                      <span className="text-muted-foreground shrink-0 w-28 truncate font-medium">{label}</span>
                      <span className="text-emerald-300">{formatFieldValue(k, (newV as any)[k])}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              formatObject(newV)
            )}
          </div>
        </div>
      )}
      <button onClick={() => setOpen(false)} className="text-[10px] text-muted-foreground text-left">
        <ArrowRight className="h-3 w-3 inline mr-1 -rotate-90" />
        Collapse
      </button>
    </div>
  );
}
