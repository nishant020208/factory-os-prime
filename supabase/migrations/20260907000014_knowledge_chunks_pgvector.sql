-- ====================================================================
-- 20260907000014_knowledge_chunks_pgvector.sql
-- FactoryOS AI: RAG Pipeline Vector Store & Knowledge Chunks
-- Enables pgvector extension, creates knowledge_chunks table, indexes,
-- role-aware Row Level Security, and strict SQL-level match function.
-- ====================================================================

-- 1. Enable pgvector extension (Supabase Postgres uses schema 'extensions')
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- 2. Create knowledge_chunks table
CREATE TABLE IF NOT EXISTS public.knowledge_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  source_table TEXT NOT NULL,
  source_id TEXT NOT NULL,
  role_visibility TEXT[] NOT NULL DEFAULT '{}',
  confidentiality_level TEXT NOT NULL CHECK (confidentiality_level IN ('public', 'internal', 'restricted')),
  content TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  embedding extensions.vector(384),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes for fast company/role/source lookups and vector similarity
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_company ON public.knowledge_chunks(company_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_plant ON public.knowledge_chunks(plant_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_roles ON public.knowledge_chunks USING GIN(role_visibility);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_conf ON public.knowledge_chunks(confidentiality_level);
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_source ON public.knowledge_chunks(source_table, source_id);

-- HNSW vector cosine distance index
CREATE INDEX IF NOT EXISTS idx_knowledge_chunks_embedding ON public.knowledge_chunks 
  USING hnsw (embedding extensions.vector_cosine_ops);

-- 4. Row Level Security
ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

-- Allow service role full management
DROP POLICY IF EXISTS "service_role_all_knowledge_chunks" ON public.knowledge_chunks;
CREATE POLICY "service_role_all_knowledge_chunks" ON public.knowledge_chunks
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Authenticated SELECT policy: Enforces company isolation AND role visibility in SQL
DROP POLICY IF EXISTS "knowledge_chunks_select_policy" ON public.knowledge_chunks;
CREATE POLICY "knowledge_chunks_select_policy" ON public.knowledge_chunks
  FOR SELECT TO authenticated
  USING (
    (
      -- Company match
      company_id IN (
        SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = auth.uid()
        UNION
        SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
      )
      -- Role visibility match (only permitted chunks can be retrieved)
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
        AND ur.role::text = ANY(knowledge_chunks.role_visibility)
      )
    )
    OR EXISTS (
      -- Root super admin access
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'root_super_admin'
    )
  );

-- 5. SQL-Level Retrieval Function: match_knowledge_chunks
-- Strictly filters by company_id AND role_visibility in the query itself.
CREATE OR REPLACE FUNCTION public.match_knowledge_chunks(
  query_embedding extensions.vector(384),
  filter_company_id UUID,
  asking_role TEXT,
  match_count INT DEFAULT 8,
  similarity_threshold FLOAT DEFAULT 0.0,
  filter_plant_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  company_id UUID,
  plant_id UUID,
  source_table TEXT,
  source_id TEXT,
  role_visibility TEXT[],
  confidentiality_level TEXT,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  RETURN QUERY
  SELECT
    kc.id,
    kc.company_id,
    kc.plant_id,
    kc.source_table,
    kc.source_id,
    kc.role_visibility,
    kc.confidentiality_level,
    kc.content,
    kc.metadata,
    (1 - (kc.embedding <=> query_embedding))::FLOAT AS similarity
  FROM public.knowledge_chunks kc
  WHERE
    (
      -- Company boundary: Root Super Admin may omit filter_company_id; all tenant roles must match company_id
      (filter_company_id IS NULL AND asking_role = 'root_super_admin')
      OR kc.company_id = filter_company_id
    )
    -- HARD RETRIEVAL-LEVEL FILTER: asking_role MUST be present in role_visibility array
    AND (asking_role = ANY(kc.role_visibility))
    -- Optional plant filter
    AND (
      filter_plant_id IS NULL
      OR kc.plant_id IS NULL
      OR kc.plant_id = filter_plant_id
    )
    AND (1 - (kc.embedding <=> query_embedding)) >= similarity_threshold
  ORDER BY kc.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
