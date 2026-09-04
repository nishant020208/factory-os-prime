-- =====================================================================
-- FACTORYOS AI — REMOVE TEMPORARY DIAGNOSTIC RPC (2026-09-04)
--
-- The throwaway diag_rls_state() function from 20260904000003_diag_rls_tmp
-- was only needed to confirm RLS ground truth during the hierarchy rework.
-- It is no longer used anywhere and is removed so no _tmp diagnostic stays
-- live in the schema.
-- =====================================================================

DROP FUNCTION IF EXISTS public.diag_rls_state();