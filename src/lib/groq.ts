/**
 * groq.ts — Client adapter for the Groq-backed copilot LLM.
 *
 * Groq is the PRIMARY provider. The actual API call happens server-side in
 * copilot-llm.server.ts (which owns the API key, the caller's verified role
 * and the scope gate). This module keeps the historical export surface
 * (askGroq / askGroqStream / hasGroqKey / checkGroqHealth) so the copilot
 * engine needs no structural change.
 */
import { askCopilotLlm, checkCopilotProviderHealth } from "@/lib/copilot-llm.server";
import { supabase } from "@/integrations/supabase/client";
import { getBlockMessage } from "@/lib/role-scope";

export interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GroqResponse {
  text: string;
  model: string;
}

export function hasGroqKey(): boolean {
  // The key lives server-side now; presence is verified live via the
  // health check. Report true so the engine still routes Groq-first —
  // the server falls back to Cerebras automatically when Groq is down.
  return true;
}

export async function checkGroqHealth(): Promise<{ connected: boolean; message: string }> {
  try {
    const { groq } = await checkCopilotProviderHealth();
    return groq;
  } catch {
    return { connected: false, message: "Server unreachable" };
  }
}

type AskOpts = {
  question: string;
  role: string;
  dataContext?: string;
  history?: Array<{ role: "user" | "ai"; text: string }>;
};

function sanitize(
  history?: Array<{ role: "user" | "ai"; text: string }>,
): Array<{ role: "user" | "ai"; text: string }> {
  // Out-of-scope / system replies must not leak into provider history.
  return (history ?? []).filter((t) => !t.text.startsWith("🚫") && !t.text.startsWith("OUT OF SCOPE"));
}

/** Send a question through the server gateway (Groq primary, Cerebras fallback). */
export async function askGroq(opts: AskOpts): Promise<GroqResponse | null> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;
  if (!token) return null;

  const res = await askCopilotLlm({
    data: {
      question: opts.question,
      roleHint: opts.role,
      dataContext: opts.dataContext,
      history: sanitize(opts.history),
      accessToken: token,
    },
  }).catch(() => null);

  if (!res || res.error) return null;

  // The server's scope decision is authoritative — render it as the
  // explicit OUT OF SCOPE refusal.
  if (res.scopeBlocked) {
    const allowed = res.scopeBlocked.allowed.join(", ");
    return {
      text: `🚫 **OUT OF SCOPE** — you asked about **${res.scopeBlocked.label}**, which is outside your role's scope.\n\n${getBlockMessage(opts.role)}\n\nYour role has access to: ${allowed}`,
      model: "scope-gate",
    };
  }
  return { text: res.text, model: res.model };
}

/** Streaming is delivered non-streamed by the gateway; emit it in one shot. */
export async function askGroqStream(
  opts: AskOpts & { onToken: (chunk: string) => void },
): Promise<GroqResponse | null> {
  const result = await askGroq(opts);
  if (!result) return null;
  opts.onToken(result.text);
  return result;
}
