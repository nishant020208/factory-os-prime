import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download, Loader2, Plus, RefreshCw, Search, Trash2, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader, Panel, Kpi, StatusBadge, EmptyState } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import type { ColumnDef, ModuleConfig } from "@/lib/module-registry";

type Row = Record<string, unknown> & { id: string; company_id?: string };

function fmt(kind: ColumnDef["kind"], v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (kind === "currency") return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (kind === "number")   return String(Number(v).toLocaleString());
  if (kind === "date") {
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  }
  if (kind === "datetime") {
    const d = new Date(String(v));
    return isNaN(d.getTime()) ? "—" : d.toLocaleString();
  }
  const s = String(v);
  return s.length > 60 ? s.slice(0, 57) + "…" : s;
}

function toCsv(rows: Row[], cols: ColumnDef[]) {
  const head = cols.map(c => `"${c.label}"`).join(",");
  const body = rows.map(r => cols.map(c => {
    const v = r[c.key];
    const s = v == null ? "" : String(v).replace(/"/g, '""');
    return `"${s}"`;
  }).join(",")).join("\n");
  return head + "\n" + body;
}

// Roles that are allowed to create/delete records via LiveModule
const CREATE_ALLOWED_ROLES = [
  "company_admin", "plant_admin", "production_manager",
  "warehouse_manager", "procurement_manager", "quality_inspector",
  "maintenance_engineer", "finance_manager", "hr_manager",
  "customer_portal", // limited scope
];

// Roles that are strictly READ-ONLY - cannot create or delete anything
const READ_ONLY_ROLES = ["auditor", "supplier_portal"];

export function LiveModule({ config, canCreate }: { config: ModuleConfig; canCreate?: boolean }) {
  const {
    table, title, eyebrow, sub, columns, filter, orderBy,
    createDefaults, titleField, singular = "Record",
  } = config;

  const { companyId, roles } = useAuth();
  const userRole = primaryRole(roles);
  // canCreate can be overridden by the parent, otherwise derive from role
  const userCanCreate = canCreate ?? (userRole ? CREATE_ALLOWED_ROLES.includes(userRole) : false);
  const isReadOnly = userRole ? READ_ONLY_ROLES.includes(userRole) : false;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [formData, setFormData] = useState<Record<string, string>>({});

  const queryKey = useMemo(
    () => [table, companyId, filter ?? null, orderBy ?? null] as const,
    [table, companyId, filter, orderBy],
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    enabled: !!companyId,
    queryFn: async () => {
      try {
        let query = supabase.from(table as never).select("*").limit(500);
        if (filter) {
          for (const [k, v] of Object.entries(filter)) query = (query as never as ReturnType<typeof query.eq>).eq(k, v);
        }
        if (orderBy) {
          query = (query as never as ReturnType<typeof query.order>).order(orderBy.column, { ascending: orderBy.ascending ?? false });
        }
        const { data, error } = await query;
        if (error) {
          console.warn(`LiveModule[${table}]:`, error.message);
          return [] as Row[]; // Return empty instead of throwing — prevents error boundary triggers
        }
        return (data ?? []) as Row[];
      } catch {
        return [] as Row[]; // Table may not exist, gracefully return empty
      }
    },
  });

  // Realtime subscription for this table (RLS filters what the user sees).
  // ⚠️ Crash-proof: entire subscription is wrapped in try-catch so a missing
  //    table (e.g. not yet migrated) never triggers the error boundary.
  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`live-${table}-${companyId}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => {
          try {
            if (!cancelled) {
              qc.invalidateQueries({ queryKey: [table] });
            }
          } catch {
            // Silently ignore invalidation errors
          }
        })
        .subscribe();
    } catch {
      // Silently ignore — table may not exist yet; queries work without realtime
    }
    return () => {
      cancelled = true;
      if (channel) {
        try { void supabase.removeChannel(channel); } catch { /* ignore */ }
      }
    };
  }, [table, companyId, qc]);

  const rows = data ?? [];
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const needle = q.toLowerCase();
    return rows.filter(r =>
      Object.values(r).some(v => v != null && String(v).toLowerCase().includes(needle))
    );
  }, [rows, q]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const statuses = rows
      .map(r => (r["status"] ?? r["result"]) as string | undefined)
      .filter(Boolean) as string[];
    const grouped = statuses.reduce<Record<string, number>>((acc, s) => {
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    }, {});
    const top = Object.entries(grouped).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { total, top };
  }, [rows]);

  // Auto-generate form fields from columns
  const formFields = useMemo(() => {
    const fields: { key: string; label: string; type: string; placeholder: string }[] = [];
    // Use titleField as primary field
    if (titleField) {
      fields.push({ key: titleField, label: titleField.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), type: "text", placeholder: `Enter ${titleField.replace(/_/g, " ")}` });
    }
    // Add status if it exists in columns
    if (columns.some(c => c.key === "status")) {
      fields.push({ key: "status", label: "Status", type: "select", placeholder: "Select status" });
    }
    // Add priority if it exists
    if (columns.some(c => c.key === "priority")) {
      fields.push({ key: "priority", label: "Priority", type: "select", placeholder: "Select priority" });
    }
    return fields;
  }, [columns, titleField]);

  function openNew() {
    const defaults: Record<string, string> = {};
    if (titleField) defaults[titleField] = "";
    if (columns.some(c => c.key === "status")) defaults.status = "pending";
    if (columns.some(c => c.key === "priority")) defaults.priority = "medium";
    setFormData(defaults);
    setShowNew(true);
  }

  async function handleCreate() {
    if (!companyId) return;
    const nowNum = Date.now().toString().slice(-6);
    const row: Record<string, unknown> = { company_id: companyId, ...(createDefaults ?? {}) };

    // Apply form data
    for (const [k, v] of Object.entries(formData)) {
      if (v !== "") row[k] = v;
    }

    // Auto-fill title/subject if needed
    const label = titleField ? String(row[titleField] ?? "") : "";
    if (columns.some(c => c.key === "title") && !row["title"]) row["title"] = label || `${singular} ${nowNum}`;
    if (columns.some(c => c.key === "subject") && !row["subject"]) row["subject"] = label || `${singular} ${nowNum}`;

    // Auto-fill common number fields for uniqueness
    for (const k of ["so_number","po_number","wo_number","invoice_number","payment_number","shipment_number","ticket_number","order_number","inspection_number","employee_code","count_number"]) {
      if (columns.some(c => c.key === k) && !(k in row)) row[k] = `${k.split("_")[0].toUpperCase()}-${nowNum}`;
    }

    const { error } = await supabase.from(table as never).insert(row as never);
    if (error) { toast.error(error.message); return; }
    toast.success(`${singular} created`);
    setShowNew(false);
    void refetch();
  }

  async function handleDelete(id: string) {
    if (!confirm(`Delete this ${singular.toLowerCase()}?`)) return;
    const { error } = await supabase.from(table as never).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    void refetch();
  }

  function handleExport() {
    const csv = toCsv(filtered, columns);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${table}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported to CSV");
  }

  function handleAiSummary() {
    const parts = [
      `${kpis.total} ${title.toLowerCase()} in view.`,
      kpis.top.length ? "Top statuses: " + kpis.top.map(([s, n]) => `${s} (${n})`).join(", ") + "." : "",
      "Copilot is monitoring realtime updates from related modules.",
    ].filter(Boolean).join(" ");
    toast(parts, { icon: "✨", duration: 6000 });
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName={title.toLowerCase().replace(/\s+/g, "-")} />
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        sub={sub}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ModuleCopilot moduleName={title.toLowerCase().replace(/\s+/g, "-")} />
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={handleAiSummary}>
              <Sparkles className="h-4 w-4 mr-1" /> AI summary
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Export</span>
            </Button>
            <Button variant="outline" size="sm" className="hidden md:inline-flex" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              <span className="hidden lg:inline">Refresh</span>
            </Button>
            {userCanCreate && !isReadOnly && (
              <Button size="sm" className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={openNew}>
                <Plus className="h-4 w-4 mr-1" />New
              </Button>
            )}
          </div>
        }
      />

      {/* New Record Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-[480px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>New {singular}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {formFields.map(field => (
              <div key={field.key} className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{field.label}</Label>
                {field.type === "select" ? (
                  <select
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={formData[field.key] ?? ""}
                    onChange={e => setFormData(d => ({ ...d, [field.key]: e.target.value }))}
                  >
                    {field.key === "status" && (
                      <>
                        <option value="pending">Pending</option>
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="in_progress">In Progress</option>
                        <option value="approved">Approved</option>
                        <option value="rejected">Rejected</option>
                      </>
                    )}
                    {field.key === "priority" && (
                      <>
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="critical">Critical</option>
                      </>
                    )}
                  </select>
                ) : (
                  <Input
                    type={field.type}
                    value={formData[field.key] ?? ""}
                    onChange={e => setFormData(d => ({ ...d, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="h-9"
                  />
                )}
              </div>
            ))}
            {formFields.length === 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Name / Reference</Label>
                <Input
                  value={formData._name ?? ""}
                  onChange={e => setFormData(d => ({ ...d, _name: e.target.value }))}
                  placeholder={`Enter ${singular.toLowerCase()} name`}
                  className="h-9"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancel</Button>
            <Button className="bg-[image:var(--gradient-primary)]" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1.5" />Create {singular}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Kpi label={`Total ${title.toLowerCase()}`} value={kpis.total.toLocaleString()} />
        <Kpi label="Top status" value={kpis.top[0] ? `${kpis.top[0][0]} (${kpis.top[0][1]})` : "—"} />
        <Kpi label="Company scope" value="RLS on" />
      </div>

      <Panel
        title={`${title} records`}
        right={
          <div className="relative w-72 max-w-full">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search…"
              className="h-8 pl-7 text-xs"
            />
          </div>
        }
      >
        {isLoading ? (
          <div className="py-16 flex items-center justify-center text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={`No ${title.toLowerCase()} yet`}
            sub={userCanCreate ? `Click "New" to create your first ${singular.toLowerCase()}. Records are scoped to your company via RLS.` : `Records will appear here as they are created by authorized roles.`}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                  {columns.map(c => (
                    <th key={c.key} className="px-3 py-2 font-medium">{c.label}</th>
                  ))}
                  <th className="px-3 py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r, i) => (
                  <motion.tr
                    key={r.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.015, 0.4) }}
                    className="border-b border-border/40 hover:bg-muted/30"
                  >
                    {columns.map(c => (
                      <td key={c.key} className="px-3 py-2.5 align-middle whitespace-nowrap">
                        {c.kind === "status" || c.kind === "badge"
                          ? <StatusBadge status={fmt("text", r[c.key])} />
                          : <span className={c.kind === "currency" || c.kind === "number" ? "tabular-nums" : ""}>
                              {fmt(c.kind, r[c.key])}
                            </span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      {userCanCreate && !isReadOnly && (
                        <button
                          onClick={() => handleDelete(r.id)}
                          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
