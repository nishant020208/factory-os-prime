import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download, Loader2, Plus, RefreshCw, Search, Trash2, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, Panel, Kpi, StatusBadge, EmptyState } from "@/components/ui-parts";
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

export function LiveModule({ config }: { config: ModuleConfig }) {
  const {
    table, title, eyebrow, sub, columns, filter, orderBy,
    createDefaults, titleField, singular = "Record",
  } = config;

  const { companyId } = useAuth();
  const qc = useQueryClient();
  const [q, setQ] = useState("");

  const queryKey = useMemo(
    () => [table, companyId, filter ?? null, orderBy ?? null] as const,
    [table, companyId, filter, orderBy],
  );

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    enabled: !!companyId,
    queryFn: async () => {
      let query = supabase.from(table as never).select("*").limit(500);
      if (filter) {
        for (const [k, v] of Object.entries(filter)) query = (query as never as ReturnType<typeof query.eq>).eq(k, v);
      }
      if (orderBy) {
        query = (query as never as ReturnType<typeof query.order>).order(orderBy.column, { ascending: orderBy.ascending ?? false });
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  // Realtime subscription for this table (RLS filters what the user sees).
  useEffect(() => {
    if (!companyId) return;
    const channel = supabase
      .channel(`live-${table}-${companyId}`)
      .on("postgres_changes", { event: "*", schema: "public", table }, () => {
        qc.invalidateQueries({ queryKey: [table] });
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
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

  async function handleCreate() {
    if (!companyId) return;
    const label = window.prompt(`New ${singular} — enter a name/reference`);
    if (!label) return;
    const nowNum = Date.now().toString().slice(-6);
    const row: Record<string, unknown> = { company_id: companyId, ...(createDefaults ?? {}) };
    if (titleField) row[titleField] = label;
    // Common number fields we auto-fill so uniqueness holds:
    for (const k of ["so_number","po_number","wo_number","invoice_number","payment_number","shipment_number","ticket_number","order_number","inspection_number","employee_code"]) {
      if (columns.some(c => c.key === k) && !(k in row)) row[k] = `${k.split("_")[0].toUpperCase()}-${nowNum}`;
    }
    if (columns.some(c => c.key === "title") && !row["title"]) row["title"] = label;
    if (columns.some(c => c.key === "subject") && !row["subject"]) row["subject"] = label;

    const { error } = await supabase.from(table as never).insert(row as never);
    if (error) { toast.error(error.message); return; }
    toast.success(`${singular} created`);
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
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        sub={sub}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleAiSummary}>
              <Sparkles className="h-4 w-4 mr-1" /> AI summary
            </Button>
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="h-4 w-4 mr-1" /> Export
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              {isFetching ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Refresh
            </Button>
            <Button size="sm" className="bg-[image:var(--gradient-primary)] shadow-glow" onClick={handleCreate}>
              <Plus className="h-4 w-4 mr-1" /> New
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Kpi label={`Total ${title.toLowerCase()}`} value={kpis.total.toLocaleString()} />
        <Kpi label="Top status" value={kpis.top[0]?.[0] ?? "—"} sub={kpis.top[0] ? `${kpis.top[0][1]} record(s)` : "no status field"} />
        <Kpi label="Company scope" value="RLS on" sub="Company-isolated via row-level security" />
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
            body={`Click "New" to create your first ${singular.toLowerCase()}. Records are scoped to your company via RLS.`}
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
                          ? <StatusBadge value={fmt("text", r[c.key])} />
                          : <span className={c.kind === "currency" || c.kind === "number" ? "tabular-nums" : ""}>
                              {fmt(c.kind, r[c.key])}
                            </span>}
                      </td>
                    ))}
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
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
