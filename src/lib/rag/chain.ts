/**
 * src/lib/rag/chain.ts
 *
 * LangChain RAG Chain Orchestrator for FactoryOS AI Copilot.
 * Integrates:
 *   1. pgvector Retriever (SQL-level company_id + role_visibility filter)
 *   2. LangChain PromptTemplate & Document Context Formatter
 *   3. Strict Grounding & Role-Aware Decline Guardrails
 *   4. Fast LLM Execution (Groq primary with Cerebras fallback)
 */
import { PromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence } from "@langchain/core/runnables";
import { retrieveKnowledge } from "./retriever.ts";
import type { RetrievedChunk } from "./retriever.ts";
import { ROLE_SYSTEM_PROMPTS, SCOPE_RULE } from "../llm-prompts.ts";
import { checkRoleScope, DOMAIN_LABELS, getAllowedLabels, ROLE_LABELS } from "../role-scope.ts";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "openai/gpt-oss-120b";
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const CEREBRAS_MODEL = "gpt-oss-120b";

function getGroqKey(): string | null {
  return (
    process.env.GROQ_API_KEY ??
    process.env.VITE_GROQ_API_KEY ??
    (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_GROQ_API_KEY : null) ??
    null
  );
}

function getCerebrasKey(): string | null {
  return (
    process.env.CEREBRAS_API_KEY ??
    process.env.VITE_CEREBRAS_API_KEY ??
    (typeof import.meta !== "undefined" && import.meta.env ? import.meta.env.VITE_CEREBRAS_API_KEY : null) ??
    null
  );
}

async function callOpenAiModel(
  apiUrl: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
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
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    console.warn(`[rag-chain] ${model} call failed with status ${res.status}`);
    return null;
  }
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

export interface RagChainRequest {
  question: string;
  role: string;
  companyId: string | null;
  plantId?: string | null;
  history?: Array<{ role: "user" | "ai"; text: string }>;
  liveDataContext?: string;
}

export interface RagChainResponse {
  text: string;
  model: string;
  provider: "groq" | "cerebras" | "rag-direct";
  role: string;
  companyId: string | null;
  retrievedChunksCount: number;
  retrievedChunks: Array<{
    id: string;
    sourceTable: string;
    confidentialityLevel: string;
    similarity: number;
  }>;
  scopeBlocked?: { domain: string; label: string; allowed: string[] };
  latencyMs: number;
  error?: string;
}

/**
 * Execute the LangChain RAG pipeline for a given query and role.
 */
export async function executeRagChain(req: RagChainRequest): Promise<RagChainResponse> {
  const t0 = Date.now();
  const { question, role, companyId, plantId = null, history = [], liveDataContext } = req;

  // 1. Primary Rule Scope Gate
  const blockedDomain = checkRoleScope(role, question);
  if (blockedDomain) {
    const roleLabel = ROLE_LABELS[role] ?? role;
    return {
      text: `🚫 **Access Restricted** — you asked about **${DOMAIN_LABELS[blockedDomain] ?? blockedDomain}**, which is outside what I can share for your **${roleLabel}** role. I can assist with ${getAllowedLabels(role).slice(0, 3).join(", ")} instead.`,
      model: "security-gate",
      provider: "rag-direct",
      role,
      companyId,
      retrievedChunksCount: 0,
      retrievedChunks: [],
      scopeBlocked: {
        domain: blockedDomain,
        label: DOMAIN_LABELS[blockedDomain] ?? blockedDomain,
        allowed: getAllowedLabels(role),
      },
      latencyMs: Date.now() - t0,
    };
  }

  // 2. Vector Retrieval (Strictly filtered in SQL by company_id + asking_role)
  const retrieval = await retrieveKnowledge({
    question,
    role,
    companyId,
    plantId,
    matchCount: 8,
    similarityThreshold: 0.1,
  });

  const formattedChunksSummary = retrieval.chunks.map((c) => ({
    id: c.id,
    sourceTable: c.source_table,
    confidentialityLevel: c.confidentiality_level,
    similarity: Number(c.similarity.toFixed(4)),
  }));

  // 3. Format context using LangChain Document abstractions
  const contextSections: string[] = [];

  if (retrieval.documents.length > 0) {
    const docLines = retrieval.documents.map((doc, idx) => {
      const meta = doc.metadata;
      return `[Chunk #${idx + 1} | Source: ${meta.sourceTable} | Tier: ${meta.confidentialityLevel} | Match: ${(meta.similarity * 100).toFixed(1)}%]\n${doc.pageContent}`;
    });
    contextSections.push(`RETRIEVED KNOWLEDGE BASE (Verified role-permitted data):\n${docLines.join("\n\n")}`);
  }

  if (liveDataContext) {
    contextSections.push(`LIVE OPERATIONAL CONTEXT:\n${liveDataContext}`);
  }

  const rolePrompt = ROLE_SYSTEM_PROMPTS[role] ?? ROLE_SYSTEM_PROMPTS.company_admin;

  // 4. LangChain Prompt Construction
  const promptTemplate = PromptTemplate.fromTemplate(
    `{systemPrompt}

Current Asking Role: {roleDisplay}
Company Isolation Boundary: {companyId}

CONTEXT FROM FACTORYOS KNOWLEDGE BASE:
{retrievedContext}

CRITICAL SECURITY & GROUNDING INSTRUCTIONS:
1. Answer ONLY from the provided context chunks above.
2. If the user asks for confidential or restricted company information (such as executive salaries, employee personal contact info, company financial profit/loss, another customer's data, or unshared supplier margins) that is NOT present in the permitted context above, you MUST decline cleanly.
3. Your decline MUST be honest and polite: "That is outside what I can share for your role — I can help with your permitted operational tasks and data instead."
4. NEVER fabricate, hallucinate, or guess company numbers or proprietary details.
5. Format data clearly, using markdown tables where applicable.

User Question: {question}`
  );

  const formattedPrompt = await promptTemplate.format({
    systemPrompt: rolePrompt,
    roleDisplay: role.replace(/_/g, " "),
    companyId: companyId ?? "Global Super Admin",
    retrievedContext: contextSections.length > 0 ? contextSections.join("\n\n") : "No permitted knowledge chunks match this query.",
    question,
  });

  const messages: Array<{ role: string; content: string }> = [
    { role: "system", content: formattedPrompt },
  ];

  for (const turn of history.slice(-6)) {
    messages.push({
      role: turn.role === "user" ? "user" : "assistant",
      content: turn.text,
    });
  }
  messages.push({ role: "user", content: question });

  // 5. Model Execution (Groq primary, Cerebras fallback)
  const groqKey = getGroqKey();
  if (groqKey) {
    try {
      const answer = await callOpenAiModel(GROQ_API_URL, groqKey, GROQ_MODEL, messages);
      if (answer) {
        return {
          text: answer,
          model: GROQ_MODEL,
          provider: "groq",
          role,
          companyId,
          retrievedChunksCount: retrieval.chunks.length,
          retrievedChunks: formattedChunksSummary,
          latencyMs: Date.now() - t0,
        };
      }
    } catch (err) {
      console.warn("[rag-chain] Groq call failed:", err);
    }
  }

  const cerebrasKey = getCerebrasKey();
  if (cerebrasKey) {
    try {
      const answer = await callOpenAiModel(CEREBRAS_API_URL, cerebrasKey, CEREBRAS_MODEL, messages);
      if (answer) {
        return {
          text: answer,
          model: CEREBRAS_MODEL,
          provider: "cerebras",
          role,
          companyId,
          retrievedChunksCount: retrieval.chunks.length,
          retrievedChunks: formattedChunksSummary,
          latencyMs: Date.now() - t0,
        };
      }
    } catch (err) {
      console.warn("[rag-chain] Cerebras call failed:", err);
    }
  }

  // Fallback if no LLM provider is reachable
  if (retrieval.documents.length > 0) {
    const topDoc = retrieval.documents[0].pageContent;
    return {
      text: `Based on your role's permitted knowledge:\n\n${topDoc}`,
      model: "rag-fallback",
      provider: "rag-direct",
      role,
      companyId,
      retrievedChunksCount: retrieval.chunks.length,
      retrievedChunks: formattedChunksSummary,
      latencyMs: Date.now() - t0,
    };
  }

  return {
    text: `That information is either outside what I can share for your role or not present in the current knowledge base. I can help with your permitted operational data instead.`,
    model: "rag-fallback",
    provider: "rag-direct",
    role,
    companyId,
    retrievedChunksCount: 0,
    retrievedChunks: [],
    latencyMs: Date.now() - t0,
  };
}
