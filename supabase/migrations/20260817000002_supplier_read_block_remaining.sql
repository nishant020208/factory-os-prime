-- =====================================================================
-- FACTORYOS AI — SUPPLIER READ-BLOCK REMAINING TABLES (2026-08-17)
--
-- The supplier could still read five internal tables because their
-- policies used bare `company_id = profiles.company_id` checks (which a
-- supplier row satisfies) or a broad ALL policy. Each is now hardened.
-- customer_portal keeps materials read (the New Order form needs the
-- admin-set price list); supplier_portal loses access everywhere.
-- =====================================================================

-- companies — supplier must not read the company record either
DROP POLICY IF EXISTS companies_select_scoped ON public.companies;
CREATE POLICY companies_select_scoped ON public.companies
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (id = current_company_id() AND NOT is_supplier_portal())
  );

-- customer_requests — company-wide view is Company-Admin-only; the
-- requester still sees their own request via the email branch.
DROP POLICY IF EXISTS cr_select_auth ON public.customer_requests;
CREATE POLICY cr_select_auth ON public.customer_requests
  FOR SELECT TO authenticated
  USING (
    (
      company_id = (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'company_admin'::public.app_role
      )
    )
    OR (email = (auth.jwt() ->> 'email'::text))
  );

-- materials — supplier cannot read the price list
DROP POLICY IF EXISTS mat_select_company ON public.materials;
CREATE POLICY mat_select_company ON public.materials
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND NOT is_supplier_portal()
  );

-- packing — supplier cannot read packing records
DROP POLICY IF EXISTS pck_select_company ON public.packing;
CREATE POLICY pck_select_company ON public.packing
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND NOT is_supplier_portal()
  );

-- departments — the broad ALL policy granted SELECT; scope it to internal roles
DROP POLICY IF EXISTS departments_write ON public.departments;
CREATE POLICY departments_write ON public.departments
  FOR ALL TO authenticated
  USING (
    company_id = current_company_id()
    AND NOT is_supplier_portal()
    AND NOT is_customer_portal()
  )
  WITH CHECK (
    company_id = current_company_id()
    AND NOT is_supplier_portal()
    AND NOT is_customer_portal()
  );

-- Confirm
SELECT tablename, policyname
FROM pg_policies
WHERE tablename IN ('companies','customer_requests','materials','packing','departments')
ORDER BY tablename, policyname;
