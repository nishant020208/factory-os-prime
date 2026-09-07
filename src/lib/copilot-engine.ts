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
import { fmtMoney } from "@/lib/currency";
import { askGroq, askGroqStream, hasGroqKey } from "@/lib/groq";
import { askCerebras, askCerebrasStream } from "@/lib/cerebras";

/**
 * Helper that assembles a failing Supabase client for isolated tests of the
 * context-assembly path. Every query through it returns an error row, so we
 * can assert that gatherRoleData reports the failure as a DATA NOTE rather
 * than silently returning empty context.
 */
export function makeFailingSupabaseClient(
  failWith = "connection refused",
): {
  from: (table: string) => {
    select: (cols?: string) => {
      eq: (col: string, val: string) => {
        limit: (n: number) => {
          order: (col: string, opts: { ascending: boolean }) => {
            data: null;
            error: { message: string };
          };
        };
      };
      limit: (n: number) => { error: { message: string } };
    };
  };
  channel: (name: string) => { subscribe: () => { } };
} {
  const failingSelectChain = (): {
    select: (cols?: string) => {
      eq: (col: string, val: string) => {
        limit: (n: number) => {
          order: (col: string, opts: { ascending: boolean }) => {
            data: null;
            error: { message: string };
          };
        };
      };
      limit: (n: number) => { error: { message: string } };
    };
  } => ({
    select: () => ({
      eq: () => ({
        limit: () => ({
          order: () => ({
            data: null as never,
            error: { message: failWith },
          }),
        }),
      }),
      limit: () => ({
        error: { message: failWith },
      }),
    }),
  });
  return {
    from: () => failingSelectChain(),
    channel: () => ({ subscribe: () => ({}) }),
  };
}



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
  | "greeting"
  | "thanks"
  | "farewell"
  | "whoami"
  | "whichrole"
  | "action"
  | "help"
  | "howareyou"
  | "math"
  | "howto"
  | "followup"
  | "data"
  | "unknown";

function detectIntent(raw: string): { intent: Intent; payload?: string } {
  const q = raw.trim().toLowerCase();

  // Greeting — ONLY if the rest of the message is empty or social.
  // "hi, show me my orders" must reach the data layer, not a hello.
  const greetingRe =
    /^(hi|hello|hey|hola|namaste|yo|sup|good\s*(morning|afternoon|evening))[,\s!]*/i;
  const gm = q.match(greetingRe);
  if (gm) {
    const rest = q.slice(gm[0].length).trim();
    // A rest that carries a real question is never a greeting
    const carriesQuestion =
      /\b(order|production|inventory|stock|machine|status|invoice|supplier|quality|show|what|how|can|any|my|the|report|employee|shipment)\b/.test(
        rest,
      );
    if (
      !rest ||
      /^(there|how\s*are\s*you|hows\s*it\s*going|whats?\s*up|and\s*you)\b/.test(rest) ||
      (!carriesQuestion && rest.split(/\s+/).length <= 3)
    ) {
      return { intent: "greeting" };
    }
  }

  // Thanks — whole message, never mid-sentence ("awesome" alone is not thanks)
  if (
    /^(thanks|thank\s*(you|u)|thx|ty|tysm|appreciate\s*it|much\s*appreciated|that\s*helps|great\s*,?\s*thanks|awesome\s*,?\s*thanks|cheers|(ok|okay|alright|sure)[,!.\s]+thanks)[!.,\s]*$/i.test(
      q,
    )
  )
    return { intent: "thanks" };

  // Farewell — whole message only (bare "later" must not swallow data questions)
  if (
    /^(bye|goodbye|cya|good\s*night|see\s*you|later|that'?s\s*all|no\s*more|done|okay?\s*bye|talk\s*soon)[!.,\s]*$/i.test(
      q,
    )
  )
    return { intent: "farewell" };

  // Role identity — "you are copilot for which role?", "what's my role?",
  // "what can I access?", "which company am I scoped to?". Checked BEFORE
  // whoami so the answer always names the exact role.
  if (
    /(which|what)\s*(role|roles)|copil?ot\s*for\s*(which|what)|for\s*which\s*role|my\s*role|am\s*i\s*scoped|role\s*am\s*i|what\s*(is|are)\s*my\s*(role|permission|access|scope)|who\s*do\s*you\s*work\s*for|whose\s*copil?ot/.test(
      q,
    )
  )
    return { intent: "whichrole" };

  // Write/action attempts — Copilot is advisory, never mutates data.
  if (
    /^\s*(please\s*)?(create|add|insert|delete|remove|approve|reject|update|edit|change|cancel|assign|dispatch|pay|issue|generate)\b/.test(
      q,
    ) ||
    /\b(for me|on my behalf|do it|go ahead and)\b/.test(q)
  )
    return { intent: "action" };

  if (/(who\s*are\s*you|what\s*are\s*you|your\s*name|about\s*you|introduce\s*yourself)/.test(q))
    return { intent: "whoami" };

  if (
    /(what\s*can\s*you\s*(do|help|answer)|how\s*can\s*you\s*help|help\s*me|capabilities|what\s*do\s*you\s*do|what\s*are\s*you\s*(good|able|capable)\s*at|features)/.test(
      q,
    )
  )
    return { intent: "help" };

  if (
    /(how\s*are\s*you|how'?s\s*it\s*going|how\s*do\s*you\s*feel|what'?s\s*up|hows\s*it\s*going)/.test(
      q,
    )
  )
    return { intent: "howareyou" };

  // Math — e.g. "what is 15 * 4", "calculate 2500 + 800", "5% of 2000"
  const mathRe = /([\d.,]+\s*[+\-*/x%^]\s*[\d.,]+)|(?:what\s*is\s*|=)\s*[\d.,]+\s*[+\-*/x%]/;
  const calcRe = /(?:calculate|compute|what\s*is|what'?s)\b/;
  if (mathRe.test(q) && (calcRe.test(q) || /[+\-*/x%]/.test(q)))
    return { intent: "math", payload: q };

  // UI how-to — "how do I create/export/filter/approve/delete"
  if (
    /(how\s*do\s*i|how\s*to|steps?\s*to|guide|walk\s*me\s*through|can\s*i\s*create|can\s*you\s*create|need\s*to\s*(create|add|export|filter))/.test(
      q,
    ) &&
    /(create|add|new|export|download|filter|search|delete|approve|edit|update|upload)/.test(q)
  )
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

/** Generate a markdown table from headers and rows */
function toMarkdownTable(headers: string[], rows: string[][]): string {
  if (rows.length === 0) return "";
  const separator = headers.map(() => "---").join(" | ");
  const body = rows.map((r) => r.join(" | ")).join("\n");
  return `| ${headers.join(" | ")} |\n| ${separator} |\n| ${body} |`;
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
  const expr = q
    .replace(
      /what\s*is|what'?s|calculate|compute|equals?|times|multiplied\s*by|divided\s*by|\bof\b|\bto\b|\bthe\b|\bresult\b|\?|!/g,
      " ",
    )
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

async function findEntity(
  ref: string,
  role: string | null,
  userId: string | null,
): Promise<string | null> {
  const upper = ref.toUpperCase();
  const isCode =
    /^(SO|WO|PO|PR|INV|N-08|PUR|ORD|RFQ)[-\s]*[\w.-]+/i.test(upper) ||
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
    {
      table: "sales_orders",
      columns: ["so_number", "order_number"],
      domain: "orders",
      owner: "customer_id",
    },
    {
      table: "production_orders",
      columns: ["order_number", "po_number", "production_order_number"],
      domain: "production",
    },
    {
      table: "purchase_orders",
      columns: ["po_number"],
      domain: "procurement",
      owner: "supplier_id",
    },
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
          supabase
            .from(probe.table as never)
            .select("*")
            .ilike(col as never, `%${upper}%`)
            .limit(1),
        );
        if (customerId) q.eq("customer_id", customerId);
        if (supplierId) q.eq("supplier_id", supplierId);
        if (role === "production_operator" && probe.table === "work_orders")
          q.eq("operator_id", userId);
        const res: any = await q;
        const row = res?.data?.[0];
        if (row) {
          const pctStr =
            row.progress != null || row.progress_percent != null
              ? `${row.progress ?? row.progress_percent ?? 0}%`
              : "—";
          const amountStr =
            row.total_amount != null || row.amount != null
              ? fmtMoney(Number(row.total_amount ?? row.amount ?? 0))
              : "—";
          const dueStr = row.due_date ? new Date(row.due_date).toLocaleDateString() : "—";
          const entityTable = toMarkdownTable(
            ["Field", "Value"],
            [
              ["Status", status],
              ["Progress", pctStr],
              ["Amount", amountStr],
              ["Due Date", dueStr],
            ],
          );
          return `🔎 Found it — **${row[col] ?? probe.table}**\n\n${entityTable}`;
        }
      } catch {
        /* probe failed — try next */
      }
    }
  }
  return `I couldn't find a record matching **${ref}** in your role's data. Double-check the number, or ask about the general area (e.g. "show my orders").`;
}

/* ────────────────────────────────────────────────────────── */
/*  SPECIFIC-ITEM ANSWERS — precision over generic summaries   */
/*  (Bug 4 fix: "what's my Teak Wood stock?" returns the REAL  */
/*  live quantity, not a warehouse rollup)                     */
/* ────────────────────────────────────────────────────────── */

const MATERIAL_KEYWORDS = [
  "teak",
  "plywood",
  "upholstery fabric",
  "fabric",
  "foam",
  "hinges",
  "screws",
  "polish",
  "drawer slides",
  "adhesive",
  "lumber",
  "wood",
];

/**
 * Answer a named-material stock question with the real quantity from the
 * inventory/materials tables. Returns null when the question isn't a material
 * stock question (so the generic role summary still runs).
 */
async function materialStockAnswer(question: string): Promise<string | null> {
  const q = question.toLowerCase();
  if (!/\b(stock|quantity|level|left|available|inventory|units|qty)\b/.test(q)) return null;
  const hit = MATERIAL_KEYWORDS.find((m) => q.includes(m));
  if (!hit) return null;

  try {
    // 1. Find the material row (materials.name is the real source of the name).
    const { data: mats } = await scoped(
      supabase
        .from("materials")
        .select("id, name, unit, unit_cost")
        .ilike("name", `%${hit}%`)
        .limit(1),
    );
    const mat = (mats as any[] | null)?.[0];
    if (!mat) {
      return `I couldn't find a material matching **${hit}** in your live materials list. Ask me about one of: Teak Wood, Plywood Sheet, Upholstery Fabric, Foam, Hinges, Screws, Polish, Drawer Slides, Adhesive.`;
    }

    // 2. Sum real quantities from inventory — either via inventory.material_id
    //    or via the product row that shares the material's name (legacy seeds).
    //    Use available stock (on-hand minus reserved, quarantined, damaged).
    let qty = 0;
    let reservedQty = 0;
    let quarantinedQty = 0;
    let damagedQty = 0;
    const { data: byMaterial } = await scoped(
      supabase.from("inventory").select("quantity, reserved_quantity, quarantined_quantity, damaged_qty, material_id").eq("material_id", mat.id),
    );
    const rows = (byMaterial as any[] | null) ?? [];
    if (rows.length) {
      for (const r of rows) {
        const onHand = Number(r.quantity ?? 0);
        const res = Number(r.reserved_quantity ?? 0);
        const q = Number(r.quarantined_quantity ?? 0);
        const d = Number(r.damaged_qty ?? 0);
        reservedQty += res;
        quarantinedQty += q;
        damagedQty += d;
        qty += Math.max(0, onHand - res - q - d);
      }
    } else {
      const { data: prods } = await scoped(
        supabase
          .from("products")
          .select("id, reorder_level, unit")
          .ilike("name", `%${hit}%`)
          .limit(1),
      );
      const prod = (prods as any[] | null)?.[0];
      if (prod) {
        const { data: invs } = await scoped(
          supabase.from("inventory").select("quantity, reserved_quantity, quarantined_quantity, damaged_qty").eq("product_id", prod.id),
        );
        for (const r of (invs as any[] | null) ?? []) {
          const onHand = Number(r.quantity ?? 0);
          const res = Number(r.reserved_quantity ?? 0);
          const q = Number(r.quarantined_quantity ?? 0);
          const d = Number(r.damaged_qty ?? 0);
          reservedQty += res;
          quarantinedQty += q;
          damagedQty += d;
          qty += Math.max(0, onHand - res - q - d);
        }
        const reorder = Number(prod.reorder_level ?? 0);
        const flag = qty <= reorder ? "⚠️ Low" : "✅ Healthy";
        return `📦 **${mat.name}**\n\n${toMarkdownTable(
          ["Field", "Value"],
          [
            ["Material", mat.name],
            ["Available Stock", `${qty} ${prod.unit ?? mat.unit ?? "units"}`],
            ["Reserved", String(reservedQty)],
            ["Quarantined", String(quarantinedQty)],
            ["Damaged", String(damagedQty)],
            ["Reorder Level", String(reorder)],
            ["Status", flag],
          ],
        )}\n\nThis is the AVAILABLE stock (on-hand minus reserved/quarantined/damaged) — the same number used for production planning.`;
      }
    }
    return `📦 **${mat.name}**\n\n${toMarkdownTable(
      ["Field", "Value"],
      [
        ["Material", mat.name],
        ["Available Stock", `${qty} ${mat.unit ?? "units"}`],
        ["Reserved", String(reservedQty)],
        ["Quarantined", String(quarantinedQty)],
        ["Damaged", String(damagedQty)],
      ],
    )}\n\nThis is the AVAILABLE stock (on-hand minus reserved/quarantined/damaged).`;
  } catch {
    return null;
  }
}

/* ────────────────────────────────────────────────────────── */
/*  FOLLOW-UP DOMAIN RESOLUTION                                */
/* ────────────────────────────────────────────────────────── */

/** Detect which domain a follow-up like "and production?" is asking about */
function detectFollowupDomain(q: string): string | null {
  const s = q.toLowerCase();
  if (/(production|manufactur|oee|throughput|batch|work order|production order)/.test(s))
    return "production";
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
async function resolveCustomerId(userId: string | null, client?: ReturnType<typeof import("@supabase/supabase-js").createClient>): Promise<string | null> {
  if (!userId) return null;
  const c = client ?? supabase;
  try {
    const { data: byUser } = (await c
      .from("customers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()) as any;
    if (byUser?.id) return byUser.id;

    // Fallback: match on the profile email (legacy rows created before linking)
    const { data: profile } = (await c
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle()) as any;
    if (!profile?.email) return null;
    const { data: cust } = (await c
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
async function resolveSupplierId(userId: string | null, client?: ReturnType<typeof import("@supabase/supabase-js").createClient>): Promise<string | null> {
  if (!userId) return null;
  const c = client ?? supabase;
  try {
    const { data: byUser } = (await c
      .from("suppliers")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle()) as any;
    if (byUser?.id) return byUser.id;

    const { data: profile } = (await c
      .from("profiles")
      .select("email")
      .eq("id", userId)
      .maybeSingle()) as any;
    if (!profile?.email) return null;
    const { data: sup } = (await c
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
        const inProg = rows.filter((p: any) =>
          ["in_progress", "in-production"].includes(p.status),
        ).length;
        const tableRows = rows
          .slice(0, 5)
          .map((p: any) => [
            p.order_number ?? p.id?.slice(0, 8),
            label(p.status),
            `${p.priority ?? "—"}`,
            `${p.progress ?? p.progress_percent ?? 0}%`,
          ]);
        return `🏭 **Production** — ${rows.length} order(s), ${inProg} in progress.\n\n${toMarkdownTable(
          ["Order", "Status", "Priority", "Progress"],
          tableRows,
        )}`;
      }
      case "inventory": {
        const rows = await listRows("inventory", 6);
        const low = rows.filter((i: any) => {
          const onHand = Number(i.quantity ?? 0);
          const reserved = Number(i.reserved_quantity ?? 0);
          const quarantined = Number(i.quarantined_quantity ?? 0);
          const damaged = Number(i.damaged_qty ?? 0);
          const available = Math.max(0, onHand - reserved - quarantined - damaged);
          return available <= Number(i.reorder_level ?? 0);
        });
        const tableRows = rows
          .slice(0, 6)
          .map((i: any) => {
            const onHand = Number(i.quantity ?? 0);
            const reserved = Number(i.reserved_quantity ?? 0);
            const quarantined = Number(i.quarantined_quantity ?? 0);
            const damaged = Number(i.damaged_qty ?? 0);
            const available = Math.max(0, onHand - reserved - quarantined - damaged);
            return [
              i.sku ?? i.product_name ?? i.id?.slice(0, 8),
              `${available}`,
              `${i.reorder_level ?? 0}`,
              available <= Number(i.reorder_level ?? 0) ? "⚠️ Low" : "OK",
            ];
          });
        return `📦 **Inventory** — ${rows.length} SKU(s), ${low.length} at/below reorder level.\n\n${toMarkdownTable(
          ["SKU / Product", "Available", "Reorder", "Status"],
          tableRows,
        )}`;
      }
      case "machines": {
        const rows = await listRows("machines", 6);
        const down = rows.filter((m: any) => ["down", "maintenance"].includes(m.status));
        const tableRows = rows
          .slice(0, 5)
          .map((m: any) => [m.name ?? "—", m.code ?? "—", label(m.status)]);
        return `⚙️ **Machines** — ${rows.length} total, ${down.length} down/in maintenance.\n\n${toMarkdownTable(
          ["Machine", "Code", "Status"],
          tableRows,
        )}`;
      }
      case "quality": {
        const rows = await listRows("quality_inspections", 6);
        const passed = rows.filter((i: any) => ["pass", "passed"].includes(i.result)).length;
        const tableRows = rows
          .slice(0, 5)
          .map((i: any) => [
            i.inspection_number ?? i.id?.slice(0, 8),
            label(i.result),
            `${i.defects_found ?? 0}`,
          ]);
        return `✅ **Quality** — ${rows.length} inspection(s), ${passed} passed.\n\n${toMarkdownTable(
          ["Inspection #", "Result", "Defects"],
          tableRows,
        )}`;
      }
      case "finance": {
        const rows = await listRows("invoices", 6);
        const out = rows.filter((i: any) => ["pending", "partial", "unpaid"].includes(i.status));
        const tableRows = rows
          .slice(0, 5)
          .map((i: any) => [
            i.invoice_number ?? "INV",
            label(i.status),
            fmtMoney(Number(i.total_amount ?? 0)),
          ]);
        return `💰 **Finance** — ${rows.length} invoice(s), ${out.length} outstanding.\n\n${toMarkdownTable(
          ["Invoice", "Status", "Amount"],
          tableRows,
        )}`;
      }
      case "suppliers": {
        const sq: any = scoped(
          supabase
            .from("purchase_orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(6),
        );
        if (supplierId) sq.eq("supplier_id", supplierId);
        const { data } = await sq;
        const rows = (data as any[]) ?? [];
        const tableRows = rows
          .slice(0, 5)
          .map((p: any) => [
            p.po_number ?? "PO",
            label(p.status),
            fmtMoney(Number(p.total_amount ?? 0)),
          ]);
        return `📋 **Procurement** — ${rows.length} PO(s).\n\n${toMarkdownTable(
          ["PO #", "Status", "Amount"],
          tableRows,
        )}`;
      }
      case "orders": {
        if (role === "supplier_portal") {
          const pq: any = scoped(
            supabase
              .from("purchase_orders")
              .select("*")
              .order("created_at", { ascending: false })
              .limit(6),
          ).eq("supplier_id", supplierId);
          const { data } = await pq;
          const rows = (data as any[]) ?? [];
          const tableRows = rows
            .slice(0, 5)
            .map((p: any) => [
              p.po_number ?? "PO",
              label(p.status),
              fmtMoney(Number(p.total_amount ?? 0)),
            ]);
          return `📋 **Your Purchase Orders** — ${rows.length} on record.\n\n${toMarkdownTable(
            ["PO #", "Status", "Amount"],
            tableRows,
          )}`;
        }
        const q: any = scoped(
          supabase
            .from("customer_orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(6),
        );
        if (customerId) q.eq("customer_id", customerId);
        const { data } = await q;
        const rows = (data as any[]) ?? [];
        const tableRows = rows
          .slice(0, 5)
          .map((o: any) => [
            o.order_number ?? "ORD",
            o.product ?? "—",
            `${o.quantity ?? "—"}`,
            label(o.status),
          ]);
        return `📋 **Orders** — ${rows.length} on record.\n\n${toMarkdownTable(
          ["Order #", "Product", "Qty", "Status"],
          tableRows,
        )}`;
      }
      case "employees": {
        const rows = await listRows("employees", 5);
        const tableRows = rows.map((e: any) => [e.full_name ?? e.name ?? "—", e.department ?? "—"]);
        return `👥 **People** — ${rows.length} employee(s) on record.\n\n${toMarkdownTable(
          ["Name", "Department"],
          tableRows,
        )}`;
      }
      case "dispatch": {
        const q: any = scoped(
          supabase.from("shipments").select("*").order("created_at", { ascending: false }).limit(5),
        );
        if (customerId) q.eq("customer_id", customerId);
        const { data } = await q;
        const rows = (data as any[]) ?? [];
        const tableRows = rows
          .slice(0, 5)
          .map((s: any) => [
            s.shipment_number ?? s.id?.slice(0, 8),
            s.carrier ?? "—",
            s.tracking_number ?? "—",
            label(s.status),
          ]);
        return `🚚 **Dispatch** — ${rows.length} shipment(s).\n\n${toMarkdownTable(
          ["Shipment", "Carrier", "Tracking", "Status"],
          tableRows,
        )}`;
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

async function roleDataAnswer(
  role: string | null,
  companyId: string | null,
  userId: string | null,
  topic: string,
): Promise<CopilotAnswer> {
  switch (role) {
    case "customer_portal": {
      const customerId = await resolveCustomerId(userId);
      if (!customerId) return { text: UNLINKED_PORTAL_MSG("customer"), conf: 100 };
      const q: any = scoped(
        supabase
          .from("customer_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
      ).eq("customer_id", customerId);
      const { data: orders } = await q;
      const myOrders = (orders as any[]) ?? [];

      const asked = myOrders.find(
        (o: any) =>
          (o.order_number ?? "").toLowerCase().includes(topic) ||
          (o.product ?? "").toLowerCase().includes(topic),
      );
      if (asked) {
        return {
          text: `📦 **Order ${asked.order_number}**\n\n${toMarkdownTable(
            ["Field", "Value"],
            [
              ["Status", label(asked.status)],
              ["Product", asked.product ?? "—"],
              ["Quantity", String(asked.quantity ?? "—")],
              ["Priority", label(asked.priority)],
              ["Order Total", fmtMoney(Number(asked.order_total ?? 0))],
              ["Advance", label(asked.advance_payment_status)],
              ["Balance Due", fmtMoney(Number(asked.balance_due ?? 0))],
              [
                "Delivery Date",
                asked.delivery_date ? new Date(asked.delivery_date).toLocaleDateString() : "—",
              ],
            ],
          )}\n\nTrack it live in **Orders → Order Tracking**.`,
          conf: 97,
        };
      }
      if (myOrders.length === 0) {
        return {
          text: "You have **no orders yet**. Place your first order from the **Orders** tab — the company admin reviews it before production starts.",
          conf: 95,
        };
      }
      const open = myOrders.filter(
        (o: any) => !["delivered", "completed", "cancelled", "rejected"].includes(o.status),
      );
      const latest = myOrders[0];
      const tableRows = myOrders
        .slice(0, 6)
        .map((o: any) => [
          o.order_number ?? "ORD",
          o.product ?? "—",
          `${o.quantity ?? "—"}`,
          fmtMoney(Number(o.order_total ?? 0)),
          label(o.status),
          o.delivery_date ? new Date(o.delivery_date).toLocaleDateString() : "—",
        ]);
      return {
        text: `You have **${myOrders.length} order(s)**, ${open.length} currently open.\n\n${toMarkdownTable(
          ["Order #", "Product", "Qty", "Total", "Status", "Delivery"],
          tableRows,
        )}\n\nWant the status of a specific one? Just say the order number.`,
        conf: 96,
      };
    }

    case "supplier_portal": {
      const supplierId = await resolveSupplierId(userId);
      if (!supplierId) return { text: UNLINKED_PORTAL_MSG("supplier"), conf: 100 };
      const { data } = await scoped(
        supabase
          .from("purchase_orders")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(6),
      ).eq("supplier_id", supplierId);
      const pos = (data as any[]) ?? [];
      const open = pos.filter((p: any) => !["received", "fulfilled"].includes(p.status)).length;
      const tableRows = pos
        .slice(0, 6)
        .map((p: any) => [
          p.po_number ?? "PO",
          label(p.status),
          fmtMoney(Number(p.total_amount ?? 0)),
          p.due_date ? new Date(p.due_date).toLocaleDateString() : "—",
        ]);
      return {
        text: `You have **${pos.length} purchase order(s)** from this company, ${open} currently open.\n\n${toMarkdownTable(
          ["PO #", "Status", "Amount", "Due Date"],
          tableRows,
        )}\n\nAccept or modify POs in the **Purchase Orders** tab.`,
        conf: 94,
      };
    }

    case "production_manager": {
      const prodOrders = await listRows("production_orders", 8);
      const approved = await listRows("customer_orders", 8);
      const inProgress = prodOrders.filter((p: any) =>
        ["in_progress", "in-production"].includes(p.status),
      ).length;
      const tableRows = prodOrders
        .slice(0, 6)
        .map((p: any) => [
          p.order_number ?? p.id?.slice(0, 8),
          label(p.status),
          `${p.priority ?? "—"}`,
          `${p.progress ?? p.progress_percent ?? 0}%`,
        ]);
      return {
        text: `🏭 **Production**\n\nProduction orders: **${prodOrders.length}** (${inProgress} in progress). Approved ready to plan: **${approved.filter((s: any) => s.status === "approved").length}**.\n\n${toMarkdownTable(
          ["Order", "Status", "Priority", "Progress"],
          tableRows,
        )}\n\nStart production from **Approved Orders** → create production planning → the inventory auto-check runs.`,
        conf: 95,
      };
    }

    case "warehouse_manager": {
      const inv = await listRows("inventory", 8);
      const low = inv.filter((i: any) => {
        const onHand = Number(i.quantity ?? 0);
        const reserved = Number(i.reserved_quantity ?? 0);
        const quarantined = Number(i.quarantined_quantity ?? 0);
        const damaged = Number(i.damaged_qty ?? 0);
        const available = Math.max(0, onHand - reserved - quarantined - damaged);
        return available <= Number(i.reorder_level ?? 0);
      }).length;
      const shipments = await listRows("shipments", 5);
      const invRows = inv
        .slice(0, 6)
        .map((i: any) => {
          const onHand = Number(i.quantity ?? 0);
          const reserved = Number(i.reserved_quantity ?? 0);
          const quarantined = Number(i.quarantined_quantity ?? 0);
          const damaged = Number(i.damaged_qty ?? 0);
          const available = Math.max(0, onHand - reserved - quarantined - damaged);
          return [
            i.sku ?? i.product_name ?? i.id?.slice(0, 8),
            `${available}`,
            `${i.reorder_level ?? 0}`,
            available <= Number(i.reorder_level ?? 0) ? "⚠️ Low" : "OK",
          ];
        });
      const shipRows = shipments
        .slice(0, 5)
        .map((s: any) => [
          s.shipment_number ?? s.id?.slice(0, 8),
          s.carrier ?? "—",
          label(s.status),
        ]);
      return {
        text: `📦 **Warehouse**\n\nInventory SKUs: **${inv.length}** (${low} at/below reorder level). Shipments: **${shipments.length}**.\n\n${inv.length ? `**Inventory**\n\n${toMarkdownTable(["SKU / Product", "Available", "Reorder", "Status"], invRows)}\n\n` : ""}${shipments.length ? `**Shipments**\n\n${toMarkdownTable(["Shipment", "Carrier", "Status"], shipRows)}` : ""}\n\nManage stock in **Inventory**, dispatch in **Dispatch**.`,
        conf: 94,
      };
    }

    case "procurement_manager": {
      const pos = await listRows("purchase_orders", 8);
      const suppliers = await listRows("suppliers", 5);
      const open = pos.filter((p: any) => !["received", "fulfilled"].includes(p.status)).length;
      const poRows = pos
        .slice(0, 6)
        .map((p: any) => [
          p.po_number ?? "PO",
          label(p.status),
          fmtMoney(Number(p.total_amount ?? 0)),
        ]);
      const supRows = suppliers
        .slice(0, 5)
        .map((s: any) => [s.name ?? "—", label(s.status), `${s.rating ?? 0}`]);
      return {
        text: `📋 **Procurement**\n\nPurchase orders: **${pos.length}** (${open} open). Suppliers: **${suppliers.length}**.\n\n${toMarkdownTable(["PO #", "Status", "Amount"], poRows)}\n\n**Suppliers**\n\n${toMarkdownTable(["Name", "Status", "Rating"], supRows)}\n\nCreate POs in **Purchase Orders** — suppliers respond in real time.`,
        conf: 94,
      };
    }

    case "quality_inspector": {
      const insp = await listRows("quality_inspections", 8);
      const passed = insp.filter((i: any) => ["pass", "passed"].includes(i.result)).length;
      const tableRows = insp
        .slice(0, 6)
        .map((i: any) => [
          i.inspection_number ?? i.id?.slice(0, 8),
          label(i.result),
          `${i.defects_found ?? 0}`,
        ]);
      return {
        text: `✅ **Quality**\n\nInspections: **${insp.length}** (${passed} passed).\n\n${toMarkdownTable(
          ["Inspection #", "Result", "Defects"],
          tableRows,
        )}\n\nPassed batches release as finished goods; failures route back to production with rejection notes.`,
        conf: 94,
      };
    }

    case "maintenance_engineer": {
      const machines = await listRows("machines", 8);
      const down = machines.filter((m: any) => ["down", "maintenance"].includes(m.status)).length;
      const tableRows = machines
        .slice(0, 6)
        .map((m: any) => [m.name ?? "—", m.code ?? "—", label(m.status)]);
      return {
        text: `🔧 **Maintenance**\n\nMachines: **${machines.length}** (${down} down/in maintenance).\n\n${toMarkdownTable(
          ["Machine", "Code", "Status"],
          tableRows,
        )}\n\nFlag machines "under maintenance" to block new work-order assignment.`,
        conf: 94,
      };
    }

    case "finance_manager": {
      const invoices = await listRows("invoices", 8);
      const outstanding = invoices.filter((i: any) =>
        ["pending", "partial", "unpaid"].includes(i.status),
      ).length;
      const totalOut = invoices.reduce((s: number, i: any) => s + Number(i.total_amount ?? 0), 0);
      const tableRows = invoices
        .slice(0, 6)
        .map((i: any) => [
          i.invoice_number ?? "INV",
          label(i.status),
          fmtMoney(Number(i.total_amount ?? 0)),
        ]);
      return {
        text: `💰 **Finance**\n\nInvoices: **${invoices.length}** (${outstanding} outstanding). Outstanding value: **${fmtMoney(totalOut)}**.\n\n${toMarkdownTable(
          ["Invoice", "Status", "Amount"],
          tableRows,
        )}\n\nInvoices auto-generate at dispatch-ready; balance due = order total minus advance paid.`,
        conf: 95,
      };
    }

    case "hr_manager": {
      const employees = await listRows("employees", 6);
      const tableRows = employees.map((e: any) => [
        e.full_name ?? e.name ?? "—",
        e.department ?? "—",
        label(e.status),
      ]);
      return {
        text: `👥 **HR**\n\nEmployees on record: **${employees.length}**.\n\n${toMarkdownTable(
          ["Name", "Department", "Status"],
          tableRows,
        )}\n\nManage records in **Employees** — onboarding and department assignments flow to Company Admin for whitelist approval.`,
        conf: 92,
      };
    }

    case "production_operator": {
      let wos: any[] = [];
      if (userId) {
        const { data } = (await scoped(
          supabase
            .from("work_orders")
            .select("*")
            .order("created_at", { ascending: false })
            .limit(8),
        ).eq("operator_id" as never, userId)) as any;
        wos = (data as any[]) ?? [];
      }
      if (!userId) {
        return {
          text: "I can't identify your operator account right now, so I won't show any work orders. Try signing out and back in.",
          conf: 100,
        };
      }
      if (wos.length === 0) {
        return {
          text: "🔧 You have **no work orders assigned** right now. Your Production Manager assigns them — they'll appear here and in **Assigned Work Orders** the moment they do.",
          conf: 96,
        };
      }
      const tableRows = wos
        .slice(0, 6)
        .map((w: any) => [
          w.wo_number ?? "WO",
          label(w.status),
          `${w.progress_percent ?? w.progress ?? 0}%`,
        ]);
      return {
        text: `🔧 **Your Work Orders**\n\nAssigned to you: **${wos.length}**.\n\n${toMarkdownTable(
          ["WO #", "Status", "Progress"],
          tableRows,
        )}\n\nUpdate progress (25/50/75/100%) — it pushes live to the customer's tracking page.`,
        conf: 94,
      };
    }

    case "company_admin": {
      const [pendingApproval, prodOrders, machines, lowStock, employees, customers, materialReq] =
        await Promise.all([
          countWhere("customer_orders", "status", "pending_approval"),
          countWhere("production_orders", "status", "in_progress"),
          countWhere("machines", "status", "operational"),
          countWhere("inventory", "status", "low_stock"),
          countWhere("employees", "company_id", companyId ?? ""),
          countWhere("customers", "company_id", companyId ?? ""),
          countWhere("customer_requests", "status", "pending"),
        ]);
      const tableRows = [
        ["Orders pending approval", String(pendingApproval)],
        ["Customer requests pending", String(materialReq)],
        ["Production in progress", String(prodOrders)],
        ["Machines operational", String(machines)],
        ["Employees", String(employees)],
        ["Customers", String(customers)],
      ];
      return {
        text: `📊 **Company Overview**\n\n${toMarkdownTable(["Metric", "Count"], tableRows)}\n\nReview pending items in **Order Approvals** and **Customer Requests** (bolded in your sidebar).`,
        conf: 96,
      };
    }

    case "root_super_admin": {
      const [companies, registrations, approved] = await Promise.all([
        countWhere("companies", "status", "active"),
        countWhere("company_registrations", "status", "pending"),
        countWhere("company_registrations", "status", "approved"),
      ]);
      const tableRows = [
        ["Active companies", String(companies)],
        ["Pending registrations", String(registrations)],
        ["Approved registrations", String(approved)],
      ];
      return {
        text: `📋 **Platform Overview**\n\n${toMarkdownTable(["Metric", "Count"], tableRows)}\n\nApprove/reject requests in **Pending Requests**.`,
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
      const tableRows = [
        ["Audit events", String(audit)],
        ["Customer orders", String(orders)],
        ["Production orders", String(prod)],
        ["Machines", String(machines)],
      ];
      return {
        text: `📋 **Read-Only Overview**\n\n${toMarkdownTable(["Metric", "Count"], tableRows)}\n\nYou have read-only access to every module — drill into **Audit Logs**, **Reports**, and **Compliance**.`,
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
/*  DATA GATHERING — collect role-scoped context for Cerebras   */
/* ────────────────────────────────────────────────────────── */

/**
 * Gathers live data from Supabase based on the user's question and role.
 * Returns a structured text context string that Cerebras uses to ground its answer.
 * Only fetches data from tables the role is allowed to access.
 */
export interface RoleDataContext {
  text: string;
  /** Per-shape query outcomes: empty means the shape was not attempted or the
  * table genuinely had no rows. A non-empty entry means the query ran and
  * reported what happened, so the LLM can distinguish "no data" from "failed".
  */
  shapes: RoleDataShape[];
}

export interface RoleDataShape {
  table: string;
  label: string;
  /** Falsy means the shape had rows and was included in the context text.
  * A string means the shape was attempted but the data did not make it into
  * the context (true absence, or a query failure that was reported).
  */
  note?: string;
}

export async function gatherRoleData(
  role: string | null,
  companyId: string | null,
  userId: string | null,
  question: string,
  client?: ReturnType<typeof import("@supabase/supabase-js").createClient>,
): Promise<string> {
  const allowed = new Set(ROLE_DOMAIN_MAP[role ?? ""] ?? []);
  const parts: string[] = [];
  const shapes: RoleDataShape[] = [];
  const q = question.toLowerCase();
  const clientFor = client ?? supabase;

  // Helper to safely query a table. Some tables (e.g. inventory) have no
  // created_at column, so ordering is best-effort with an unordered retry.
  // The shape registry below records what each attempted query returned, so
  // the LLM can tell "no stock data" from "stock query failed".
  async function safeQuery(
    table: string,
    label: string,
    cols = "*",
    filters?: (q: any) => any,
  ): Promise<{ rows: any[]; note?: string }> {
    const run = async (ordered: boolean) => {
      let base = clientFor.from(table as never).select(cols);
      if (ordered) base = base.order("created_at", { ascending: false });
      let query = scoped(base.limit(8));
      if (filters) query = filters(query);
      const res = await query as { data: any; error?: { message: string } };
      if (res.error) throw new Error(res.error.message);
      return (res.data as any[]) ?? [];
    };
    try {
      const rows = await run(true);
      shapes.push({ table, label });
      return { rows };
    } catch (cause) {
      try {
        const rows = await run(false);
        shapes.push({ table, label });
        return { rows };
      } catch (cause2) {
        const msg =
          typeof cause2 === "object" && cause2 != null && "message" in cause2
            ? String((cause2 as any).message)
            : String(cause2);
        shapes.push({ table, label, note: `query error: ${msg}` });
        return { rows: [] };
      }
    }
  }

  // Detect which domains the question touches
  const mentions = (terms: string[]) => terms.some((t) => q.includes(t));

  // Build role-specific expertise header
  const roleExpertise: Record<string, string> = {
    root_super_admin:
      "PLATFORM ARCHITECT — platform-wide aggregates only: companies, registrations, approval counts",
    company_admin:
      "FACTORY OWNER — full cross-module visibility: orders, production, inventory, quality, maintenance, finance, HR, suppliers, customers, procurement, dispatch",
    plant_admin:
      "PLANT MANAGER — plant-level operations: production, inventory, quality, maintenance, machines, work orders, departments",
    plant_manager:
      "PLANT OVERSEER — day-to-day operations monitoring: production flow, inventory health, quality trends, machine status, order progress",
    production_manager:
      "PRODUCTION PLANNER — production orders, work orders, BOM, operator assignment, machine scheduling, quality feedback",
    production_operator: "PRODUCTION OPERATOR — own assigned work orders and machine status only",
    warehouse_manager:
      "WAREHOUSE GUARDIAN — inventory levels, SKU management, stock alerts, dispatch and shipments",
    procurement_manager:
      "PROCUREMENT STRATEGIST — purchase orders, supplier management, RFQ, material stock visibility",
    quality_inspector:
      "QUALITY EXERT — furniture QC parameters (moisture, joint tightness, surface finish), defect tracking, CAPA, inspection pass rates",
    maintenance_engineer:
      "MAINTENANCE EXPERT — machine health, breakdown diagnosis, preventive maintenance, spare parts, downtime analysis",
    finance_manager:
      "FINANCE STEWARD — invoices, payments, expenses, budgets, P&L, supplier payments, cash flow",
    hr_manager:
      "PEOPLE EXPERT — employee records, leave management, training, performance reviews, payroll, attendance, recruitment",
    customer_portal:
      "CUSTOMER SERVICE — own orders, shipments, invoices, payments, support tickets. Be helpful and transparent.",
    supplier_portal:
      "SUPPLIER PARTNER — own purchase orders, deliveries, invoices, payments. Professional and order-focused.",
    auditor:
      "COMPLIANCE AUDITOR — read-only cross-module analysis, audit trail, discrepancy detection, compliance monitoring",
  };
  const expertiseHeader = `ROLE: ${role ?? "unknown"}. ${roleExpertise[role ?? ""] ?? "General factory operations."}. You are a DOMAIN EXPERT for this role. Answer with specialized knowledge and precision. ALWAYS format data-driven responses as markdown tables with clear headers. NEVER fabricate numbers. Only use the data provided in the context.\n\n`;
  parts.unshift(expertiseHeader);

  // Customer portal — only their own orders
  if (role === "customer_portal") {
    const customerId = await resolveCustomerId(userId);
    if (customerId) {
      const { rows: orders } = await safeQuery(
        "customer_orders",
        "Customer Orders",
        "*",
        (query) => query.eq("customer_id", customerId),
      );
      if (orders.length) {
        parts.push(
          `YOUR ORDERS (${orders.length}):\n${orders.map((o: any) => `  ${o.order_number} | ${o.product} | Qty: ${o.quantity} | Status: ${o.status} | Total: ${fmtMoney(Number(o.order_total ?? 0))} | Delivery: ${o.delivery_date ?? "—"}`).join("\n")}`,
        );
      }
      const { rows: shipments } = await safeQuery(
        "shipments",
        "Shipments",
        "*",
        (query) => query.eq("customer_id", customerId),
      );
      if (shipments.length) {
        parts.push(
          `YOUR SHIPMENTS (${shipments.length}):\n${shipments.map((s: any) => `  ${s.shipment_number} | Status: ${s.status} | Carrier: ${s.carrier ?? "—"} | Tracking: ${s.tracking_number ?? "—"}`).join("\n")}`,
        );
      }
    }
  }
  // Supplier portal — only their own POs
  else if (role === "supplier_portal") {
    const supplierId = await resolveSupplierId(userId);
    if (supplierId) {
      const { rows: pos } = await safeQuery(
        "purchase_orders",
        "Purchase Orders",
        "*",
        (query) => query.eq("supplier_id", supplierId),
      );
      if (pos.length) {
        parts.push(
          `YOUR PURCHASE ORDERS (${pos.length}):\n${pos.map((p: any) => `  ${p.po_number} | Status: ${p.status} | Amount: ${fmtMoney(Number(p.total_amount ?? 0))}`).join("\n")}`,
        );
      }
    }
  }
  // Internal roles — gather from allowed domains
  else {
    if (allowed.has("orders") || mentions(["order", "customer order", "sales"])) {
      const { rows: orders } = await safeQuery("customer_orders", "Customer Orders");
      if (orders.length) {
        const pending = orders.filter((o: any) => o.status === "pending_approval").length;
        const inProd = orders.filter((o: any) => o.status === "in_production").length;
        parts.push(
          `CUSTOMER ORDERS (${orders.length} total, ${pending} pending approval, ${inProd} in production):\n${orders
            .slice(0, 5)
            .map(
              (o: any) =>
                `  ${o.order_number} | ${o.product} | Qty: ${o.quantity} | Status: ${o.status}`,
            )
            .join("\n")}`,
        );
      }
    }
    if (allowed.has("production") || mentions(["production", "work order", "manufacturing"])) {
      const { rows: prodOrders } = await safeQuery("production_orders", "Production Orders");
      const { rows: workOrders } = await safeQuery("work_orders", "Work Orders");
      if (prodOrders.length) {
        parts.push(
          `PRODUCTION ORDERS (${prodOrders.length}):\n${prodOrders
            .slice(0, 5)
            .map(
              (p: any) =>
                `  ${p.order_number} | Status: ${p.status} | Priority: ${p.priority} | Progress: ${p.progress ?? 0}%`,
            )
            .join("\n")}`,
        );
      }
      if (workOrders.length) {
        parts.push(
          `WORK ORDERS (${workOrders.length}):\n${workOrders
            .slice(0, 5)
            .map(
              (w: any) =>
                `  ${w.wo_number} | Status: ${w.status} | Progress: ${w.progress_percent ?? 0}%`,
            )
            .join("\n")}`,
        );
      }
    }
    if (allowed.has("inventory") || mentions(["inventory", "stock", "warehouse"])) {
      const { rows: inv } = await safeQuery("inventory", "Inventory");
      if (inv.length) {
        parts.push(
          `INVENTORY (${inv.length} items):\n${inv
            .slice(0, 5)
            .map((i: any) => {
              const onHand = Number(i.quantity ?? 0);
              const reserved = Number(i.reserved_quantity ?? 0);
              const quarantined = Number(i.quarantined_quantity ?? 0);
              const damaged = Number(i.damaged_qty ?? 0);
              const available = Math.max(0, onHand - reserved - quarantined - damaged);
              return `  ${i.product_id?.slice(0, 8)} | Available: ${available} | On-hand: ${onHand}`;
            })
            .join("\n")}`,
        );
      }
    }
    if (
      allowed.has("machines") ||
      allowed.has("maintenance") ||
      mentions(["machine", "maintenance"])
    ) {
      const { rows: machines } = await safeQuery("machines", "Machines");
      if (machines.length) {
        const down = machines.filter((m: any) => ["down", "maintenance"].includes(m.status));
        parts.push(
          `MACHINES (${machines.length} total, ${down.length} down/in maintenance):\n${machines
            .slice(0, 5)
            .map((m: any) => `  ${m.name} | Code: ${m.code} | Status: ${m.status}`)
            .join("\n")}`,
        );
      }
    }
    if (allowed.has("quality") || mentions(["quality", "inspection", "defect"])) {
      const { rows: insp } = await safeQuery("quality_inspections", "Quality Inspections");
      if (insp.length) {
        parts.push(
          `QUALITY INSPECTIONS (${insp.length}):\n${insp
            .slice(0, 5)
            .map(
              (i: any) =>
                `  ${i.inspection_number} | Result: ${i.result} | Defects: ${i.defects_found ?? 0}`,
            )
            .join("\n")}`,
        );
      }
    }
    if (allowed.has("finance") || mentions(["invoice", "payment", "finance"])) {
      const { rows: invoices } = await safeQuery("invoices", "Invoices");
      if (invoices.length) {
        parts.push(
          `INVOICES (${invoices.length}):\n${invoices
            .slice(0, 5)
            .map(
              (i: any) =>
                `  ${i.invoice_number} | Status: ${i.status} | Amount: ${fmtMoney(Number(i.total_amount ?? 0))}`,
            )
            .join("\n")}`,
        );
      }
    }
    if (allowed.has("suppliers") || mentions(["supplier", "purchase order", "procurement"])) {
      const { rows: pos } = await safeQuery("purchase_orders", "Purchase Orders");
      const { rows: suppliers } = await safeQuery("suppliers", "Suppliers");
      if (pos.length) {
        parts.push(
          `PURCHASE ORDERS (${pos.length}):\n${pos
            .slice(0, 5)
            .map(
              (p: any) =>
                `  ${p.po_number} | Status: ${p.status} | Amount: ${fmtMoney(Number(p.total_amount ?? 0))}`,
            )
            .join("\n")}`,
        );
      }
      if (suppliers.length) {
        parts.push(
          `SUPPLIERS (${suppliers.length}):\n${suppliers
            .slice(0, 5)
            .map((s: any) => `  ${s.name} | Status: ${s.status} | Rating: ${s.rating ?? 0}`)
            .join("\n")}`,
        );
      }
    }
    if (
      allowed.has("hr") ||
      allowed.has("attendance") ||
      mentions(["employee", "hr", "attendance"])
    ) {
      const { rows: employees } = await safeQuery("employees", "Employees");
      if (employees.length) {
        parts.push(
          `EMPLOYEES (${employees.length}):\n${employees
            .slice(0, 5)
            .map(
              (e: any) => `  ${e.full_name} | Dept: ${e.department ?? "—"} | Status: ${e.status}`,
            )
            .join("\n")}`,
        );
      }
    }
    if (allowed.has("dispatch") || mentions(["shipment", "dispatch", "delivery"])) {
      const { rows: shipments } = await safeQuery("shipments", "Shipments");
      if (shipments.length) {
        parts.push(
          `SHIPMENTS (${shipments.length}):\n${shipments
            .slice(0, 5)
            .map(
              (s: any) =>
                `  ${s.shipment_number} | Status: ${s.status} | Carrier: ${s.carrier ?? "—"}`,
            )
            .join("\n")}`,
        );
      }
    }
    if (allowed.has("products") || mentions(["product", "catalog"])) {
      const { rows: products } = await safeQuery("products", "Products");
      if (products.length) {
        parts.push(
          `PRODUCTS (${products.length}):\n${products
            .slice(0, 5)
            .map(
              (p: any) =>
                `  ${p.name} | SKU: ${p.sku} | Price: ${fmtMoney(Number(p.unit_price ?? 0))}`,
            )
            .join("\n")}`,
        );
      }
    }
    if (allowed.has("company") || allowed.has("companies") || allowed.has("plants") || mentions(["company", "plant", "registered", "about", "who"])) {
      const { rows: cos } = await safeQuery("companies", "Company Profile");
      const { rows: plants } = await safeQuery("plants", "Plants");
      if (cos.length) {
        const co = cos[0];
        parts.push(`COMPANY PROFILE:\n  Name: ${co.name} (${co.legal_name || co.name}) | Industry: ${co.industry || "Custom Furniture Manufacturing"} | Country: ${co.country || "USA"} | Status: ${co.status}`);
      }
      if (plants.length) {
        parts.push(`PLANTS (${plants.length}):\n${plants.slice(0, 5).map((p: any) => `  ${p.name} (Code: ${p.code}) | Location: ${p.city || "Main Campus"} | Status: ${p.status}`).join("\n")}`);
      }
    }
    if (role === "root_super_admin") {
      const { rows: companies } = await safeQuery("companies", "Companies");
      const { rows: registrations } = await safeQuery("company_registrations", "Registrations");
      if (companies.length) {
        parts.push(
          `COMPANIES (${companies.length}):\n${companies.map((c: any) => `  ${c.name} | Status: ${c.status}`).join("\n")}`,
        );
      }
      if (registrations.length) {
        parts.push(
          `REGISTRATIONS (${registrations.length}):\n${registrations.map((r: any) => `  ${r.company_name} | Status: ${r.status} | Email: ${r.email}`).join("\n")}`,
        );
      }
    }
    if (role === "company_admin") {
      // Company admin gets a broader picture
      const { rows: employees } = await safeQuery("employees", "Employees");
      const { rows: customers } = await safeQuery("customers", "Customers");
      if (employees.length) parts.push(`EMPLOYEES: ${employees.length} total`);
      if (customers.length) parts.push(`CUSTOMERS: ${customers.length} total`);
    }
  }

  // If we attempted shapes but every one reported a problem, tell the LLM
  // explicitly so it can distinguish "no data" from "query failed".
  if (shapes.length && shapes.every((s) => s.note)) {
    parts.unshift(
      `DATA NOTE: I tried to load the following but the queries did not return data: ${shapes.map((s) => `${s.label} (${s.note})`).join(", ")}.`,
    );
  }

  if (parts.length === 0) {
    return `No specific data found for this question in your role's scope. Your allowed domains: ${getAllowedLabels(role).join(", ")}.`;
  }

  return parts.join("\n\n");
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

  if (
    intent === "greeting" ||
    intent === "thanks" ||
    intent === "farewell" ||
    intent === "whoami" ||
    intent === "howareyou"
  ) {
    return { text: socialReply(intent, role), conf: 100 };
  }

  if (intent === "help") {
    const allowed = getAllowedLabels(role);
    const examples = pick([
      'Try: "what\'s the status of my orders?", "show production", "any low stock?"',
      'You could ask: "latest invoice?", "machines that need maintenance?", "open purchase orders"',
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

  // 3.5. General-knowledge / out-of-scope detection: if the question doesn't
  //      touch ANY manufacturing domain keyword AND isn't a known social/action
  //      intent, it's likely a general-knowledge question (sandwich, weather,
  //      cricket, jokes, etc.). Decline politely with role context.
  if (intent === "data" || intent === "howto") {
    const manufacturingTerms = [
      "order",
      "production",
      "inventory",
      "stock",
      "warehouse",
      "machine",
      "quality",
      "inspection",
      "defect",
      "invoice",
      "payment",
      "supplier",
      "customer",
      "shipment",
      "dispatch",
      "delivery",
      "employee",
      "hr",
      "finance",
      "budget",
      "revenue",
      "purchase",
      "procurement",
      "rfq",
      "work order",
      "batch",
      "oee",
      "throughput",
      "maintenance",
      "repair",
      "product",
      "sku",
      "catalog",
      "bom",
      "attendance",
      "payroll",
      "leave",
      "training",
      "yield",
      "ncr",
      "capa",
      "reorder",
      "approved",
      "pending",
      "status",
      "report",
      "dashboard",
      "overview",
      "summary",
      "metric",
      "kpi",
      "performance",
      "operations",
      "plant",
      "factory",
      "manufacturing",
      "company",
      "registered",
      "about",
      "profile",
      "address",
      "facility",
      "facilities",
      "who",
      "catalog",
      "items",
      "item",
    ];
    const isManufacturingRelated = manufacturingTerms.some((t) => lower.includes(t));
    if (!isManufacturingRelated) {
      const roleName = ROLE_LABELS[role ?? ""] ?? "your role";
      const allowed = getAllowedLabels(role);
      return {
        text: `I'm scoped to **${roleName}** data — I can help with ${allowed.slice(0, 4).join(", ")}${allowed.length > 4 ? " and more" : ""}.

For general questions like this, a general-purpose assistant would be a better fit. I'm built specifically for your FactoryOS manufacturing data.

Try asking me something like:
• "Give me a company overview"
• "Show my pending orders"
• "Any low stock items?"`,
        conf: 100,
      };
    }
  }

  // 3. Entity lookup FIRST — a named code (SO-2026-0001, WO-0042, PO-1234) is
  //    more specific than math or the generic role summary. The regex requires
  //    a code prefix so words like "production" never match.
  const entityMatch = question.match(
    /\b(?:N-08|SO|WO|PO|PR|INV|PUR|ORD|RFQ)[-\s]*[\w.-]*\d[\w.-]*\b/i,
  );
  if (
    entityMatch &&
    (intent === "data" ||
      intent === "math" ||
      /status|where|track|find|check|about|detail/.test(lower))
  ) {
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

  // 4.5 Precision step (Bug 4 fix): a named-material stock question returns the
  //    REAL live quantity from the inventory table — never a generic rollup.
  if (
    intent === "data" &&
    (role === "warehouse_manager" ||
      role === "procurement_manager" ||
      role === "company_admin" ||
      role === "plant_manager" ||
      role === "auditor")
  ) {
    const specific = await materialStockAnswer(lower);
    if (specific) return { text: specific, conf: 96 };
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

  // 6. Gather role-scoped live data and route through the server LLM
  //    gateway (Groq primary, Cerebras fallback, keys + scope server-side).
  try {
    const dataContext = await gatherRoleData(role, companyId, userId, lower);

    if (hasGroqKey()) {
      const groqResult = await askGroq({
        question,
        role: role ?? "company_admin",
        dataContext,
        history,
      });
      if (groqResult) {
        return { text: groqResult.text, conf: 95 };
      }
    }

    // Fallback to Cerebras
    const cerebrasResult = await askCerebras({
      question,
      role: role ?? "company_admin",
      dataContext,
      history,
    });
    if (cerebrasResult) {
      return { text: cerebrasResult.text, conf: 95 };
    }

    // Fallback to local engine if both providers unavailable
    return await roleDataAnswer(role, companyId, userId, lower);
  } catch {
    // If both providers fail, fall back to local engine
    try {
      return await roleDataAnswer(role, companyId, userId, lower);
    } catch {
      return {
        text: "I hit an error fetching live data. Please try again — or open the relevant module tab to see the data directly.",
        conf: 70,
      };
    }
  }
}

/**
 * Streaming variant of answerCopilot. Calls onToken(chunk) for each token
 * from Cerebras, then returns the full answer. Falls back to local engine
 * if Cerebras is unavailable.
 */
export async function answerCopilotStream(opts: {
  question: string;
  role: string | null;
  companyId: string | null;
  userId?: string | null;
  history?: CopilotTurn[];
  onToken: (chunk: string) => void;
}): Promise<CopilotAnswer> {
  const { onToken, ...rest } = opts;
  const { question, role, companyId, userId = null, history = [] } = rest;
  const lower = question.toLowerCase();

  // Same gating as answerCopilot: social, scope, entity lookup all apply
  _scopeCompanyId = role === "root_super_admin" ? null : companyId;

  const { intent, payload } = detectIntent(question);
  if (intent === "whichrole") return { text: getRoleIdentityCard(role), conf: 100 };
  if (intent === "action") {
    const readOnly = isReadOnlyRole(role);
    return {
      text: readOnly
        ? `🚫 Your **${ROLE_LABELS[role ?? ""] ?? "role"}** access is strictly read-only.`
        : `I'm advisory only — I read live data and guide you, but I never create, edit, approve or delete records on your behalf.`,
      conf: 100,
    };
  }
  if (["greeting", "thanks", "farewell", "whoami", "howareyou"].includes(intent)) {
    return { text: socialReply(intent, role), conf: 100 };
  }
  if (intent === "help") {
    const allowed = getAllowedLabels(role);
    return {
      text: `I'm your **role-scoped** data assistant. I can answer with live numbers about: **${allowed.join(", ")}**.`,
      conf: 100,
    };
  }
  if (role && role !== "root_super_admin" && !companyId) {
    return {
      text: "🔒 I can't determine which company your account belongs to, so I won't return any data.",
      conf: 100,
    };
  }
  const blockedDomain = checkRoleScope(role, question);
  if (blockedDomain) {
    const domainLabel = DOMAIN_LABELS[blockedDomain] ?? blockedDomain;
    return {
      text: `🚫 **Access Restricted** — you asked about **${domainLabel}**, which is outside your role's scope.`,
      conf: 100,
    };
  }

  // Out-of-scope detection for streaming variant
  if (intent === "data" || intent === "howto") {
    const manufacturingTerms = [
      "order",
      "production",
      "inventory",
      "stock",
      "warehouse",
      "machine",
      "quality",
      "inspection",
      "defect",
      "invoice",
      "payment",
      "supplier",
      "customer",
      "shipment",
      "dispatch",
      "delivery",
      "employee",
      "hr",
      "finance",
      "budget",
      "revenue",
      "purchase",
      "procurement",
      "rfq",
      "work order",
      "batch",
      "oee",
      "throughput",
      "maintenance",
      "repair",
      "product",
      "sku",
      "catalog",
      "bom",
      "attendance",
      "payroll",
      "leave",
      "training",
      "yield",
      "ncr",
      "capa",
      "reorder",
      "approved",
      "pending",
      "status",
      "report",
      "dashboard",
      "overview",
      "summary",
      "metric",
      "kpi",
      "performance",
      "operations",
      "plant",
      "factory",
      "manufacturing",
      "company",
      "registered",
      "about",
      "profile",
      "address",
      "facility",
      "facilities",
      "who",
      "catalog",
      "items",
      "item",
    ];
    const isManufacturingRelated = manufacturingTerms.some((t) => lower.includes(t));
    if (!isManufacturingRelated) {
      const roleName = ROLE_LABELS[role ?? ""] ?? "your role";
      const allowed = getAllowedLabels(role);
      return {
        text: `I'm scoped to **${roleName}** data — I can help with ${allowed.slice(0, 4).join(", ")}${allowed.length > 4 ? " and more" : ""}.

For general questions like this, a general-purpose assistant would be a better fit. I'm built specifically for your FactoryOS manufacturing data.

Try asking me something like:
• "Give me a company overview"
• "Show my pending orders"
• "Any low stock items?"`,
        conf: 100,
      };
    }
  }

  // Try Groq streaming first (primary), then Cerebras (fallback)
  try {
    const dataContext = await gatherRoleData(role, companyId, userId, lower);

    // Try Groq streaming first (primary provider)
    if (hasGroqKey()) {
      const groqResult = await askGroqStream({
        question,
        role: role ?? "company_admin",
        dataContext,
        history,
        onToken,
      });
      if (groqResult) {
        return { text: groqResult.text, conf: 95 };
      }
    }

    // Fallback to Cerebras streaming
    const cerebrasResult = await askCerebrasStream({
      question,
      role: role ?? "company_admin",
      dataContext,
      history,
      onToken,
    });
    if (cerebrasResult) {
      return { text: cerebrasResult.text, conf: 95 };
    }

    // Fallback: collect tokens from local engine (non-streaming, but show at once)
    return await roleDataAnswer(role, companyId, userId, lower);
  } catch {
    try {
      return await roleDataAnswer(role, companyId, userId, lower);
    } catch {
      return {
        text: "I hit an error fetching live data. Please try again.",
        conf: 70,
      };
    }
  }
}
