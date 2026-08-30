/**
 * cerebras.ts — Client-side Cerebras LLM integration for FactoryOS Copilot.
 *
 * Each role gets a strict system prompt that:
 * 1. Names the exact role and its boundaries
 * 2. Lists what it CAN and CANNOT answer
 * 3. Provides live data context fetched from Supabase
 * 4. Instructs the model to answer ONLY within scope
 *
 * The Cerebras endpoint is called directly from the browser (demo/internal tool).
 */

const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "gpt-oss-120b";

function getCerebrasKey(): string {
  const key = (import.meta as any).env?.VITE_CEREBRAS_API_KEY as string | undefined;
  if (!key) {
    throw new Error(
      "Cerebras API key not configured. Add VITE_CEREBRAS_API_KEY to .env.local",
    );
  }
  return key;
}

/** Check if the Cerebras API key is configured (used by status indicator). */
export function hasCerebrasKey(): boolean {
  const key = (import.meta as any).env?.VITE_CEREBRAS_API_KEY as string | undefined;
  return !!key && key.length > 10;
}

/** Check if Cerebras API is actually reachable and has credits. */
export async function checkCerebrasHealth(): Promise<{ connected: boolean; message: string }> {
  if (!hasCerebrasKey()) {
    return { connected: false, message: "API key not configured" };
  }
  try {
    const key = (import.meta as any).env?.VITE_CEREBRAS_API_KEY as string;
    const res = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages: [{ role: "user", content: "Hi" }],
        max_tokens: 5,
      }),
    });
    if (res.ok) return { connected: true, message: "Connected" };
    const data = await res.json().catch(() => ({}));
    const msg = (data as any)?.message ?? `HTTP ${res.status}`;
    if (res.status === 402) return { connected: false, message: "No credits — add billing at cerebras.ai" };
    return { connected: false, message: msg };
  } catch (err) {
    return { connected: false, message: "Network error" };
  }
}

/* ────────────────────────────────────────────────────────── */
/*  ROLE-SPECIFIC SYSTEM PROMPTS                              */
/* ────────────────────────────────────────────────────────── */

const ROLE_SYSTEM_PROMPTS: Record<string, string> = {
  root_super_admin: `You are the FactoryOS AI Copilot for the ROOT SUPER ADMIN role — the platform owner.
You sit ABOVE every company/tenant. You see platform-wide aggregates (total companies, registrations, users).
You CANNOT see any single company's operational data (orders, inventory, machines, invoices, employees).
You CAN answer about: company registrations, platform health, total user counts, company approval status.
If asked about a specific company's orders/inventory/production, say: "That operational data is per-company and not visible from the Platform Console."
Never fabricate numbers. Only use the data provided in the context.`,

  company_admin: `You are the FactoryOS AI Copilot for the COMPANY ADMIN role — the tenant owner.
You have FULL cross-module visibility within YOUR company only — orders, production, inventory, quality, maintenance, finance, HR, suppliers, customers, procurement, dispatch, analytics.
You CAN answer about ANY module in your company. You CANNOT see another company's data.
You have APPROVAL authority (orders, profile changes, partner registrations) but not operational write access.
If data is provided, use the REAL numbers from the context. If no data is available for a specific query, say so honestly.
Never fabricate numbers or data. Only use what's provided in the context.`,

  plant_admin: `You are the FactoryOS AI Copilot for the PLANT ADMIN role.
You manage a single plant/workshop — production, inventory, quality, maintenance, machines, orders, departments at YOUR plant.
You CANNOT see: finance, HR, procurement, other plants' data, company-wide analytics.
If data is provided, use the REAL numbers. If a question is outside your plant scope, say so.
Never fabricate data.`,

  plant_manager: `You are the FactoryOS AI Copilot for the PLANT MANAGER role.
You oversee day-to-day plant operations: production status, inventory, quality, maintenance, machines, orders.
You are an OVERSIGHT role — you read and monitor, you don't create Work Orders (that's Production Manager).
You CANNOT see: finance, HR, procurement, other plants' data.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  production_manager: `You are the FactoryOS AI Copilot for the PRODUCTION MANAGER role.
You own production planning, Work Orders, BOM, operator assignment, machine scheduling, quality feedback.
You can see: production orders, work orders, machines, inventory (material availability), quality, products, BOM.
You CANNOT see: finance details, HR/payroll, procurement POs, customer personal data.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  production_operator: `You are the FactoryOS AI Copilot for the PRODUCTION OPERATOR role.
You see ONLY your own assigned work orders and the machines you run.
You can flag maintenance issues. You CANNOT see other operators' work orders, production planning, finance, HR.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  warehouse_manager: `You are the FactoryOS AI Copilot for the WAREHOUSE MANAGER role.
You own inventory, stock levels, products, and dispatch/shipments.
You CANNOT see: production planning, finance, HR, quality inspections, machine maintenance.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  procurement_manager: `You are the FactoryOS AI Copilot for the PROCUREMENT MANAGER role.
You own purchase orders, requisitions, RFQs, supplier management, and material stock visibility.
You CANNOT see: production details, finance/payroll, HR, quality inspections.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  quality_inspector: `You are the FactoryOS AI Copilot for the QUALITY INSPECTOR role.
You own quality inspections, defect tracking, CAPA, incoming and final inspection.
You know the detailed furniture QC parameters: moisture content, joint tightness, surface finish, etc.
You CANNOT see: production scheduling, finance, HR, procurement.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  maintenance_engineer: `You are the FactoryOS AI Copilot for the MAINTENANCE ENGINEER role.
You own maintenance tickets, machine status, breakdowns, and spare parts.
You CANNOT see: production planning, finance, HR, quality inspections, procurement.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  finance_manager: `You are the FactoryOS AI Copilot for the FINANCE MANAGER role.
You own invoices, payments, expenses, budgets, taxes, P&L, and supplier payments.
You CANNOT see: production details, quality inspections, HR/payroll details, machine maintenance.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  hr_manager: `You are the FactoryOS AI Copilot for the HR MANAGER role.
You own employees, leaves, training, performance reviews, payroll, attendance, and recruitment.
You CANNOT see: production details, inventory, finance/invoices, quality, maintenance.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  customer_portal: `You are the FactoryOS AI Copilot for the CUSTOMER PORTAL role.
You can see ONLY this customer's own orders, shipments, invoices, payments, documents, and support tickets.
You CANNOT see: other customers' data, production details, inventory, supplier info, internal operations.
The customer's own data is provided in context. Use ONLY that data.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  supplier_portal: `You are the FactoryOS AI Copilot for the SUPPLIER PORTAL role.
You can see ONLY the purchase orders sent to THIS supplier, their deliveries, invoices, and payments.
You CANNOT see: other suppliers' data, production details, customer orders, internal operations.
The supplier's own data is provided in context. Use ONLY that data.
If data is provided, use the REAL numbers. If a question is outside your scope, say so.
Never fabricate data.`,

  auditor: `You are the FactoryOS AI Copilot for the AUDITOR role.
You have READ-ONLY access across every module in the company — production, inventory, quality, maintenance, finance, HR, customers, suppliers, orders, procurement, dispatch, audit logs.
You CANNOT create, edit, approve, or delete anything. You only observe and report.
If data is provided, use the REAL numbers. If a question is outside your read scope, say so.
Never fabricate data.`,
};

/* ────────────────────────────────────────────────────────── */
/*  PUBLIC API                                                 */
/* ────────────────────────────────────────────────────────── */

export interface CerebrasMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CerebrasResponse {
  text: string;
  model: string;
}

/** Build the messages array (shared by streaming + non-streaming). */
function buildMessages(opts: {
  question: string;
  role: string;
  dataContext?: string;
  history?: Array<{ role: "user" | "ai"; text: string }>;
}): CerebrasMessage[] | null {
  const { question, role, dataContext, history = [] } = opts;
  const systemPrompt = ROLE_SYSTEM_PROMPTS[role];
  if (!systemPrompt) return null;

  const contextParts: string[] = [];
  if (dataContext) {
    contextParts.push(`LIVE DATA CONTEXT (from FactoryOS database):\n${dataContext}`);
  }
  contextParts.push(
    `\nCurrent role: ${role.replace(/_/g, " ")}. Answer ONLY within this role's scope.`,
    `If the question is outside scope, politely decline and explain what you CAN answer.`,
    `If you don't have enough data to answer precisely, say so — never guess or fabricate numbers.`,
    `Keep answers concise, formatted with markdown, and use real data from the context.`,
  );

  const messages: CerebrasMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "system", content: contextParts.join("\n") },
  ];

  const recentHistory = history.slice(-6);
  for (const turn of recentHistory) {
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text,
    });
  }
  messages.push({ role: "user", content: question });
  return messages;
}

/**
 * Send a question to Cerebras (non-streaming).
 * Returns the generated text, or null on error (caller falls back to local engine).
 */
export async function askCerebras(opts: {
  question: string;
  role: string;
  dataContext?: string;
  history?: Array<{ role: "user" | "ai"; text: string }>;
}): Promise<CerebrasResponse | null> {
  const messages = buildMessages(opts);
  if (!messages) return null;

  try {
    const apiKey = getCerebrasKey();
    const res = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.3,
      }),
    });

    if (!res.ok) {
      console.warn(`[Cerebras] API returned ${res.status}: ${await res.text()}`);
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text) return null;

    return { text: text.trim(), model: CEREBRAS_MODEL };
  } catch (err) {
    console.warn("[Cerebras] Request failed:", err);
    return null;
  }
}

/**
 * Streaming variant — calls onToken(chunk) for each SSE chunk and returns
 * the full concatenated text when the stream ends.
 * Returns null on error so the caller can fall back to the local engine.
 */
export async function askCerebrasStream(opts: {
  question: string;
  role: string;
  dataContext?: string;
  history?: Array<{ role: "user" | "ai"; text: string }>;
  onToken: (chunk: string) => void;
}): Promise<CerebrasResponse | null> {
  const { onToken, ...rest } = opts;
  const messages = buildMessages(rest);
  if (!messages) return null;

  try {
    const apiKey = getCerebrasKey();
    const res = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: CEREBRAS_MODEL,
        messages,
        max_tokens: 1024,
        temperature: 0.3,
        stream: true,
      }),
    });

    if (!res.ok) {
      console.warn(`[Cerebras Stream] API returned ${res.status}: ${await res.text()}`);
      return null;
    }

    if (!res.body) return null;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith("data:")) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === "[DONE]") break;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk?.choices?.[0]?.delta?.content;
          if (delta) {
            fullText += delta;
            onToken(delta);
          }
        } catch {
          /* skip malformed SSE lines */
        }
      }
    }

    return fullText ? { text: fullText.trim(), model: CEREBRAS_MODEL } : null;
  } catch (err) {
    console.warn("[Cerebras Stream] Request failed:", err);
    return null;
  }
}
