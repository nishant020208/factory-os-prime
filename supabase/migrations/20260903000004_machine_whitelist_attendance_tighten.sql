-- =====================================================================
-- FACTORYOS AI — RESTORE + TIGHTEN (2026-08-30)
--
-- 1. machines: 00000 created strict INSERT/UPDATE policies, but 00001's
--    cleanup dropped them along with the legacy ones (only SELECT left).
--    Recreate: roster writes = tenant admins; status = maintenance too.
-- 2. whitelist: legacy whitelist_insert let ANY internal role insert —
--    company_admin only (my ALL policy already enforces role <> company_admin).
-- 3. customer_requests: cr_update_company let any same-company role
--    approve/reject — company_admin only (approval authority).
-- 4. attendance: attendance_update_manager let any same-company internal
--    role edit attendance — HR + company_admin only (HR owns corrections,
--    Company Admin oversees).
-- =====================================================================

-- ── 1. machines ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS machines_insert ON public.machines;
CREATE POLICY machines_insert ON public.machines
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND (is_tenant_admin() OR is_root_admin(auth.uid()))
);

DROP POLICY IF EXISTS machines_update ON public.machines;
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

-- ── 2. whitelist INSERT: company_admin only (ALL policy handles role gate) ──
DROP POLICY IF EXISTS whitelist_insert ON public.whitelist;
CREATE POLICY whitelist_insert ON public.whitelist
FOR INSERT TO authenticated
WITH CHECK (
  is_root_admin(auth.uid())
  OR (
    company_id = current_company_id()
    AND has_role(auth.uid(), 'company_admin'::public.app_role)
    AND role <> 'company_admin'::public.app_role
  )
);

-- ── 3. customer_requests UPDATE: company_admin only ───────────────────
DROP POLICY IF EXISTS cr_update_company ON public.customer_requests;
CREATE POLICY cr_update_company ON public.customer_requests
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND has_role(auth.uid(), 'company_admin'::public.app_role)
)
WITH CHECK (
  company_id = current_company_id()
  AND has_role(auth.uid(), 'company_admin'::public.app_role)
);

-- ── 4. attendance UPDATE: HR + company_admin only (plus owner self) ───
DROP POLICY IF EXISTS attendance_update_manager ON public.attendance;
CREATE POLICY attendance_update_manager ON public.attendance
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND (
    has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR has_role(auth.uid(), 'company_admin'::public.app_role)
  )
)
WITH CHECK (
  company_id = current_company_id()
  AND (
    has_role(auth.uid(), 'hr_manager'::public.app_role)
    OR has_role(auth.uid(), 'company_admin'::public.app_role)
  )
);
