import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { currencySymbol, getAppCurrency } from "@/lib/currency";

/** Current date as YYYY-MM-DD, used in download filenames. */
export function todayStamp(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "report"
  );
}

function stringify(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function csvEscape(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export interface Column {
  key: string;
  label: string;
  align?: "left" | "right";
}

/**
 * Download a CSV file with the exact rows currently rendered on screen.
 * The caller passes the same `rows` used to render the table, so the
 * exported file can never drift from what the user sees.
 */
export function downloadCsv(
  baseName: string,
  columns: Column[],
  rows: Record<string, unknown>[],
): void {
  const head = columns.map((c) => csvEscape(c.label));
  const body = rows.map((r) =>
    columns.map((c) => csvEscape(stringify(r[c.key]))).join(","),
  );
  const csv = "\uFEFF" + head.join(",") + "\n" + body.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(baseName)}-${todayStamp()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Download a formatted PDF (GST summaries, certificates, etc.) built from
 * the exact rows currently shown on screen.
 */
export function downloadPdf(
  baseName: string,
  opts: {
    title: string;
    sub?: string;
    meta?: [string, string][];
    columns: string[];
    rows: (string | number)[][];
    footer?: string;
  },
): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header band
  doc.setFillColor(24, 24, 27);
  doc.rect(0, 0, pageW, 64, "F");
  doc.setTextColor(251, 191, 36);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(opts.title, 40, 28);
  doc.setTextColor(212, 212, 216);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (opts.sub) doc.text(opts.sub, 40, 44);

  let y = 84;
  if (opts.meta && opts.meta.length) {
    doc.setTextColor(113, 113, 122);
    doc.setFontSize(8.5);
    opts.meta.forEach(([k, v], i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      doc.text(`${k}: ${v}`, 40 + col * (pageW / 2 - 60), y + row * 14);
    });
    y += Math.ceil(opts.meta.length / 2) * 14 + 12;
  }

  autoTable(doc, {
    head: [opts.columns],
    body: opts.rows.map((r) => r.map(String)),
    startY: y,
    styles: { fontSize: 8, cellPadding: 5 },
    headStyles: { fillColor: [41, 37, 36], textColor: [251, 191, 36], fontStyle: "bold" },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    margin: { left: 40, right: 40 },
  });

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setTextColor(161, 161, 170);
    doc.setFontSize(7.5);
    doc.text(
      `${opts.footer ?? "FactoryOS AI"} — generated ${new Date().toLocaleString()}`,
      40,
      doc.internal.pageSize.getHeight() - 24,
    );
    doc.text(`Page ${i} of ${pages}`, pageW - 40, doc.internal.pageSize.getHeight() - 24, {
      align: "right",
    });
  }

  doc.save(`${slugify(baseName)}-${todayStamp()}.pdf`);
}

/* ---------------- formatting helpers ---------------- */

/**
 * Format an amount in the company's current currency (read from the shared
 * app-wide registry). Pass an explicit `currency` only for historical records
 * that carry their own transaction currency.
 */
export function money(v: unknown, currency?: string): string {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  const code = currency || getAppCurrency();
  const symbol = currencySymbol(code);
  const locale = code === "INR" ? "en-IN" : "en-US";
  return `${symbol}${n.toLocaleString(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  })}`;
}

export function num(v: unknown): string {
  const n = Number(v);
  if (!isFinite(n)) return "—";
  return n.toLocaleString("en-IN");
}

export function pct(part: number, whole: number): string {
  if (!whole) return "0%";
  return `${((part / whole) * 100).toFixed(1)}%`;
}

export function fmtDate(v: unknown): string {
  if (!v) return "—";
  const d = new Date(String(v));
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString();
}

/** Group rows by a key and count them. Returns sorted-by-count desc list. */
export function countBy<T extends Record<string, unknown>>(
  rows: T[],
  key: string,
): { value: string; count: number }[] {
  const map = new Map<string, number>();
  for (const r of rows) {
    const k = String(r[key] ?? "—") || "—";
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => b.count - a.count);
}

/** Sum a numeric field across rows. */
export function sumBy<T extends Record<string, unknown>>(rows: T[], key: string): number {
  return rows.reduce((acc, r) => acc + (Number(r[key]) || 0), 0);
}

/** Average a numeric field across rows. */
export function avgBy<T extends Record<string, unknown>>(rows: T[], key: string): number {
  if (!rows.length) return 0;
  return sumBy(rows, key) / rows.length;
}
