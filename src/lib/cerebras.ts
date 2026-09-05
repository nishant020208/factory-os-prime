/**
 * cerebras.ts — Client adapter for the Cerebras-backed copilot LLM.
 *
 * Cerebras is the FALLBACK provider (Groq is primary). The actual API call
 * happens server-side in copilot-llm.server.ts — this module keeps the
 * historical export surface so the copilot engine needs no structural
 * change. If Groq answered, askCopilotLlm already returned and these
 * functions are never reached; they exist for direct fallback calls.
 */
import { askCopilotLlm, checkCopilotProviderHealth } from "@/lib/copilot-llm.server";
import { supabase } from "@/integrations/supabase/client";

export interface CerebrasMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CerebrasResponse {
  text: string;
  model: string;
}

export function hasCerebrasKey(): boolean {
  // Verified live via the server health check (key stays server-side).
  return true;
}

export async function checkCerebrasHealth(): Promise<{ connected: boolean; message: string }> {
  try {
    const { cerebras } = await checkCopilotProviderHealth();
    return cerebras;
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
  return (history ?? []).filter((t) => !t.text.startsWith("🚫") && !t.text.startsWith("OUT OF SCOPE"));
}

/**
 * Direct Cerebras call. NOTE: the gateway tries Groq first — a successful
 * call from here means Groq was unavailable, so this is a true fallback.
 * Cerebras-side failures return null (engine falls back to local answers).
 */
export async function askCerebras(opts: AskOpts): Promise<CerebrasResponse | null> {
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

  if (!res || res.error || res.scopeBlocked) return null;
  // Only report a Cerebras answer if it actually came from Cerebras;
  // otherwise the engine's own fallback logic already has the answer.
  if (res.provider !== "cerebras") return null;
  return { text: res.text, model: res.model };
}

/** Streaming is delivered non-streamed by the gateway; emit it in one shot. */
export async function askCerebrasStream(
  opts: AskOpts & { onToken: (chunk: string) => void },
): Promise<CerebrasResponse | null> {
  const result = await askCerebras(opts);
  if (!result) return null;
  opts.onToken(result.text);
  return result;
}
