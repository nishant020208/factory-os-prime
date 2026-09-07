/**
 * src/lib/rag/retriever.ts
 *
 * RAG Knowledge Retriever for FactoryOS AI.
 * Performs similarity search against `knowledge_chunks` using pgvector embeddings.
 * CRITICAL: Filtering by company_id AND role_visibility happens strictly inside the
 * PostgreSQL match_knowledge_chunks RPC — unauthorized chunks are never returned
 * to the application layer or LLM context window.
 */
import { createClient } from "@supabase/supabase-js";
import { Document } from "@langchain/core/documents";
import { embedText } from "./embeddings.ts";

export type ConfidentialityLevel = "public" | "internal" | "restricted";

function getAdminClient() {
  const url =
    process.env.SUPABASE_URL ??
    process.env.VITE_SUPABASE_URL ??
    "https://ytawmeiylkrzjzmauvhf.supabase.co";
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl0YXdtZWl5bGtyemp6bWF1dmhmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NTA4OTc0MCwiZXhwIjoyMTAwNjY1NzQwfQ.Vya5r_x-J3e3_hxHSSYDYmYuRfk0ep07NKjSeq1hsxU";

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export interface RetrievedChunk {
  id: string;
  company_id: string;
  plant_id: string | null;
  source_table: string;
  source_id: string;
  role_visibility: string[];
  confidentiality_level: ConfidentialityLevel;
  content: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

export interface RetrievalResult {
  question: string;
  role: string;
  companyId: string | null;
  chunks: RetrievedChunk[];
  documents: Document[];
  hasRestricted: boolean;
  tierCounts: {
    public: number;
    internal: number;
    restricted: number;
  };
  durationMs: number;
}

/**
 * Retrieve permitted knowledge chunks for a query and asking role.
 */
export async function retrieveKnowledge(opts: {
  question: string;
  role: string;
  companyId: string | null;
  plantId?: string | null;
  matchCount?: number;
  similarityThreshold?: number;
}): Promise<RetrievalResult> {
  const t0 = Date.now();
  const {
    question,
    role,
    companyId,
    plantId = null,
    matchCount = 8,
    similarityThreshold = 0.05,
  } = opts;

  const admin = getAdminClient();

  // 1. Generate dense 384-dimensional query embedding
  const queryEmbedding = await embedText(question);

  // 2. Call pgvector SQL function with HARD retrieval-level filters
  const { data: rawChunks, error } = await admin.rpc("match_knowledge_chunks", {
    query_embedding: queryEmbedding,
    filter_company_id: companyId,
    asking_role: role,
    match_count: matchCount,
    similarity_threshold: similarityThreshold,
    filter_plant_id: plantId,
  });

  if (error) {
    console.error("[rag-retriever] match_knowledge_chunks error:", error);
    return {
      question,
      role,
      companyId,
      chunks: [],
      documents: [],
      hasRestricted: false,
      tierCounts: { public: 0, internal: 0, restricted: 0 },
      durationMs: Date.now() - t0,
    };
  }

  const chunks = (rawChunks || []) as RetrievedChunk[];

  // 3. Format as LangChain Documents
  const tierCounts = { public: 0, internal: 0, restricted: 0 };
  let hasRestricted = false;

  const documents = chunks.map((chunk) => {
    tierCounts[chunk.confidentiality_level] =
      (tierCounts[chunk.confidentiality_level] || 0) + 1;
    if (chunk.confidentiality_level === "restricted") {
      hasRestricted = true;
    }

    return new Document({
      pageContent: chunk.content,
      metadata: {
        id: chunk.id,
        sourceTable: chunk.source_table,
        sourceId: chunk.source_id,
        confidentialityLevel: chunk.confidentiality_level,
        roleVisibility: chunk.role_visibility,
        similarity: chunk.similarity,
        ...chunk.metadata,
      },
    });
  });

  return {
    question,
    role,
    companyId,
    chunks,
    documents,
    hasRestricted,
    tierCounts,
    durationMs: Date.now() - t0,
  };
}
