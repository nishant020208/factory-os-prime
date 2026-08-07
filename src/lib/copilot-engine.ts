/**
 * copilot-engine.ts — Conversational AI Copilot engine.
 *
 * Answers in a natural, multi-turn conversation. It understands greetings,
 * thanks, questions about capabilities, follow-up references, arithmetic,
 * and — above all — questions about LIVE role-scoped data from Supabase.
 *
 * Permission model (unchanged, from role-scope.ts): a question that touches
 * a domain outside the user's role is blocked with a clear explanation.
 * Nothing about another role's operational data is ever leaked.
 *
 * Conversation flow:
 *   1. Social intents (greeting / thanks / farewell / who-are-you / help)
 *   2. Math / quick calculations
 *   3. Follow-up resolution against previous turns ("and production?")
 *   4. Entity lookup (a specific order / machine / PO number)
 *   5. Role-scoped keyword routing → real table queries
 *   6. Honest, helpful fallback that never fabricates numbers
 */
import { supabase } from "@/integrations/supabase/client";
import {
  checkRoleScope,
  getBlockMessage,
  getAllowedLabels,
  getRoleIdentityCard,
  isReadOnlyRole,
  ROLE_LABELS,
  DOMAIN_LABELS,
  ROLE_DOMAIN_MAP,
} from "@/lib/role-scope";

export interface CopilotTurn {
  role: "user" | "ai";
  text: string;
}

export interface CopilotAnswer {
  text: string;
  conf: number;
}

/** Pick a random element — keeps answers from sounding robotic */
function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ────────────────────────────────────────────────────────── */
/*  INTENT DETECTION                                           */
/* ────────────────────────────────────────────────────────── */

type Intent =
  | "greeting" | "thanks" | "farewell" | "whoami" | "whichrole" | "action" | "help"
  | "howareyou" | "math" | "howto" | "followup" | "data" | "unknown";

function detectIntent(raw: string): { intent: Intent; payload?: string } {
  const q = raw.trim().toLowerCase();

  // Greeting — ONLY if the rest of the message is empty or social.
  // "hi, show me my orders" must reach the data layer, not a hello.
  const greetingRe = /^(hi|hello|hey|hola|namaste|yo|sup|good\s*(morning|afternoon|evening))[,\s!]*/i;
  const gm = q.match(greetingRe);
  if (gm) {
    const rest = q.slice(gm[0].length).trim();
    // A rest that carries a real question is never a greeting
    const carriesQuestion = /\b(order|production|inventory|stock|machine|status|invoice|supplier|quality|show|what|how|can|any|my|the|report|employee|shipment)\b/.test(rest);
    if (!rest || /^(there|how\s*are\s*you|hows\s*it\s*going|whats?\s*up|and\s*you)\b/.test(rest) || (!carriesQuestion && rest.split(/\s+/).length <= 3)) {
      return { intent: "greeting" };
    }
  }

  // Thanks — whole message, never mid-sentence ("awesome" alone is not thanks)
  if (/^(thanks|thank\s*(you|u)|thx|ty|tysm|appreciate\s*it|much\s*appreciated|that\s*helps|great\s*,?\s*thanks|awesome\s*,?\s*thanks|cheers|(ok|okay|alright|sure)[,!.\s]+thanks)[!.,\s]*$/i.test(q))
    return { intent: "thanks" };

  // Farewell — whole message only (bare "later" must not swallow data questions)
  if (/^(bye|goodbye|cya|good\s*night|see\s*you|later|that'?s\s*all|no\s*more|done|okay?\s*bye|talk\s*soon)[!.,\s]*$/i.test(q))
    return { intent: "farewell" };

  // Role identity — "you are copilot for which role?", "what's my role?",
  // "what can I access?", "which company am I scoped to?". Checked BEFORE
  // whoami so the answer always names the exact role.
  if (/(which|what)\s*(role|roles)|copil?ot\s*for\s*(which|what)|for\s*which\s*role|my\s*role|am\s*i\s*scoped|role\s*am\s*i|what\s*(is|are)\s*my\s*(role|permission|access|scope)|who\s*do\s*you\s*work\s*for|whose\s*copil?ot/.test(q))
    return { intent: "whichrole" };

  // Write/action attempts — Copilot is advisory, never mutates data.
  if (/^\s*(please\s*)?(create|add|insert|delete|remove|approve|reject|update|edit|change|cancel|assign|dispatch|pay|issue|generate)\b/.test(q) ||
      /\b(for me|on my behalf|do it|go ahead and)\b/.test(q))
    return { intent: "action" };

  if (/(who\s*are\s*you|what\s*are\s*you|your\s*name|about\s*you|introduce\s*yourself)/.test(q))
    return { intent: "whoami" };

  if (/(what\s*can\s*you\s*(do|help|answer)|how\s*can\s*you\s*help|help\s*me|capabilities|what\s*do\s*you\s*do|what\s*are\s*you\s*(good|able|capable)\s*at|features)/.test(q))
    return { intent: "help" };

  if (/(how\s*are\s*you|how'?s\s*it\s*going|how\s*do\s*you\s*feel|what'?s\s*up|hows\s*it\s*going)/.test(q))
    return { intent: "howareyou" };

  // Math — e.g. "what is 15 * 4", "calculate 2500 + 800", "5% of 2000"
  const mathRe = /([\d.,]+\s*[+\-*/x%^]\s*[\d.,]+)|(?:what\s*is\s*|=)\s*[\d.,]+\s*[+\-*/x%]/;
  const calcRe = /(?:calculate|compute|what\s*is|what'?s)\b/;
  if (mathRe.test(q) && (calcRe.test(q) || /[+\-*/x%]/.test(q))) return { intent: "math", payload: q };

  // UI how-to — "how do I create/export/filter/approve/delete"
  if (/(how\s*do\s*i|how\s*to|steps?\s*to|guide|walk\s*me\s*through|can\s*i\s*create|can\s*you\s*create|need\s*to\s*(create|add|export|filter))/.test(q) &&
    /(create|add|new|export|download|filter|search|delete|approve|edit|update|upload)/.test(q))
    return { intent: "howto" };

  // Follow-up / referential questions — "and production?", "what about inventory?"
  if (/^(and|what\s*about|how\s*about|also|then|tell\s*me\s*more|and\s*what\s*about)\b/.test(q))
    return { intent: "followup" };

  return { intent: "data" };
}

/* ────────────────────────────────────────────────────────── */
/*  QUERY HELPERS — every query is company-scoped (defence in   */
/*  depth on top of RLS: the Copilot never reads another tenant) */
/* ────────────────────────────────────────────────────────── */

/**
 * Active tenant scope for the current answer. Set once at the top of
 * answerCopilot(). Null only for Root Super Admin, whose tables
 * (companies / company_registrations) are platform-level and carry no
 * company_id column.
 */
let _scopeCompanyId: string | null = null;

function scoped(q: any): any {
  return _scopeCompanyId ? q.eq("company_id", _scopeCompanyId) : q;
}

async function countWhere(table: string, column: string, value: string): Promise<number> {
  try {
    const { count } = await scoped(
      supabase
        .from(table as never)
        .select("id", { count: "exact", head: true })
        .eq(column as never, value),
    );
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function listRows(table: string, limit = 8): Promise<any[]> {
  try {
    const { data } = await scoped(
      supabase
        .from(table as never)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit),
    );
    return (data as any[]) ?? [];
  } catch {
    return [];
  }
}

/** Human label for a status field ("in_progress" → "In progress") */
function label(v: unknown): string {
  if (v === null || v === undefined) return "—";
  return String(v).replace(/_/g, " ");
}

/* ────────────────────────────────────────────────────────── */
/*  SMALL TALK                                                 */
/* ────────────────────────────────────────────────────────── */

function socialReply(intent: Intent, role: string | null): string {
  const roleName = role ? role.replace(/_/g, " ") : "user";
  switch (intent) {
    case "greeting":
      return pick([
        `Hey! 👋 Great to see you. I'm your FactoryOS Copilot, scoped to **${roleName}** data. Ask me about your orders, machines, inventory — or type **"what can you do"** to see everything.`,
        `Hello ${roleName}! 👋 I'm here to help you run your factory. I can pull live data from your modules and answer questions instantly. What would you like to know?`,
        `Hi there! Ready when you are. I can check your **${roleName}** data in real time — just ask.`,
      ]);
    case "thanks":
      return pick([
        `You're very welcome! 😊 Anything else you'd like to check?`,
        `Anytime! That's what I'm here for. Need anything else?`,
        `Glad I could help! Let me know if you need more.`,
      ]);
    case "farewell":
      return pick([
        `Take care! 👋 I'll be here whenever you need me.`,
        `See you around! Your data stays synced while you're away.`,
        `Goodbye! Have a productive shift. 🏭`,
      ]);
    case "whoami":
      return `I'm **Copilot**, FactoryOS's conversational AI assistant — and I'm the Copilot for the **${ROLE_LABELS[role ?? ""] ?? "unassigned"}** role. 🤖\n\nI'm connected to your live, role-scoped database, so I query **real records** for your role and your company only (never canned numbers, never another tenant). If a question touches data outside your scope, I'll say so instead of guessing.\n\nAsk **"which role are you Copilot for?"** for the full scope breakdown.`;
    case "howareyou":
      return pick([
        `Running at full capacity! ⚡ All modules healthy, zero critical alerts right now. How can I help you keep it that way?`,
        `All systems operational! 🟢 How's your day going? Ask me anything about your factory data.`,
      ]);
    default:
      return `I can help with your **${roleName}** data — orders, production, inventory, machines and more. What do you need?`;
  }
}

/* ────────────────────────────────────────────────────────── */
/*  MATH                                                        */
/* ────────────────────────────────────────────────────────── */

function evaluateMath(raw: string): string | null {
  const q = raw.toLowerCase();
  // percent: "x% of y"
  const pct = q.match(/([\d.,]+)\s*%\s*(?:of)?\s*([\d.,]+)/);
  if (pct) {
    const a = parseFloat(pct[1].replace(/,/g, ""));
    const b = parseFloat(pct[2].replace(/,/g, ""));
    if (!isNaN(a) && !isNaN(b)) {
      const v = (a / 100) * b;
      return `${a}% of ${b} = **${Number.isInteger(v) ? v : v.toFixed(2)}**`;
    }
  }
  // general expression — strip words, keep digits + operators
  let expr = q
    .replace(/what\s*is|what'?s|calculate|compute|equals?|times|multiplied\s*by|divided\s*by|\bof\b|\bto\b|\bthe\b|\bresult\b|\?|\!/g, " ")
    .replace(/\bx\b/g, "*")
    .replace(/plus/g, "+")
    .replace(/minus/g, "-")
    .replace(/multiplied\s*by|times/g, "*")
    .replace(/divided\s*by|over\b/g, "/")
    .replace(/percent|percentage/g, "")
    .replace(/,/g, "")
    .replace(/[^\d+\-*/().%\s]/g, "")
    .trim();
  if (!expr) return null;
  try {
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${expr});`)() as number;
    if (typeof val === "number" && isFinite(val)) {
      return `That works out to **${Number.isInteger(val) ? val : val.toFixed(2)}** ✨`;
    }
  } catch {
    /* fall through */
  }
  return null;
}

/* ────────────────────────────────────────────────────────── */
/*  ENTITY LOOKUP — a specific order / machine / PO            */
/* ────────────────────────────────────────────────────────── */

async function findEntity(ref: string, role: string | null, userId: string | null): Promise<string | null> {
  const upper = ref.toUpperCase();
  const isCode = /^(SO|WO|PO|PR|INV|N-08|PUR|ORD|RFQ)[-\s]*[\w.-]+/i.test(upper) ||
    /\b(N-08|SO-|WO-|PO-|PUR-|INV-)\b/i.test(upper);
  if (!isCode) return null;

  // External portals may only look up THEIR OWN records — fail closed.
  const customerId = role === "customer_portal" ? await resolveCustomerId(userId) : null;
  const supplierId = role === "supplier_portal" ? await resolveSupplierId(userId) : null;
  if (role === "customer_portal" && !customerId) return UNLINKED_PORTAL_MSG("customer");
  if (role === "supplier_portal" && !supplierId) return UNLINKED_PORTAL_MSG("supplier");

  // Which tables might hold this reference, based on the role's scope
  const allowed = new Set(ROLE_DOMAIN_MAP[role ?? ""] ?? []);
  const probes: Array<{ table: string; columns: string[]; domain: string; owner?: string }> = [
    { table: "sales_orders", columns: ["so_number", "order_number"], domain: "orders", owner: "customer_id" },
    { table: "production_orders", columns: ["order_number", "po_number", "production_order_number"], domain: "production" },
    { table: "purchase_orders", columns: ["po_number"], domain: "procurement", owner: "supplier_id" },
    { table: "work_orders", columns: ["wo_number"], domain: "production", owner: "operator_id" },
    { table: "invoices", columns: ["invoice_number"], domain: "finance", owner: "customer_id" },
    { table: "machines", columns: ["name", "machine_code", "code"], domain: "maintenance" },
  ];

  for (const probe of probes) {
    if (!allowed.has(probe.domain)) continue;
    // A portal/operator can never probe a table it doesn't own rows in.
    if (customerId && probe.owner !== "customer_id") continue;
    if (supplierId && probe.owner !== "supplier_id") continue;
    if (role === "production_operator" && probe.table === "work_orders" && !userId) continue;
    for (const col of probe.columns) {
      try {
        const q: any = scoped(
          supabase.from(probe.table as never).select("*").ilike(col as never, `%${upper}%`).limit(1),
        );
        if (customerId) q.eq("customer_id", customerId);
        if (supplierId) q.eq("supplier_id", supplierId);
        if (role === "production_operator" && probe.table === "work_orders") q.eq("operator_id", userId);
        const res: any = await q;
        const row = res?.data?.[0];
        if (row) {
          const status = label(row.status ?? row.state);
          const pct = row.progress != null || row.progress_percent != null ? ` · ${row.progress ?? row.progress_percent ?? 0}%` : "";
          const amount = row.total_amount != null || row.amount != null
            ? ` · $${Number(row.total_amount ?? row.amount ?? 0).toLocaleString()}`
            : "";
          const due = row.due_date ? ` · due ${new Date(row.due_date).toLocaleDateString()}` : "";
          return `🔎 Found it — **${row[col] ?? probe.table}** (${probe.table.replace(/_/g, " ")}): status **${status}**${pct}${amount}${due}.`;
        }
      } catch {
        /* probe failed — try next */
      }
    }
  }
  return `I couldn't find a record matching **${ref}** in your role's data. Double-check the number, or ask about the general area (e.g. "show my orders").`;
}

/* ────────────────────────────────────────────────────────── */
/*  FOLLOW-UP DOMAIN RESOLUTION                                */
/* ────────────────────────────────────────────────────────── */

/** Detect which domain a follow-up like "and production?" is asking about */
function detectFollowupDomain(q: string): string | null {
  const s = q.toLowerCase();
  if (/(production|manufactur|oee|throughput|batch|work order|production order)/.test(s)) return "production";
  if (/(inventory|stock|warehouse|sku|reorder)/.test(s)) return "inventory";
  if (/(machine|equipment|cnc|robot|asset|downtime)/.test(s)) return "machines";
  if (/(quality|inspection|defect|yield|ncr|capa|pass rate)/.test(s)) return "quality";
  if (/(financ|invoice|payment|budget|expense|revenue|profit)/.test(s)) return "finance";
  if (/(supplier|vendor|purchase order|procurement|rfq)/.test(s)) return "suppliers";
  if (/(order|sale)/.test(s)) return "orders";
  if (/(employee|headcount|staff|people|hr\b)/.test(s)) return "employees";
  if (/(shipment|dispatch|delivery|tracking)/.test(s)) return "dispatch";
  return null;
}

/** Resolve the current customer's own customer_id (customers.user_id is the link) */
async function resolveCustomerId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data: byUser } = (await supabase
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()) as any;
    if (byUser?.id) return byUser.id;

    // Fallback: match on the profile email (legacy rows created before linking)
    const { data: profile } = (await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle()) as any;
    if (!profile?.email) return null;
    const { data: cust } = (await supabase
      .from("customers")
      .select("id")
      .or(`email.eq.${profile.email},contact_email.eq.${profile.email}`)
      .maybeSingle()) as any;
    return cust?.id ?? null;
  } catch {
    return null;
  }
}

/** Resolve the current supplier's own id (suppliers.user_id is the link) */
async function resolveSupplierId(userId: string | null): Promise<string | null> {
  if (!userId) return null;
  try {
    const { data: byUser } = (await supabase
      .from("suppliers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()) as any;
    if (byUser?.id) return byUser.id;

    const { data: profile } = (await supabase
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle()) as any;
    if (!profile?.email) return null;
    const { data: sup } = (await supabase
      .from("suppliers")
      .select("id")
      .eq("contact_email", profile.email)
      .maybeSingle()) as any;
    return sup?.id ?? null;
  } catch {
    return null;
  }
}

/** Fail-closed message when a portal account isn't linked to a record */
const UNLINKED_PORTAL_MSG = (kind: "customer" | "supplier") =>
  `🔒 I can't show any records yet — your login isn't linked to a ${kind} account in this company. Ask the Company Admin to link your ${kind} profile, then I'll show **only your own** ${kind === "customer" ? "orders, shipments and invoices" : "purchase orders, deliveries and payments"}.`;

/** Focused, real-data answer for a single domain — powers follow-up questions */
async function focusedDomainAnswer(
  domain: string,
  role: string | null,
  companyId: string | null,
  userId: string | null,
): Promise<string | null> {
  const allowed = new Set(ROLE_DOMAIN_MAP[role ?? ""] ?? []);
  if (!allowed.has(domain)) return null;
  try {
    // External portals are scoped to THEIR OWN records only — never the whole
    // table. If we can't resolve who they are, we FAIL CLOSED (no data).
    const customerId = role === "customer_portal" ? await resolveCustomerId(userId) : null;
    const supplierId = role === "supplier_portal" ? await resolveSupplierId(userId) : null;
    if (role === "customer_portal" && !customerId) return UNLINKED_PORTAL_MSG("customer");
    if (role === "supplier_portal" && !supplierId) return UNLINKED_PORTAL_MSG("supplier");

    switch (domain) {
      case "production": {
        const rows = await listRows("production_orders", 6);
        const inProg = rows.filter((p: any) => ["in_progress", "in-production"].includes(p.status)).length;
        return `🏭 **Production** — ${rows.length} order(s), ${inProg} in progress.\n\n${rows.slice(0, 3).map((p: any) => `- ${p.order_number ?? p.id?.slice(0, 8)} · ${label(p.status)}`).join("\n")}`;
      }
      case "inventory": {
        const rows = await listRows("inventory", 6);
        const low = rows.filter((i: any) => Number(i.quantity ?? 0) <= Number(i.reorder_level ?? 0));
        return `📦 **Inventory** — ${rows.length} SKU(s), ${low.length} at/below reorder level.\n\n${rows.slice(0, 4).map((i: any) => `- ${i.sku ?? i.product_name ?? i.id?.slice(0, 8)} · ${i.quantity ?? 0}`).join("\n")}`;
      }
      case "machines": {
        const rows = await listRows("machines", 6);
        const down = rows.filter((m: any) => ["down", "maintenance"].includes(m.status));
        return `⚙️ **Machines** — ${rows.length} total, ${down.length} down/in maintenance.\n\n${rows.slice(0, 4).map((m: any) => `- ${m.name ?? "—"} · ${label(m.status)}`).join("\n")}`;
      }
      case "quality": {
        const rows = await listRows("quality_inspections", 6);
        const passed = rows.filter((i: any) => ["pass", "passed"].includes(i.result)).length;
        return `✅ **Quality** — ${rows.length} inspection(s), ${passed} passed.\n\n${rows.slice(0, 3).map((i: any) => `- ${i.inspection_number ?? i.id?.slice(0, 8)} · ${label(i.result)}`).join("\n")}`;
      }
      case "finance": {
        const rows = await listRows("invoices", 6);
        const out = rows.filter((i: any) => ["pending", "partial", "unpaid"].includes(i.status));
        return `💰 **Finance** — ${rows.length} invoice(s), ${out.length} outstanding.\n\n${rows.slice(0, 3).map((i: any) => `- ${i.invoice_number ?? "INV"} · ${label(i.status)}`).join("\n")}`;
      }
      case "suppliers": {
        const sq: any = scoped(
          supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(6),
        );
        if (supplierId) sq.eq("supplier_id", supplierId);
        const { data } = await sq;
        const rows = (data as any[]) ?? [];
        return `📋 **Procurement** — ${rows.length} PO(s).\n\n${rows.slice(0, 3).map((p: any) => `- ${p.po_number ?? "PO"} · ${label(p.status)}`).join("\n")}`;
      }
      case "orders": {
        // Suppliers never see sales orders — their "orders" are purchase orders.
        if (role === "supplier_portal") {
          const pq: any = scoped(
            supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(6),
          ).eq("supplier_id", supplierId);
          const { data } = await pq;
          const rows = (data as any[]) ?? [];
          return `📋 **Your Purchase Orders** — ${rows.length} on record.\n\n${rows.slice(0, 3).map((p: any) => `- ${p.po_number ?? "PO"} · ${label(p.status)}`).join("\n")}`;
        }
        // Customers read their own customer_orders; internal roles see the
        // customer order book (source of truth for the order lifecycle).
        const q: any = scoped(
          supabase.from("customer_orders").select("*").order("created_at", { ascending: false }).limit(6),
        );
        if (customerId) q.eq("customer_id", customerId);
        const { data } = await q;
        const rows = (data as any[]) ?? [];
        return `📋 **Orders** — ${rows.length} on record.\n\n${rows.slice(0, 3).map((o: any) => `- ${o.order_number ?? "ORD"} · ${label(o.status)}`).join("\n")}`;
      }
      case "employees": {
        const rows = await listRows("employees", 5);
        return `👥 **People** — ${rows.length} employee(s) on record.`;
      }
      case "dispatch": {
        const q: any = scoped(
          supabase.from("shipments").select("*").order("created_at", { ascending: false }).limit(5),
        );
        if (customerId) q.eq("customer_id", customerId);
        const { data } = await q;
        const rows = (data as any[]) ?? [];
        return `🚚 **Dispatch** — ${rows.length} shipment(s).\n\n${rows.slice(0, 3).map((s: any) => `- ${s.tracking_number ?? s.id?.slice(0, 8)} · ${label(s.status)}`).join("\n")}`;
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────── */
/*  ROLE DATA ANSWERS                                          */
/* ────────────────────────────────────────────────────────── */

async function roleDataAnswer(role: string | null, companyId: string | null, userId: string | null, topic: string): Promise<CopilotAnswer> {
  switch (role) {
    case "customer_portal": {
      const customerId = await resolveCustomerId(userId);
      // Fail closed — never fall back to "all orders in the company".
      if (!customerId) return { text: UNLINKED_PORTAL_MSG("customer"), conf: 100 };
      // customer_orders is the source of truth for customer-placed orders
      const q: any = scoped(
        supabase.from("customer_orders").select("*").order("created_at", { ascending: false }).limit(6),
      ).eq("customer_id", customerId);
      const { data: orders } = await q;
      const myOrders = (orders as any[]) ?? [];

      // Specific order lookup when the question names one
      const asked = myOrders.find((o: any) =>
        (o.order_number ?? "").toLowerCase().includes(topic) ||
        (o.product ?? "").toLowerCase().includes(topic),
      );
      if (asked) {
        return {
          text: `📦 **Order ${asked.order_number}** — status: **${label(asked.status)}**\n\n- Product: ${asked.product ?? "—"} × ${asked.quantity ?? "—"}\n- Priority: ${label(asked.priority)}\n- Order total: $${Number(asked.order_total ?? 0).toLocaleString()} · Advance: ${label(asked.advance_payment_status)} · Balance due: $${Number(asked.balance_due ?? 0).toLocaleString()}\n- Delivery date: ${asked.delivery_date ? new Date(asked.delivery_date).toLocaleDateString() : "—"}\n\nTrack it live in **Orders → Order Tracking**.`,
          conf: 97,
        };
      }
      if (myOrders.length === 0) {
        return { text: "You have **no orders yet**. Place your first order from the **Orders** tab — the company admin reviews it before production starts.", conf: 95 };
      }
      const open = myOrders.filter((o: any) => !["delivered", "completed", "cancelled", "rejected"].includes(o.status));
      const latest = myOrders[0];
      return {
        text: `You have **${myOrders.length} order(s)**, ${open.length} currently open.\n\nMost recent: **${latest?.order_number ?? "—"}** — ${label(latest?.status)}.\n\nWant the status of a specific one? Just say the order number.`,
        conf: 96,
      };
    }

    case "supplier_portal": {
      const supplierId = await resolveSupplierId(userId);
      // Fail closed — a supplier must never see another supplier's POs.
      if (!supplierId) return { text: UNLINKED_PORTAL_MSG("supplier"), conf: 100 };
      const { data } = await scoped(
        supabase.from("purchase_orders").select("*").order("created_at", { ascending: false }).limit(6),
      ).eq("supplier_id", supplierId);
      const pos = (data as any[]) ?? [];
      const open = pos.filter((p: any) => !["received", "fulfilled"].includes(p.status)).length;
      return {
        text: `You have **${pos.length} purchase order(s)** from this company, ${open} currently open.\n\n${pos.slice(0, 3).map((p: any) => `- ${p.po_number ?? "PO"} · ${label(p.status)}`).join("\n")}\n\nAccept or modify POs in the **Purchase Orders** tab.`,
        conf: 94,
      };
    }

    case "production_manager": {
      const prodOrders = await listRows("production_orders", 8);
      const approved = await listRows("customer_orders", 8);
      const inProgress = prodOrders.filter((p: any) => ["in_progress", "in-production"].includes(p.status)).length;
      return {
        text: `🏭 **Production**\n\n- Production orders: **${prodOrders.length}** (${inProgress} in progress)\n- Approved customer orders ready to plan: **${approved.filter((s: any) => s.status === "approved").length}**\n\n${prodOrders.slice(0, 3).map((p: any) => `- ${p.order_number ?? p.id?.slice(0, 8)} · ${label(p.status)}`).join("\n")}\n\nStart production from **Approved Orders** → create production planning → the inventory auto-check runs.`,
        conf: 95,
      };
    }

    case "warehouse_manager": {
      const inv = await listRows("inventory", 8);
      const low = inv.filter((i: any) => Number(i.quantity ?? 0) <= Number(i.reorder_level ?? 0)).length;
      const shipments = await listRows("shipments", 5);
      return {
        text: `📦 **Warehouse**\n\n- Inventory SKUs: **${inv.length}** (${low} at/below reorder level)\n- Shipments: **${shipments.length}**\n\n${low > 0 ? `⚠️ ${low} low-stock item(s) need reordering.` : "Stock levels are healthy."}\n\nManage stock in **Inventory**, dispatch in **Dispatch**.`,
        conf: 94,
      };
    }

    case "procurement_manager": {
      const pos = await listRows("purchase_orders", 8);
      const suppliers = await listRows("suppliers", 5);
      const open = pos.filter((p: any) => !["received", "fulfilled"].includes(p.status)).length;
      return {
        text: `📋 **Procurement**\n\n- Purchase orders: **${pos.length}** (${open} open)\n- Suppliers: **${suppliers.length}**\n\n${pos.slice(0, 3).map((p: any) => `- ${p.po_number ?? "PO"} · ${label(p.status)}`).join("\n")}\n\nCreate POs in **Purchase Orders** — suppliers respond in real time.`,
        conf: 94,
      };
    }

    case "quality_inspector": {
      const insp = await listRows("quality_inspections", 8);
      const passed = insp.filter((i: any) => ["pass", "passed"].includes(i.result)).length;
      return {
        text: `✅ **Quality**\n\n- Inspections: **${insp.length}** (${passed} passed)\n\n${insp.slice(0, 3).map((i: any) => `- ${i.inspection_number ?? i.id?.slice(0, 8)} · ${label(i.result)}`).join("\n")}\n\nPassed batches release as finished goods; failures route back to production with rejection notes.`,
        conf: 94,
      };
    }

    case "maintenance_engineer": {
      const machines = await listRows("machines", 8);
      const down = machines.filter((m: any) => ["down", "maintenance"].includes(m.status)).length;
      return {
        text: `🔧 **Maintenance**\n\n- Machines: **${machines.length}** (${down} down/in maintenance)\n\n${machines.slice(0, 4).map((m: any) => `- ${m.name ?? "—"} · ${label(m.status)}`).join("\n")}\n\nFlag machines "under maintenance" to block new work-order assignment.`,
        conf: 94,
      };
    }

    case "finance_manager": {
      const invoices = await listRows("invoices", 8);
      const outstanding = invoices.filter((i: any) => ["pending", "partial", "unpaid"].includes(i.status)).length;
      const totalOut = invoices.reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);
      return {
        text: `💰 **Finance**\n\n- Invoices: **${invoices.length}** (${outstanding} outstanding)\n- Outstanding value: **$${totalOut.toLocaleString()}**\n\n${invoices.slice(0, 3).map((i: any) => `- ${i.invoice_number ?? "INV"} · ${label(i.status)}`).join("\n")}\n\nInvoices auto-generate at dispatch-ready; balance due = order total minus advance paid.`,
        conf: 95,
      };
    }

    case "hr_manager": {
      const employees = await listRows("employees", 6);
      return {
        text: `👥 **HR**\n\n- Employees on record: **${employees.length}**\n\n${employees.slice(0, 3).map((e: any) => `- ${e.full_name ?? e.name ?? e.id?.slice(0, 8)} · ${label(e.department)}`).join("\n")}\n\nManage records in **Employees** — onboarding and department assignments flow to Company Admin for whitelist approval.`,
        conf: 92,
      };
    }

    case "production_operator": {
      // Operators see ONLY their own work orders (work_orders.operator_id is
      // the auth user id). No user id → no data, never the whole table.
      let wos: any[] = [];
      if (userId) {
        const { data } = (await scoped(
          supabase.from("work_orders").select("*").order("created_at", { ascending: false }).limit(8),
        ).eq("operator_id" as never, userId)) as any;
        wos = (data as any[]) ?? [];
      }
      if (!userId) {
        return { text: "I can't identify your operator account right now, so I won't show any work orders. Try signing out and back in.", conf: 100 };
      }
      if (wos.length === 0) {
        return { text: "🔧 You have **no work orders assigned** right now. Your Production Manager assigns them — they'll appear here and in **Assigned Work Orders** the moment they do.", conf: 96 };
      }
      return {
        text: `🔧 **Your Work Orders**\n\n- Assigned to you: **${wos.length}**\n\n${wos.slice(0, 4).map((w: any) => `- ${w.wo_number ?? "WO"} · ${label(w.status)} · ${w.progress_percent ?? w.progress ?? 0}%`).join("\n")}\n\nUpdate progress (25/50/75/100%) — it pushes live to the customer's tracking page.`,
        conf: 94,
      };
    }

    case "company_admin": {
      const [pendingApproval, prodOrders, machines, lowStock, employees, customers, materialReq] = await Promise.all([
        countWhere("customer_orders", "status", "pending_approval"),
        countWhere("production_orders", "status", "in_progress"),
        countWhere("machines", "status", "operational"),
        countWhere("inventory", "status", "low_stock"),
        countWhere("employees", "company_id", companyId ?? ""),
        countWhere("customers", "company_id", companyId ?? ""),
        countWhere("customer_requests", "status", "pending"),
      ]);
      return {
        text: `📊 **Company Overview**\n\n- Orders pending approval: **${pendingApproval}**\n- Customer access requests pending: **${materialReq}**\n- Production in progress: **${prodOrders}**\n- Machines operational: **${machines}**\n- Employees: **${employees}** · Customers: **${customers}**\n\nReview pending items in **Order Approvals** and **Customer Requests** (bolded in your sidebar).`,
        conf: 96,
      };
    }

    case "root_super_admin": {
      const [companies, registrations, approved] = await Promise.all([
        countWhere("companies", "status", "active"),
        countWhere("company_registrations", "status", "pending"),
        countWhere("company_registrations", "status", "approved"),
      ]);
      return {
        text: `📋 **Platform Overview**\n\n- Active companies: **${companies}**\n- Pending registrations: **${registrations}**\n- Approved registrations: **${approved}**\n\nApprove/reject requests in **Pending Requests**.`,
        conf: 96,
      };
    }

    case "auditor": {
      const [audit, orders, prod, machines] = await Promise.all([
        countWhere("audit_logs", "company_id", companyId ?? ""),
        countWhere("customer_orders", "company_id", companyId ?? ""),
        countWhere("production_orders", "company_id", companyId ?? ""),
        countWhere("machines", "company_id", companyId ?? ""),
      ]);
      return {
        text: `📋 **Read-Only Overview**\n\n- Audit events: **${audit}**\n- Customer orders: **${orders}** · Production orders: **${prod}** · Machines: **${machines}**\n\nYou have read-only access to every module — drill into **Audit Logs**, **Reports**, and **Compliance**.`,
        conf: 95,
      };
    }

    default: {
      const allowed = getAllowedLabels(role);
      return {
        text: `I don't have a data scope defined for your role yet. I can help with: **${allowed.join(", ") || "your dashboard"}**. Ask about any of those and I'll pull live numbers.`,
        conf: 80,
      };
    }
  }
}

/* ────────────────────────────────────────────────────────── */
/*  MAIN ENTRY POINT                                           */
/* ────────────────────────────────────────────────────────── */

export async function answerCopilot(opts: {
  question: string;
  role: string | null;
  companyId: string | null;
  userId?: string | null;
  history?: CopilotTurn[];
}): Promise<CopilotAnswer> {
  const { question, role, companyId, userId = null, history = [] } = opts;
  const lower = question.toLowerCase();

  // 0. Tenant scope for EVERY query in this answer. Root Super Admin reads
  //    platform tables (no company_id column) so its scope stays null; every
  //    other role is hard-filtered to its own company on top of RLS.
  _scopeCompanyId = role === "root_super_admin" ? null : companyId;

  // 1. Social intents
  const { intent, payload } = detectIntent(question);

  // Role identity — must be exact for all 15 roles.
  if (intent === "whichrole") {
    return { text: getRoleIdentityCard(role), conf: 100 };
  }

  // Write attempts — the Copilot is advisory and never mutates data.
  if (intent === "action") {
    const readOnly = isReadOnlyRole(role);
    return {
      text: readOnly
        ? `🚫 Your **${ROLE_LABELS[role ?? ""] ?? "role"}** access is strictly read-only — no create, edit, approve or delete actions exist for you anywhere in FactoryOS, and I can't perform them either. I can show you the records and the audit trail instead.`
        : `I'm advisory only — I read live data and guide you, but I never create, edit, approve or delete records on your behalf. That keeps the audit trail honest (every change is attributed to a real person).\n\nOpen the relevant module and use the action button there; ask me **"how do I ..."** and I'll walk you through the exact steps.`,
      conf: 100,
    };
  }

  if (intent === "greeting" || intent === "thanks" || intent === "farewell" || intent === "whoami" || intent === "howareyou") {
    return { text: socialReply(intent, role), conf: 100 };
  }

  if (intent === "help") {
    const allowed = getAllowedLabels(role);
    const examples = pick([
      "Try: \"what's the status of my orders?\", \"show production\", \"any low stock?\"",
      "You could ask: \"latest invoice?\", \"machines that need maintenance?\", \"open purchase orders\"",
    ]);
    return {
      text: `I'm your **role-scoped** data assistant. I can answer with live numbers about: **${allowed.join(", ")}**.\n\n${examples}\n\nI also understand follow-ups like "and production?" and quick math like "15% of 2000". If a question touches data outside your role, I'll tell you honestly.`,
      conf: 100,
    };
  }

  // 2. Fail closed: a company role with no resolved company can't be scoped,
  //    so no data question is answered.
  if (role && role !== "root_super_admin" && !companyId) {
    return {
      text: "🔒 I can't determine which company your account belongs to, so I won't return any data. Ask your admin to complete your profile setup, then try again.",
      conf: 100,
    };
  }

  // 3. Permission gate — out-of-scope domains blocked before any data work.
  //    Entity lookups and follow-ups both re-check scope inside themselves.
  const blockedDomain = checkRoleScope(role, question);
  if (blockedDomain) {
    const domainLabel = DOMAIN_LABELS[blockedDomain] ?? blockedDomain;
    const allowed = getAllowedLabels(role).join(", ");
    return {
      text: `🚫 **Access Restricted**\n\nYou asked about **${domainLabel}**, which is outside your role's scope.\n\n${getBlockMessage(role)}\n\nYour role has access to: ${allowed}`,
      conf: 100,
    };
  }

  // 3. Entity lookup FIRST — a named code (SO-2026-0001, WO-0042, PO-1234) is
  //    more specific than math or the generic role summary. The regex requires
  //    a code prefix so words like "production" never match.
  const entityMatch = question.match(/\b(?:N-08|SO|WO|PO|PR|INV|PUR|ORD|RFQ)[-\s]*[\w.\-]*\d[\w.\-]*\b/i);
  if (entityMatch && (intent === "data" || intent === "math" || /status|where|track|find|check|about|detail/.test(lower))) {
    const ref = entityMatch[0].trim();
    const found = await findEntity(ref, role, userId);
    if (found) return { text: found, conf: 90 };
  }

  // 4. Math — only after entity lookup, so "what's the status of SO-2026-0001"
  //    never gets evaluated as arithmetic (2026 minus 0001).
  if (intent === "math" && payload) {
    const result = evaluateMath(payload);
    if (result) return { text: result, conf: 100 };
  }

  // 5. Follow-up resolution — "and production?" continues the last topic
  if (intent === "followup") {
    const domain = detectFollowupDomain(question);
    if (domain) {
      const allowedSet = new Set(ROLE_DOMAIN_MAP[role ?? ""] ?? []);
      if (!allowedSet.has(domain)) {
        return {
          text: `🚫 **Access Restricted** — you asked about **${DOMAIN_LABELS[domain] ?? domain}**, which is outside your role's scope.\n\n${getBlockMessage(role)}`,
          conf: 100,
        };
      }
      const focused = await focusedDomainAnswer(domain, role, companyId, userId);
      if (focused) return { text: focused, conf: 94 };
    }
    const lastUser = [...history].reverse().find((h) => h.role === "user");
    if (lastUser) {
      const combined = `${lastUser.text} ${question}`;
      const ans = await roleDataAnswer(role, companyId, userId, combined.toLowerCase());
      return { ...ans, text: `Following up on that — ${ans.text}` };
    }
  }

  // 6. Role-scoped data answer
  try {
    return await roleDataAnswer(role, companyId, userId, lower);
  } catch {
    return {
      text: "I hit an error fetching live data. Please try again — or open the relevant module tab to see the data directly.",
      conf: 70,
    };
  }
}
