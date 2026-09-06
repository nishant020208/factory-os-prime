-- ============================================================================
-- Fix: legacy whitelist_insert policy (20260903000004) still lets a Company
-- Admin insert ANY non-company_admin role, bypassing the whitelist hierarchy
-- enforced by whitelist_write (Company Admin may only whitelist plant_admin,
-- finance_manager, auditor; everything else goes through the Plant Admin).
-- RLS ORs policies together, so a permissive INSERT policy defeats the WITH
-- CHECK on whitelist_write. Drop it: whitelist_write (FOR ALL) already covers
-- INSERT with the correct role gate.
-- ============================================================================
DROP POLICY IF EXISTS whitelist_insert ON public.whitelist;
DROP POLICY IF EXISTS whitelist_update ON public.whitelist;