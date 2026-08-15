-- =====================================================================
-- FACTORYOS AI — COMPANY ADMIN & PLANT ADMIN BOUNDARIES (2026-08-30)
--
-- 1. `departments` writes are Company-Admin / Plant-Admin only. Until
--    now the ALL policy let ANY internal role (including Production
--    Operator) create/edit departments.
-- 2. `machines` roster writes (add / edit / retire) are Company-Admin /
--    Plant-Admin only; Maintenance Engineer keeps status writes (Log
--    Service / resolve tickets). All other roles read only.
-- 3. `work_orders` UPDATE: drop company_admin / plant_admin. Company
--    Admin's power is approval + oversight, NOT operational override —
--    it must not edit work-order progress directly. Production Manager
--    (creator), Quality Inspector and the assigned Operator keep write.
-- 4. `user_roles` INSERT stays root-only (whitelist flow grants roles);
--    we add a Companies INSERT policy for Company Admin so a first-time
--    admin can bootstrap a company record when none exists.
-- =====================================================================

-- ── 1. Helper: tenant-admin roles (Company Admin / Plant Admin) ────────
CREATE OR REPLACE FUNCTION public.is_tenant_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('company_admin'::public.app_role, 'plant_admin'::public.app_role)
  );
$function$;

-- ── 2. Departments: write = tenant admins only ─────────────────────────
DROP POLICY IF EXISTS departments_write ON public.departments;
DROP POLICY IF EXISTS "departments_write" ON public.departments;

CREATE POLICY departments_write ON public.departments
FOR ALL TO authenticated
USING (
  company_id = current_company_id()
  AND (is_tenant_admin() OR is_root_admin(auth.uid()))
)
WITH CHECK (
  company_id = current_company_id()
  AND (is_tenant_admin() OR is_root_admin(auth.uid()))
);

-- ── 3. Machines: roster writes = tenant admins; status = maintenance ───
DROP POLICY IF EXISTS machines_insert ON public.machines;
DROP POLICY IF EXISTS machines_update ON public.machines;

CREATE POLICY machines_insert ON public.machines
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND (is_tenant_admin() OR is_root_admin(auth.uid()))
);

CREATE POLICY machines_update ON public.machines
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND (is_tenant_admin() OR is_maintenance_engineer() OR is_root_admin(auth.uid()))
)
WITH CHECK (
  company_id = current_company_id()
  AND (is_tenant_admin() OR is_maintenance_engineer() OR is_root_admin(auth.uid()))
);

-- ── 4. Work orders: drop company_admin / plant_admin from UPDATE ───────
DROP POLICY IF EXISTS work_orders_update_scoped ON public.work_orders;
CREATE POLICY work_orders_update_scoped ON public.work_orders
FOR UPDATE TO authenticated
USING (
  is_root_admin(auth.uid())
  OR (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('production_manager','quality_inspector')
    )
  )
)
WITH CHECK (
  is_root_admin(auth.uid())
  OR (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('production_manager','quality_inspector')
    )
  )
);

-- ── 5. Companies: allow Company Admin to bootstrap a company record ────
DROP POLICY IF EXISTS companies_insert_tenant ON public.companies;
CREATE POLICY companies_insert_tenant ON public.companies
FOR INSERT TO authenticated
WITH CHECK (
  is_root_admin(auth.uid())
  OR (id = current_company_id() AND is_tenant_admin())
);

-- Confirm
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('departments','machines','work_orders','companies')
ORDER BY tablename, cmd;
