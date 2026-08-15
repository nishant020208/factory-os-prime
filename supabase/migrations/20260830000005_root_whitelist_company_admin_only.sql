-- =====================================================================
-- FACTORYOS AI — ROOT WHITELIST: COMPANY-ADMIN ONBOARDING ONLY
-- (2026-08-30)
--
-- Root Super Admin's whitelist authority is scoped to onboarding a new
-- tenant's first Company Admin (per the whitelist spec). Root must not
-- drop staff roles directly into an existing/active company — that is
-- Company Admin's job (inviting their own staff, excluding company_admin).
--
-- Rule implemented here:
--   Root  → may whitelist role = company_admin only.
--   Company Admin → may whitelist any role EXCEPT company_admin within
--   their own company.
--   Partner onboarding (customer_portal / supplier_portal) stays as-is:
--   Company Admin approves → whitelist row.
-- =====================================================================

DROP POLICY IF EXISTS whitelist_insert ON public.whitelist;
DROP POLICY IF EXISTS whitelist_write ON public.whitelist;

CREATE POLICY whitelist_write ON public.whitelist
FOR ALL TO authenticated
USING (
  is_root_admin(auth.uid())
  OR (
    company_id = current_company_id()
    AND has_role(auth.uid(), 'company_admin'::public.app_role)
  )
)
WITH CHECK (
  (
    is_root_admin(auth.uid())
    AND role = 'company_admin'::public.app_role
  )
  OR (
    company_id = current_company_id()
    AND has_role(auth.uid(), 'company_admin'::public.app_role)
    AND role <> 'company_admin'::public.app_role
  )
);
