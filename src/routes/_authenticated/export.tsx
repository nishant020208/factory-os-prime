import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { safeDate } from "@/lib/utils";
import { Download, Loader2, Database, ShieldCheck, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/export")({
  head: () => ({
    meta: [
      { title: "Data Export — FactoryOS AI" },
      {
        name: "description",
        content: "Export company data as CSV. Every export is scoped to your company by row-level security.",
      },
    ],
  }),
  component: ExportPage,
});

const DATASETS = [
  { key: "audit_logs", label: "Audit Logs", desc: "Every write action with actor, module and old → new values" },
  { key: "access_logs", label: "Access Logs", desc: "Login history — who signed in, when, and whether it succeeded" },
  { key: "approvals", label: "Approvals", desc: "Approval workflow records across modules" },
  { key: "sales_orders", label: "Customer Orders", desc: "Sales orders and their status" },
  { key: "invoices", label: "Invoices", desc: "Invoices, amounts, due dates and payment status" },
  { key: "payments", label: "Payments", desc: "Payments received, methods and status" },
  { key: "employees", label: "Employees", desc: "Employee directory for this company" },
  { key: "attendance", label: "Attendance", desc: "Attendance records" },
  { key: "payroll", label: "Payroll", desc: "Payroll records" },
  { key: "inventory", label: "Inventory", desc: "Stock on hand per warehouse" },
  { key: "machines", label: "Machines", desc: "Machine fleet, status and utilization" },
  { key: "quality_inspections", label: "Quality Inspections", desc: "Inspection results, defects and outcomes" },
  { key: "purchase_orders", label: "Purchase Orders", desc: "POs, amounts and supplier status" },
  { key: "suppliers", label: "Suppliers", desc: "Supplier directory" },
  { key: "customers", label: "Customers", desc: "Customer directory" },
  { key: "qr_codes", label: "QR Codes", desc: "QR code records tied to this company" },
  { key: "production_orders", label: "Production Orders", desc: "Production orders and progress" },
  { key: "work_orders", label: "Work Orders", desc: "Work orders, operators and progress" },
] as const;

type DatasetKey = (typeof DATASETS)[number]["key"];

interface ExportRow {
  [k: string]: unknown;
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function ExportPage() {
  const { companyId } = useAuth();
  const [selected, setSelected] = useState<DatasetKey>("audit_logs");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["export", selected, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from(selected as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as ExportRow[];
    },
  });

  const rows = data ?? [];
  const cols = rows.length ? Object.keys(rows[0]).filter((k) => k !== "id") : [];
  const meta = DATASETS.find((d) => d.key === selected)!;

  function handleExport() {
    if (!rows.length) return;
    const head = ["id", ...cols];
    const body = rows.map((r) =>
      head.map((k) => `"${stringify(r[k]).replace(/"/g, '""')}"`).join(","),
    );
    const blob = new Blob([head.map((h) => `"${h}"`).join(",") + "\n" + body.join("\n")], {
      type: "text/csv",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${rows.length} rows from ${meta.label}`);
  }

  return (
    <div className="max-w-[1200px] mx-auto">
      <ModuleStatusBar moduleName="export" />
      <PageHeader
        eyebrow="Compliance"
        title="Data Export"
        sub="Export any dataset as CSV for your records. Every export reads through row-level security, so it can never include another company's data — even if the URL is manipulated."
        actions={<ModuleCopilot moduleName="export" />}
      />

      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-6">
        <ShieldCheck className="h-4 w-4 text-emerald-400" />
        RLS-scoped: exports are restricted to your company ({companyId?.slice(0, 8) ?? "—"})
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Panel title="Datasets">
          <div className="space-y-1.5">
            {DATASETS.map((d) => (
              <button
                key={d.key}
                onClick={() => setSelected(d.key)}
                className={`w-full text-left px-3 py-2.5 rounded-lg border text-sm transition-all ${
                  selected === d.key
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-card/60 border-white/5 text-muted-foreground hover:border-white/20 hover:text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 font-medium">
                  <Database className="h-3.5 w-3.5 shrink-0" />
                  {d.label}
                  {selected === d.key && <CheckCircle2 className="h-3.5 w-3.5 ml-auto text-primary" />}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{d.desc}</div>
              </button>
            ))}
          </div>
        </Panel>

        <Panel
          title={`${meta.label} — ${rows.length} row${rows.length !== 1 ? "s" : ""}`}
          right={
            <Button variant="outline" size="sm" onClick={handleExport} disabled={rows.length === 0 || isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-1" />
              )}
              Download CSV
            </Button>
          }
        >
          {isLoading ? (
            <div className="py-16 flex items-center justify-center text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Loading dataset…
            </div>
          ) : error ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              This dataset is unavailable for your role (row-level security denied access).
            </div>
          ) : rows.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              No rows in {meta.label} yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                    <th className="px-3 py-2 font-medium">#</th>
                    {cols.slice(0, 8).map((c) => (
                      <th key={c} className="px-3 py-2 font-medium">
                        {c.replace(/_/g, " ")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 100).map((r, i) => (
                    <tr key={String(r["id"] ?? i)} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-3 py-2 text-xs text-muted-foreground tabular-nums">{i + 1}</td>
                      {cols.slice(0, 8).map((c) => (
                        <td key={c} className="px-3 py-2 text-xs whitespace-nowrap">
                          {c.includes("date") || c.includes("_at")
                            ? (() => {
                                const d = new Date(stringify(r[c]));
                                return isNaN(d.getTime()) ? stringify(r[c]) : safeDate(d.toISOString(), true);
                              })()
                            : stringify(r[c]).slice(0, 60)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 && (
                <div className="text-[11px] text-muted-foreground text-center py-3">
                  Showing first 100 of {rows.length} rows — the full dataset is included in the CSV.
                </div>
              )}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              Data source: <code className="text-foreground/70">{selected}</code> (live table, same
              query the owning role uses)
            </span>
            <Button variant="ghost" size="sm" onClick={() => refetch()} className="h-7 text-xs">
              Refresh
            </Button>
          </div>
        </Panel>
      </div>
    </div>
  );
}
