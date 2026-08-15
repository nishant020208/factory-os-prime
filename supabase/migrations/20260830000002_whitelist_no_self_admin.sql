-- =====================================================================
-- FACTORYOS AI — WHITELIST: COMPANY ADMIN MAY NOT INVITE COMPANY ADMINS
-- (2026-08-30)
--
-- Root Super Admin's exclusive scope includes creating Company Admins.
-- A Company Admin may invite every OTHER internal role and approve
-- partners, but must not grant the company_admin role itself.
-- =====================================================================

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
  is_root_admin(auth.uid())
  OR (
    company_id = current_company_id()
    AND has_role(auth.uid(), 'company_admin'::public.app_role)
    AND role <> 'company_admin'::public.app_role
  )
);
