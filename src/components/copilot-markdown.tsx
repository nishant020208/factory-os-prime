import React, { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Link } from "@tanstack/react-router";

/* ─────────────────────────────────────────────────────────────
   STATUS CLASSIFICATION
   ───────────────────────────────────────────────────────────── */

const POSITIVE_STATUSES = new Set([
  "pass", "passed", "success", "completed", "approved", "active",
  "operational", "received", "accepted", "delivered", "fulfilled",
  "closed", "healthy", "ok", "good", "resolved",
]);

const NEGATIVE_STATUSES = new Set([
  "fail", "failed", "rejected", "critical", "overdue", "blocked",
  "down", "inactive", "revoked", "cancelled", "error", "defective",
  "expired", "declined", "denied",
]);

const WARNING_STATUSES = new Set([
  "pending", "in progress", "processing", "warning", "maintenance",
  "draft", "planned", "on hold", "awaiting", "partial", "scheduled",
]);

function classifyStatus(value: string): "positive" | "negative" | "warning" | null {
  const v = value.toLowerCase().trim();
  if (POSITIVE_STATUSES.has(v)) return "positive";
  if (NEGATIVE_STATUSES.has(v)) return "negative";
  if (WARNING_STATUSES.has(v)) return "warning";
  return null;
}

function StatusBadgeInline({ value }: { value: string }) {
  const cls = classifyStatus(value);
  const variant =
    cls === "positive"
      ? "bg-success/15 text-success border-success/30"
      : cls === "negative"
        ? "bg-destructive/15 text-destructive border-destructive/30"
        : cls === "warning"
          ? "bg-warning/15 text-warning border-warning/30"
          : "bg-muted text-muted-foreground border-white/10";

  return (
    <Badge variant="outline" className={`text-[10px] font-medium capitalize whitespace-nowrap ${variant}`}>
      {value.trim()}
    </Badge>
  );
}

/* ─────────────────────────────────────────────────────────────
   NUMERIC COLUMN DETECTION
   ───────────────────────────────────────────────────────────── */

const NUMERIC_KEYWORDS = new Set([
  "quantity", "qty", "stock", "defects", "price", "amount", "score",
  "percentage", "days", "cost", "total", "value", "available",
  "required", "shortage", "on-hand", "reserved", "quarantined",
  "damaged", "reorder", "unit cost", "unit price", "balance",
  "progress", "rating", "cycle", "cycles", "load", "capacity",
  "utilization", "defect rate", "pass rate", "yield", "age",
  "count", "total", "sum", "avg", "average", "min", "max",
]);

function isNumericColumn(header: string): boolean {
  const h = header.toLowerCase().trim();
  return NUMERIC_KEYWORDS.has(h) || /\b(count|num|rate|qty|price|cost|amount|value|total|balance|score|days|age|load|capacity|util)\b/.test(h);
}

/* ─────────────────────────────────────────────────────────────
   FACTORYOS RECORD LINK DETECTION
   ───────────────────────────────────────────────────────────── */

const RECORD_PATTERNS: Array<{ regex: RegExp; route: string }> = [
  { regex: /\b(SO-\d+)\b/i, route: "/sales-orders" },
  { regex: /\b(PO-\d+)\b/i, route: "/purchase-orders" },
  { regex: /\b(WO-\d+)\b/i, route: "/work-orders" },
  { regex: /\b(GRN-\d+)\b/i, route: "/goods-receipt" },
  { regex: /\b(INV-\d+)\b/i, route: "/inventory" },
  { regex: /\b(PR-\d+)\b/i, route: "/procurement" },
  { regex: /\b(RFQ-\d+)\b/i, route: "/procurement" },
  { regex: /\b(QC-\d+)\b/i, route: "/quality" },
  { regex: /\b(QI-\d+)\b/i, route: "/quality" },
  { regex: /\b(NCR-\d+)\b/i, route: "/defects" },
  { regex: /\b(CAPA-\d+)\b/i, route: "/defects" },
  { regex: /\b(EMP-\d+)\b/i, route: "/people" },
  { regex: /\b(TKT-\d+)\b/i, route: "/support" },
  { regex: /\b(PRD-\d+)\b/i, route: "/production-planning" },
  { regex: /\b(SHP-\d+)\b/i, route: "/dispatch" },
  { regex: /\b(INV\d{4,})\b/i, route: "/invoices" },
  { regex: /\b(PROD-\d+)\b/i, route: "/production-planning" },
];

function detectRecordLink(text: string): React.ReactNode {
  const trimmed = text.trim();

  for (const { regex, route } of RECORD_PATTERNS) {
    const m = trimmed.match(new RegExp(`^${regex.source}$`, "i"));
    if (m) {
      return (
        <Link
          to={route}
          className="text-primary hover:underline font-mono text-[11px] font-medium"
        >
          {trimmed}
        </Link>
      );
    }
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────
   MARKDOWN TABLE PARSER
   ───────────────────────────────────────────────────────────── */

interface ParsedTable {
  headers: string[];
  alignments: ("left" | "right" | "center")[];
  rows: string[][];
}

function parseMarkdownTable(block: string): ParsedTable | null {
  const lines = block.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return null;

  const parseCells = (line: string): string[] =>
    line
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const headers = parseCells(lines[0]);
  if (headers.length === 0) return null;

  // Validate separator row
  const sepCells = parseCells(lines[1]);
  const isSep = sepCells.every((c) => /^[-:]+$/.test(c));
  if (!isSep) return null;

  // Parse alignments from separator
  const alignments = sepCells.map((c): "left" | "right" | "center" => {
    if (c.endsWith(":") && c.startsWith(":")) return "center";
    if (c.endsWith(":")) return "right";
    return "left";
  });

  // Pad alignments to header count
  while (alignments.length < headers.length) alignments.push("left");

  const rows: string[][] = [];
  for (let i = 2; i < lines.length; i++) {
    const cells = parseCells(lines[i]);
    // Pad or truncate to match header count
    while (cells.length < headers.length) cells.push("");
    if (cells.length > headers.length) cells.length = headers.length;
    rows.push(cells);
  }

  if (rows.length === 0) return null;

  return { headers, alignments, rows };
}

/* ─────────────────────────────────────────────────────────────
   COPILLOTABLE COMPONENT
   ───────────────────────────────────────────────────────────── */

export function CopilotTable({ table }: { table: ParsedTable }) {
  const { headers, alignments, rows } = table;

  return (
    <div className="my-3 overflow-x-auto rounded-lg border border-white/10 bg-card/50">
      <table className="w-full text-xs border-collapse">
        <thead>
          <tr className="border-b border-white/10 bg-muted/30">
            {headers.map((h, i) => (
              <th
                key={i}
                className="px-3 py-2 font-semibold text-left text-foreground whitespace-nowrap"
                style={{ textAlign: alignments[i] === "right" ? "right" : alignments[i] === "center" ? "center" : "left" }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr
              key={ri}
              className="border-b border-white/5 last:border-0 hover:bg-muted/20 transition-colors"
            >
              {row.map((cell, ci) => {
                const isNumeric = isNumericColumn(headers[ci] ?? "");
                const align = alignments[ci];

                return (
                  <td
                    key={ci}
                    className="px-3 py-2 text-muted-foreground whitespace-nowrap"
                    style={{
                      textAlign: align === "right" || isNumeric ? "right" : align === "center" ? "center" : "left",
                      fontVariantNumeric: isNumeric ? "tabular-nums" : undefined,
                    }}
                  >
                    {renderCellContent(cell)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   CELL CONTENT RENDERER
   ───────────────────────────────────────────────────────────── */

function renderCellContent(text: string): React.ReactNode {
  const trimmed = text.trim();

  // Check for FactoryOS record links
  const link = detectRecordLink(trimmed);
  if (link) return link;

  // Check for status-like values
  if (classifyStatus(trimmed)) {
    return <StatusBadgeInline value={trimmed} />;
  }

  // Check for emoji-prefixed statuses like "✅ Passed"
  const emojiStatusMatch = trimmed.match(/^([✅❌⚠️🔴🟢🟡🔵]\s*)(.+)$/);
  if (emojiStatusMatch) {
    const emoji = emojiStatusMatch[1];
    const status = emojiStatusMatch[2];
    if (classifyStatus(status)) {
      return (
        <span className="inline-flex items-center gap-1">
          <span>{emoji}</span>
          <StatusBadgeInline value={status} />
        </span>
      );
    }
  }

  // Render inline formatting and return as text
  return <span>{renderInlineFormatting(trimmed)}</span>;
}

/* ─────────────────────────────────────────────────────────────
   INLINE FORMATTING
   ───────────────────────────────────────────────────────────── */

function renderInlineFormatting(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  // Split on **bold**, `code`, and [links](url)
  const regex = /(\*\*(.+?)\*\*|`(.+?)`|\[([^\]]+)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[2]}</strong>);
    } else if (match[3]) {
      parts.push(
        <code key={match.index} className="bg-muted px-1.5 py-0.5 rounded text-[11px] font-mono">
          {match[3]}
        </code>,
      );
    } else if (match[4] && match[5]) {
      parts.push(
        <a
          key={match.index}
          href={match[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {match[4]}
        </a>,
      );
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/* ─────────────────────────────────────────────────────────────
   MAIN MARKDOWN RENDERER
   ───────────────────────────────────────────────────────────── */

export function CopilotMarkdown({ text }: { text: string }): React.ReactNode {
  const nodes = useMemo(() => parseMarkdownToNodes(text), [text]);

  return (
    <div className="text-sm leading-relaxed space-y-2">
      {nodes.map((node, i) => {
        switch (node.type) {
          case "heading":
            return (
              <h3 key={i} className="text-base font-semibold text-foreground mt-3 mb-1">
                {node.content}
              </h3>
            );
          case "subheading":
            return (
              <h4 key={i} className="text-sm font-semibold text-foreground mt-2 mb-1">
                {node.content}
              </h4>
            );
          case "table":
            return <CopilotTable key={i} table={node.table!} />;
          case "bullet-list":
            return (
              <ul key={i} className="list-none space-y-1 my-2">
                {node.items!.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-primary mt-0.5 shrink-0">•</span>
                    <span>{renderInlineFormatting(item)}</span>
                  </li>
                ))}
              </ul>
            );
          case "numbered-list":
            return (
              <ol key={i} className="list-none space-y-1 my-2 counter-reset-copilot">
                {node.items!.map((item, j) => (
                  <li key={j} className="flex items-start gap-2 text-muted-foreground">
                    <span className="text-primary font-mono text-[11px] mt-0.5 shrink-0 w-4 text-right">
                      {j + 1}.
                    </span>
                    <span>{renderInlineFormatting(item)}</span>
                  </li>
                ))}
              </ol>
            );
          case "code-block":
            return (
              <pre key={i} className="bg-muted/50 border border-white/10 rounded-lg p-3 overflow-x-auto text-xs font-mono text-muted-foreground my-2">
                <code>{node.content}</code>
              </pre>
            );
          case "horizontal-rule":
            return <hr key={i} className="border-white/10 my-3" />;
          case "blockquote":
            return (
              <blockquote
                key={i}
                className="border-l-2 border-primary/40 pl-3 py-1 text-muted-foreground italic my-2"
              >
                {renderInlineFormatting(node.content!)}
              </blockquote>
            );
          case "paragraph":
          default:
            return (
              <p key={i} className="text-muted-foreground my-1.5">
                {node.content ? renderInlineFormatting(node.content) : null}
              </p>
            );
        }
      })}
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   MARKDOWN PARSER — splits text into typed nodes
   ───────────────────────────────────────────────────────────── */

interface MdNode {
  type: "paragraph" | "heading" | "subheading" | "table" | "bullet-list" | "numbered-list" | "code-block" | "blockquote" | "horizontal-rule";
  content?: string;
  items?: string[];
  table?: ParsedTable;
}

function parseMarkdownToNodes(text: string): MdNode[] {
  const nodes: MdNode[] = [];
  // Split into blocks by double newline or block boundaries
  const blocks = text.split(/\n{2,}/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Heading (### or ##)
    if (/^#{3,}\s+/.test(trimmed)) {
      nodes.push({ type: "heading", content: trimmed.replace(/^#{3,}\s+/, "") });
      continue;
    }
    // Subheading (##)
    if (/^##\s+/.test(trimmed)) {
      nodes.push({ type: "subheading", content: trimmed.replace(/^##\s+/, "") });
      continue;
    }
    // Heading (#)
    if (/^#\s+/.test(trimmed)) {
      nodes.push({ type: "heading", content: trimmed.replace(/^#\s+/, "") });
      continue;
    }

    // Horizontal rule
    if (/^[-*_]{3,}\s*$/.test(trimmed)) {
      nodes.push({ type: "horizontal-rule" });
      continue;
    }

    // Code block
    if (/^```/.test(trimmed)) {
      const code = trimmed.replace(/^```\w*\n?/, "").replace(/\n?```$/, "");
      nodes.push({ type: "code-block", content: code });
      continue;
    }

    // Blockquote
    if (/^>\s+/.test(trimmed)) {
      nodes.push({ type: "blockquote", content: trimmed.replace(/^>\s+/, "") });
      continue;
    }

    // Table — detect pipe-delimited with separator row
    const lines = trimmed.split("\n");
    const looksLikeTable = lines.length >= 2 && lines.some((l) => /^\|?[\s:-]+\|/.test(l));
    if (looksLikeTable) {
      const table = parseMarkdownTable(trimmed);
      if (table) {
        nodes.push({ type: "table", table });
        continue;
      }
    }

    // Bullet list (all lines start with • or -)
    const bulletLines = trimmed.split("\n");
    if (bulletLines.every((l) => /^[•*-]\s+/.test(l.trim()))) {
      nodes.push({
        type: "bullet-list",
        items: bulletLines.map((l) => l.trim().replace(/^[•*-]\s+/, "")),
      });
      continue;
    }

    // Numbered list (all lines start with digits + dot)
    if (bulletLines.every((l) => /^\d+[.)]\s+/.test(l.trim()))) {
      nodes.push({
        type: "numbered-list",
        items: bulletLines.map((l) => l.trim().replace(/^\d+[.)]\s+/, "")),
      });
      continue;
    }

    // Paragraph (contains inline newlines — preserve as single block)
    nodes.push({ type: "paragraph", content: trimmed.replace(/\n/g, " ") });
  }

  return nodes;
}
