/**
 * copilot-llm.server.ts — Server-side LLM gateway for the AI Copilot.
 *
 * ONE owner for provider calls: keeps both API keys server-side (they are
 * never shipped to the client bundle), authenticates the caller from their
 * Supabase JWT, resolves the caller's role and company from the database
 * (never from client-supplied input), enforces the role-scope gate again
 * server-side, and only then calls Groq (primary) with Cerebras as
 * automatic fallback.
 *
 * The client never chooses its role for authorization purposes — the role
 * argument sent by the UI is treated as a display hint only and is ignored
 * whenever it disagrees with the database.
 */
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { ROLE_SYSTEM_PROMPTS, SCOPE_RULE } from "@/lib/llm-prompts";
import { checkRoleScope, getAllowedLabels, DOMAIN_LABELS } from "@/lib/role-scope";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "gpt-oss-120b";

export interface CopilotLlmRequest {
  question: string;
  /** Display hint from the UI — verified against the DB before use. */
  roleHint?: string | null;
  companyIdHint?: string | null;
  dataContext?: string;
  history?: Array<{ role: "user" | "ai"; text: string }>;
  /**
   * The caller's Supabase access token. Identity is NEVER taken from a
   * client-supplied userId — the token is cryptographically verified with
   * the auth server (a forged token fails verification) and the role and
   * company are then read from the database, not from this payload.
   */
  accessToken: string;
}

export interface CopilotLlmResponse {
  text: string;
  model: string;
  provider: "groq" | "cerebras";
  /** Server-verified role/company actually used for scoping. */
  role: string;
  companyId: string | null;
  scopeBlocked?: { domain: string; label: string; allowed: string[] };
  error?: string;
}

function getGroqKey(): string | null {
  return (
    process.env.GROQ_API_KEY ??
    process.env.VITE_GROQ_API_KEY ??
    import.meta.env.VITE_GROQ_API_KEY ??
    null
  );
}

function getCerebrasKey(): string | null {
  return (
    process.env.CEREBRAS_API_KEY ??
    process.env.VITE_CEREBRAS_API_KEY ??
    import.meta.env.VITE_CEREBRAS_API_KEY ??
    null
  );
}

/** Build the OpenAI-style message array for a verified role. */
function buildMessages(opts: {
  question: string;
  role: string;
  dataContext?: string;
  history?: Array<{ role: "user" | "ai"; text: string }>;
}): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const { question, role, dataContext, history = [] } = opts;
  const systemPrompt = ROLE_SYSTEM_PROMPTS[role] ?? ROLE_SYSTEM_PROMPTS.company_admin;

  const contextParts: string[] = [];
  if (dataContext) {
    contextParts.push(`LIVE DATA CONTEXT (from FactoryOS database):\n${dataContext}`);
  }
  contextParts.push(
    `\nCurrent role: ${role.replace(/_/g, " ")}. Answer ONLY within this role's scope.`,
    SCOPE_RULE,
    `If you don't have enough data to answer precisely, say so — never guess or fabricate numbers.`,
    `Keep answers concise. Format all data-driven responses as markdown tables with headers. Use format: | Column1 | Column2 | ...`,
    `Always ground answers in the data provided in context.`,
  );

  const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: systemPrompt },
    { role: "system", content: contextParts.join("\n") },
  ];

  for (const turn of history.slice(-6)) {
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text,
    });
  }
  messages.push({ role: "user", content: question });
  return messages;
}

async function callOpenAiCompatible(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>,
): Promise<string | null> {
  const res = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 1024,
      temperature: 0.3,
    }),
  });
  if (!res.ok) {
    console.warn(`[copilot-llm] ${model} returned ${res.status}`);
    return null;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

/**
 * The single server function the copilot calls for LLM answers.
 * Auth + role resolution + scope enforcement happen here, server-side.
 */
export const askCopilotLlm = createServerFn({ method: "POST" })
  .validator((d: unknown) => {
    const req = d as CopilotLlmRequest;
    if (!req || typeof req.question !== "string" || !req.question.trim()) {
      throw new Error("Invalid request");
    }
    return req;
  })
  .handler(async ({ data }): Promise<CopilotLlmResponse> => {
    // 1. Authenticate: verify the caller's JWT with the auth server.
    //    Identity cannot be forged — a tampered or stale token is rejected.
    const token = data.accessToken;
    if (!token) {
      return { text: "", model: "", provider: "groq", role: "", companyId: null, error: "unauthenticated" };
    }

    const url =
      process.env.SUPABASE_URL ??
      process.env.VITE_SUPABASE_URL ??
      import.meta.env.VITE_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) {
      return { text: "", model: "", provider: "groq", role: "", companyId: null, error: "server-config" };
    }
    const admin = createClient(url, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: authErr } = await admin.auth.getUser(token);
    if (authErr || !userData?.user) {
      return { text: "", model: "", provider: "groq", role: "", companyId: null, error: "unauthenticated" };
    }
    const userId = userData.user.id;

    // 2. Resolve role + company from the DB (service role bypasses RLS so the
    //    gate below is authoritative, not dependent on the caller's policies).
    const { data: roleRows } = await admin
      .from("user_roles")
      .select("role,company_id")
      .eq("user_id", userId);
    const { data: profile } = await admin
      .from("profiles")
      .select("company_id")
      .eq("id", userId)
      .maybeSingle();

    const dbRoles: string[] = (roleRows ?? []).map((r) => r.role as string);
    const role = dbRoles.includes(data.roleHint ?? "") ? (data.roleHint as string) : (dbRoles[0] ?? null);
    const companyId =
      role === "root_super_admin"
        ? null
        : (profile?.company_id ?? (roleRows ?? []).find((r) => r.company_id)?.company_id ?? null);

    if (!role) {
      return { text: "", model: "", provider: "groq", role: "", companyId: null, error: "no-role" };
    }
    // A company role must have a resolvable company to be scoped at all.
    if (role !== "root_super_admin" && !companyId) {
      return { text: "", model: "", provider: "groq", role, companyId: null, error: "no-company" };
    }

    // 3. Server-side scope gate — the same rules as the client, enforced
    //    where they can't be bypassed.
    const blockedDomain = checkRoleScope(role, data.question);
    if (blockedDomain) {
      return {
        text: "",
        model: "",
        provider: "groq",
        role,
        companyId,
        scopeBlocked: {
          domain: blockedDomain,
          label: DOMAIN_LABELS[blockedDomain] ?? blockedDomain,
          allowed: getAllowedLabels(role),
        },
      };
    }

    // 4. Build messages and call Groq first, then Cerebras.
    const messages = buildMessages({
      question: data.question,
      role,
      dataContext: data.dataContext,
      history: data.history,
    });

    const groqKey = getGroqKey();
    if (groqKey) {
      try {
        const text = await callOpenAiCompatible(GROQ_API_URL, groqKey, GROQ_MODEL, messages);
        if (text) return { text, model: GROQ_MODEL, provider: "groq", role, companyId };
      } catch (err) {
        console.warn("[copilot-llm] Groq request failed", err);
      }
    }

    const cerebrasKey = getCerebrasKey();
    if (cerebrasKey) {
      try {
        const text = await callOpenAiCompatible(CEREBRAS_API_URL, cerebrasKey, CEREBRAS_MODEL, messages);
        if (text) return { text, model: CEREBRAS_MODEL, provider: "cerebras", role, companyId };
      } catch (err) {
        console.warn("[copilot-llm] Cerebras request failed", err);
      }
    }

    return { text: "", model: "", provider: "groq", role, companyId, error: "no-provider" };
  });

/** Server-side provider health check (keys never leave the server). */
export const checkCopilotProviderHealth = createServerFn({ method: "POST" }).handler(
  async (): Promise<{ groq: { connected: boolean; message: string }; cerebras: { connected: boolean; message: string } }> => {
    async function ping(apiUrl: string, key: string | null, label: string) {
      if (!key) return { connected: false, message: "API key not configured" };
      try {
        const res = await fetch(apiUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ model: label === "groq" ? GROQ_MODEL : CEREBRAS_MODEL, messages: [{ role: "user", content: "Hi" }], max_tokens: 5 }),
        });
        if (res.ok) return { connected: true, message: "Connected" };
        const data = await res.json().catch(() => ({}));
        const msg = (data as { message?: string })?.message ?? `HTTP ${res.status}`;
        if (res.status === 402) return { connected: false, message: "No credits — add billing" };
        return { connected: false, message: msg };
      } catch {
        return { connected: false, message: "Network error" };
      }
    }
    const groq = await ping(GROQ_API_URL, getGroqKey(), "groq");
    const cerebras = await ping(CEREBRAS_API_URL, getCerebrasKey(), "cerebras");
    return { groq, cerebras };
  },
);
