import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  BrainCircuit,
  Sparkles,
  Loader2,
  Send,
  Radar,
  ScanLine,
  GaugeCircle,
  LineChart,
  Layers,
  MessageCircle,
} from "lucide-react";
import { PageHeader, Panel } from "@/components/ui-parts";
import { ModuleStatusBar, ModuleCopilot } from "@/components/module-status";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { primaryRole } from "@/lib/route-access";
import {
  checkRoleScope,
  getBlockMessage,
  getAllowedLabels,
  DOMAIN_LABELS,
  ROLE_DOMAIN_MAP,
} from "@/lib/role-scope";
import { answerCopilot, answerCopilotStream } from "@/lib/copilot-engine";
import { checkCopilotProviderHealth } from "@/lib/copilot-llm.server";

/** Simple markdown-to-HTML renderer for copilot responses */
function renderMarkdown(text: string): React.ReactNode {
  const paragraphs = text.split(/\n\n+/);
  return (
    <>
      {paragraphs.map((para, i) => {
        // Check for markdown table
        const tableMatch = para.match(/^(\|.+\|)\n\|[-| :]+\|(\n\|.+\|)+$/);
        if (tableMatch) {
          const rows = para.split("\n");
          const headers = rows[0]
            .split("|")
            .map((c) => c.trim())
            .filter(Boolean);
          const bodyRows = rows.slice(2).map((r) =>
            r
              .split("|")
              .map((c) => c.trim())
              .filter(Boolean),
          );
          return (
            <table key={i} className="w-full border-collapse mb-2 text-xs">
              <thead>
                <tr className="border-b-2 border-primary">
                  {headers.map((h, j) => (
                    <th
                      key={j}
                      className="border border-white/20 px-2 py-1 text-left font-medium text-primary"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bodyRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 0 ? "bg-white/5" : ""}>
                    {row.map((cell, ci) => (
                      <td
                        key={ci}
                        className="border border-white/10 px-2 py-1"
                        dangerouslySetInnerHTML={{ __html: formatInline(cell) }}
                      />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          );
        }
        // Check if it's a list (lines starting with • or -)
        const lines = para.split("\n");
        const isList = lines.every((l) => /^[•-]\s/.test(l.trim()));
        if (isList) {
          return (
            <ul key={i} className="list-none space-y-1 my-2">
              {lines.map((line, j) => (
                <li key={j} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span
                    dangerouslySetInnerHTML={{ __html: formatInline(line.replace(/^[•-]\s/, "")) }}
                  />
                </li>
              ))}
            </ul>
          );
        }
        // Regular paragraph
        return (
          <p key={i} className="my-2" dangerouslySetInnerHTML={{ __html: formatInline(para) }} />
        );
      })}
    </>
  );
}

/** Format inline markdown: **bold**, `code`, newlines */
function formatInline(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/`(.+?)`/g, '<code class="bg-muted px-1 rounded text-xs">$1</code>')
    .replace(/\n/g, "<br />");
}

const copilotPlaceholder: Record<string, string> = {
  root_super_admin: "Ask about companies, registrations, platform health…",
  company_admin: 'Ask Copilot — "show production", "approve orders", "staff count"…',
  plant_manager: 'Ask Copilot — "production schedule", "machine status", "daily report"…',
  plant_admin: 'Ask Copilot — "plant overview", "departments", "machines"…',
  production_manager: 'Ask Copilot — "production orders", "work orders", "BOM"…',
  production_operator: 'Ask Copilot — "my work orders", "machine status"…',
  warehouse_manager: 'Ask Copilot — "stock levels", "shipments", "low inventory"…',
  procurement_manager: 'Ask Copilot — "purchase orders", "suppliers", "RFQ"…',
  quality_inspector: 'Ask Copilot — "inspections", "defects", "CAPA"…',
  maintenance_engineer: 'Ask Copilot — "machine status", "maintenance tickets", "breakdowns"…',
  finance_manager: 'Ask Copilot — "invoices", "payments", "expenses"…',
  hr_manager: 'Ask Copilot — "employees", "attendance", "payroll"…',
  customer_portal: 'Ask Copilot — "my orders", "shipment status", "invoices"…',
  supplier_portal: 'Ask Copilot — "my POs", "deliveries", "payments"…',
  auditor: 'Ask Copilot — "audit logs", "compliance", "cross-module summary"…',
};

export const Route = createFileRoute("/_authenticated/ai-center")({
  head: () => ({
    meta: [
      { title: "AI Center — FactoryOS AI" },
      {
        name: "description",
        content:
          "Explainable AI across every module: Copilot, forecasting, defect prediction and executive summaries.",
      },
    ],
  }),
  component: AICenter,
});

const capabilities = [
  { icon: BrainCircuit, t: "AI Copilot", d: "Chat over your operational data with citations." },
  { icon: Radar, t: "Predictive Maintenance", d: "Anomaly detection on machine telemetry." },
  {
    icon: ScanLine,
    t: "AI Defect Detection",
    d: "Vision-ready inspection with confidence scores.",
  },
  { icon: GaugeCircle, t: "Factory Health Score", d: "A single number for your entire operation." },
  { icon: LineChart, t: "Demand Forecasting", d: "Statistical + ML forecasts feeding MRP." },
  { icon: Layers, t: "Scenario Simulator", d: "What-if analysis on cost, capacity and delivery." },
];

function AICenter() {
  const { roles, companyId, user } = useAuth();
  const role = primaryRole(roles);
  const allowedLabels = getAllowedLabels(role).join(", ");
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [groqStatus, setGroqStatus] = useState<{ connected: boolean; message: string }>({
    connected: false,
    message: "Checking...",
  });
  const [cerebrasStatus, setCerebrasStatus] = useState<{ connected: boolean; message: string }>({
    connected: false,
    message: "Checking...",
  });
  const groqReady = groqStatus.connected;
  const cerebrasReady = cerebrasStatus.connected;

  // Check provider health on mount
  useEffect(() => {
    checkCopilotProviderHealth().then((h) => {
      setGroqStatus(h.groq);
      setCerebrasStatus(h.cerebras);
    });
  }, []);
  const greetingMap: Record<string, string> = {
    root_super_admin: `Hi, I'm your **Platform Copilot** — powered by Groq AI. I can help with platform-wide data: companies, registrations, and platform health. What would you like to know?`,
    company_admin: `Hi, I'm your **Company Copilot** — powered by Groq AI. I have full cross-module visibility across your company: orders, production, inventory, quality, maintenance, finance, HR, suppliers and more. What would you like to check?`,
    production_manager: `Hi, I'm your **Production Copilot** — powered by Groq AI. I can help with production orders, work orders, BOM, machines, inventory and quality data. What do you need?`,
    warehouse_manager: `Hi, I'm your **Warehouse Copilot** — powered by Groq AI. I can help with inventory, stock levels, products, and dispatch/shipments. What's on your mind?`,
    quality_inspector: `Hi, I'm your **Quality Copilot** — powered by Groq AI. I can help with inspections, defects, CAPA, and quality parameters. What would you like to check?`,
    maintenance_engineer: `Hi, I'm your **Maintenance Copilot** — powered by Groq AI. I can help with machine status, maintenance tickets, breakdowns and spare parts. What do you need?`,
    finance_manager: `Hi, I'm your **Finance Copilot** — powered by Groq AI. I can help with invoices, payments, expenses, budgets and taxes. What would you like to know?`,
    hr_manager: `Hi, I'm your **HR Copilot** — powered by Groq AI. I can help with employees, attendance, leaves, payroll and training. What do you need?`,
    customer_portal: `Hi, I'm your **Customer Copilot** — powered by Groq AI. I can help with your orders, shipments, invoices and support tickets. What would you like to check?`,
    supplier_portal: `Hi, I'm your **Supplier Copilot** — powered by Groq AI. I can help with your purchase orders, deliveries, invoices and payments. What do you need?`,
  };
  const [msgs, setMsgs] = useState<{ role: "user" | "ai"; text: string; conf?: number }[]>([
    {
      role: "ai",
      text:
        greetingMap[role ?? ""] ??
        `Hi, I'm your FactoryOS Copilot — powered by Groq AI. I'm scoped to **${role?.replace(/_/g, " ")}** data. I can help you with: **${allowedLabels}**.`,
      conf: 100,
    },
  ]);

  function ask(e: React.FormEvent) {
    e.preventDefault();
    if (!q.trim()) return;
    const question = q.trim();
    const nextMsgs = [...msgs, { role: "user" as const, text: question }];
    setMsgs(nextMsgs);
    setQ("");
    setBusy(true);
    setStreaming(true);

    // Add a placeholder message that we'll update token-by-token
    const placeholderIdx = nextMsgs.length;
    setMsgs((m) => [...m, { role: "ai", text: "", conf: 0 }]);

    (async () => {
      const { text, conf } = await answerCopilotStream({
        question,
        role,
        companyId,
        userId: user?.id ?? null,
        history: msgs,
        onToken: (chunk) => {
          setMsgs((m) => {
            const updated = [...m];
            if (updated[placeholderIdx]) {
              updated[placeholderIdx] = {
                ...updated[placeholderIdx],
                text: updated[placeholderIdx].text + chunk,
              };
            }
            return updated;
          });
        },
      });
      setMsgs((m) => {
        const updated = [...m];
        if (updated[placeholderIdx]) {
          updated[placeholderIdx] = { role: "ai", text, conf };
        }
        return updated;
      });
      setBusy(false);
      setStreaming(false);
    })();
  }

  return (
    <div className="max-w-[1600px] mx-auto">
      <ModuleStatusBar moduleName="ai-center" />
      <PageHeader
        eyebrow="AI-native"
        title="AI Center"
        sub="Every AI capability across FactoryOS in one control plane."
        actions={<ModuleCopilot moduleName="ai-center" />}
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {capabilities.map((c, i) => (
          <motion.div
            key={c.t}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="glass rounded-2xl p-5 hover:border-primary/30 transition"
          >
            <div className="h-10 w-10 rounded-xl bg-primary/15 border border-primary/30 grid place-items-center">
              <c.icon className="h-5 w-5 text-primary" />
            </div>
            <div className="mt-3 font-medium">{c.t}</div>
            <div className="text-xs text-muted-foreground mt-1">{c.d}</div>
          </motion.div>
        ))}
      </div>

      <div className="mt-6">
        <Panel
          title="Copilot"
          right={
            <div className="flex items-center gap-3">
              <span
                className={`text-[10px] flex items-center gap-1 ${groqReady ? "text-green-400" : "text-yellow-400"}`}
                title={groqStatus.message}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${groqReady ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}
                />
                {groqReady ? "Groq Connected" : `Groq: ${groqStatus.message}`}
              </span>
              <span
                className={`text-[10px] flex items-center gap-1 ${cerebrasReady ? "text-green-400" : "text-yellow-400"}`}
                title={cerebrasStatus.message}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${cerebrasReady ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`}
                />
                {cerebrasReady ? "Cerebras Connected" : `Cerebras: ${cerebrasStatus.message}`}
              </span>
              {streaming && (
                <span className="text-[10px] text-primary flex items-center gap-1 animate-pulse">
                  <Sparkles className="h-3 w-3" /> Streaming...
                </span>
              )}
              <span className="text-[10px] text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Explainable AI
              </span>
            </div>
          }
        >
          <div className="h-80 overflow-y-auto space-y-3 pr-2">
            {msgs.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`max-w-2xl ${m.role === "user" ? "ml-auto" : ""}`}
              >
                <div
                  className={`rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "glass border-white/5"}`}
                >
                  <div className="flex items-center gap-1.5 text-[10px] mb-1 opacity-80">
                    {m.role === "user" ? (
                      <MessageCircle className="h-3 w-3" />
                    ) : (
                      <BrainCircuit className="h-3 w-3" />
                    )}
                    {m.role === "user" ? "You" : `Copilot${m.conf ? ` · ${m.conf}% conf.` : ""}`}
                  </div>
                  <div className="leading-relaxed">
                    {renderMarkdown(m.text)}
                    {streaming && i === msgs.length - 1 && m.role === "ai" && (
                      <span className="inline-block w-0.5 h-4 bg-primary animate-pulse ml-0.5" />
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
          <form onSubmit={ask} className="mt-3 flex gap-2">
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={copilotPlaceholder[role ?? ""] ?? "Ask Copilot a question…"}
              className="bg-background/40 h-11"
            />
            <Button
              type="submit"
              disabled={busy}
              className="h-11 bg-[image:var(--gradient-primary)] shadow-glow"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
          <div className="text-[11px] text-muted-foreground mt-2">
            Answers use company knowledge and are grounded in FactoryOS data.
          </div>
        </Panel>
      </div>
    </div>
  );
}
