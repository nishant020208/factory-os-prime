/**
 * src/lib/ollama.ts — Local Ollama LLM provider client & health detector.
 *
 * Checks if Ollama is running locally on the developer's laptop (e.g. http://localhost:11434).
 * If available, executes chat completions with a timeout guard.
 * If offline or running in cloud (Vercel), fails silently so the system immediately
 * falls back to Groq / Cerebras without errors.
 */

export interface OllamaConfig {
  baseUrl: string;
  apiUrl: string;
  openaiUrl: string;
  model: string;
  enabled: boolean;
}

export function getOllamaConfig(): OllamaConfig {
  const isBrowser = typeof window !== "undefined";
  const env: any = isBrowser ? (import.meta as any).env : process.env;

  const baseUrl =
    env?.VITE_OLLAMA_BASE_URL ??
    env?.OLLAMA_BASE_URL ??
    "http://localhost:11434";

  const apiUrl =
    env?.VITE_OLLAMA_API_URL ??
    env?.OLLAMA_API_URL ??
    `${baseUrl}/api`;

  const openaiUrl =
    env?.VITE_OLLAMA_OPENAI_URL ??
    env?.OLLAMA_OPENAI_URL ??
    `${baseUrl}/v1`;

  const model =
    env?.VITE_AI_MODEL ??
    env?.OLLAMA_MODEL ??
    "qwen3:4b";

  const provider = env?.VITE_AI_PROVIDER ?? "ollama";
  const useLocal = env?.VITE_USE_LOCAL_AI === "true" || env?.VITE_USE_LOCAL_AI === true || provider === "ollama";

  return {
    baseUrl,
    apiUrl,
    openaiUrl,
    model,
    enabled: useLocal,
  };
}

/** Check if local Ollama server is alive and responding. */
export async function checkOllamaHealth(timeoutMs = 1500): Promise<{ connected: boolean; model?: string; message: string }> {
  const config = getOllamaConfig();
  if (!config.enabled) {
    return { connected: false, message: "Local Ollama disabled (cloud mode)" };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const res = await fetch(`${config.baseUrl}/api/tags`, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      return { connected: false, message: `Ollama returned HTTP ${res.status}` };
    }

    const data = await res.json().catch(() => ({}));
    const models = (data?.models ?? []) as Array<{ name: string }>;
    const hasModel = models.some((m) => m.name === config.model || m.name.startsWith(config.model.split(":")[0]));

    return {
      connected: true,
      model: config.model,
      message: hasModel ? `Ollama local active (${config.model})` : `Ollama connected (${models[0]?.name ?? config.model})`,
    };
  } catch {
    return { connected: false, message: "Local Ollama offline (using Groq fallback)" };
  }
}

/**
 * Execute chat completion with local Ollama.
 * Returns null if Ollama is offline or times out, allowing silent fallback to Groq.
 */
export async function callOllamaChat(
  messages: Array<{ role: string; content: string }>,
  timeoutMs = 10000,
): Promise<{ text: string; model: string } | null> {
  const config = getOllamaConfig();

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    // Use OpenAI-compatible endpoint on Ollama
    const res = await fetch(`${config.openaiUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: 0.2,
        max_tokens: 1024,
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      console.warn(`[ollama] Local call returned status ${res.status} — falling back to Groq`);
      return null;
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text === "string" && text.trim()) {
      return {
        text: text.trim(),
        model: `ollama/${config.model}`,
      };
    }
    return null;
  } catch (err: any) {
    // Silent fallback to Groq — never throw to UI
    console.warn(`[ollama] Local Ollama call bypassed (${err?.name || "offline"}) — using Groq`);
    return null;
  }
}
