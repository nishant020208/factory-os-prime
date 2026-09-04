-- =====================================================================
-- FACTORYOS AI — CLOSE PLANT RLS GAPS + REMOVE TEMP DIAGNOSTIC (2026-09-04)
--
-- Live-policy inspection found three policies created outside the
-- migration history (via the dashboard) that defeat plant isolation:
--
--   1. whitelist_select_scoped — company-wide whitelist read for every
--      internal role (operators could list invites). Replaced by the
--      controlled select paths: whitelist_write (root/company_admin),
--      whitelist_select_plant (Plant Admin, own plant only).
--   2. whitelist_delete        — company-wide whitelist delete.
--   3. whitelist_update        — company-wide whitelist update (any
--      internal role). The whitelist_write FOR ALL policy already grants
--      UPDATE/DELETE to root, Company Admin, and plant-scoped Plant
--      Admin, and no app code updates/deletes whitelist rows directly.
--   4. employees_select_ops    — company-wide employees read (from the
--      2026-08-05 generic sweep). employees_all now scopes Plant Admin
--      to their own plant; every other role keeps company read.
--
-- Also removes the temporary diag_rls_state() function.
-- =====================================================================

DROP POLICY IF EXISTS whitelist_select_scoped ON public.whitelist;
DROP POLICY IF EXISTS whitelist_delete ON public.whitelist;
DROP POLICY IF EXISTS whitelist_update ON public.whitelist;

DROP POLICY IF EXISTS employees_select_ops ON public.employees;

DROP FUNCTION IF EXISTS public.diag_rls_state();

-- Confirm final policy set
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('whitelist', 'employees', 'sales_orders')
ORDER BY tablename, policyname;