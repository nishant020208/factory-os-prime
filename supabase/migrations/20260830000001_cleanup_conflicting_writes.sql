-- =====================================================================
-- FACTORYOS AI — CLEANUP CONFLICTING WRITE POLICIES (2026-08-30)
--
-- The 20260830000000 migration added strict tenant-admin policies, but
-- older per-command policies still granted broad writes (Postgres ORs
-- policies, so ANY matching policy allows the write). Live policy dump
-- showed:
--   departments_insert  → any internal role except a few
--   departments_update  → same broad list
--   departments_delete  → any internal role except auditor/portals
--   machines_insert     → (older variant) any internal role except list
--   companies_insert    → any internal role except a few
-- Drop those legacy policies; the strict ALL policies (departments_write,
-- machines_insert/update, companies_insert_tenant) are the single source
-- of truth now.
-- =====================================================================

DROP POLICY IF EXISTS departments_insert ON public.departments;
DROP POLICY IF EXISTS departments_update ON public.departments;
DROP POLICY IF EXISTS departments_delete ON public.departments;

DROP POLICY IF EXISTS machines_insert ON public.machines;
DROP POLICY IF EXISTS machines_update ON public.machines;
DROP POLICY IF EXISTS machines_delete ON public.machines;

DROP POLICY IF EXISTS companies_insert ON public.companies;
DROP POLICY IF EXISTS companies_update ON public.companies;
DROP POLICY IF EXISTS companies_delete ON public.companies;

-- machines_delete is currently undefined (no policy) — keep tenant-admin
-- deletion path via the machines_insert/update policies only.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('departments','machines','companies')
ORDER BY tablename, cmd;
