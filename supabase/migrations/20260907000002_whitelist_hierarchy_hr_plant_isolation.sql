-- ============================================================================
-- Migration: Whitelist hierarchy + HR plant isolation
-- ============================================================================
-- 1. Whitelist INSERT: Company Admin may ONLY invite the three company-level
--    roles (plant_admin, finance_manager, auditor). Every other role is a
--    plant role and must be invited by the Plant Admin of that plant.
--    Plant Admin is already restricted to their plant's roles (migration
--    20260904000001). This tightens the company-admin branch that previously
--    allowed ANY role except company_admin.
-- 2. employees RLS: plant-scoped roles (hr_manager included) may only read
--    employee records of their OWN plant. Previously hr_manager saw every
--    employee company-wide because the policy only special-cased plant_admin.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Whitelist — company-admin invites limited to company-level roles
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS whitelist_write ON public.whitelist;

-- SELECT: unchanged semantics — Plant Admin sees own plant, everyone else in company.
CREATE POLICY whitelist_write ON public.whitelist
FOR ALL TO authenticated
USING (
  public.is_root_admin(auth.uid())
  OR (
    company_id = public.current_company_id()
    AND public.has_role(auth.uid(), 'company_admin'::public.app_role)
  )
  OR (
    company_id = public.current_company_id()
    AND public.is_plant_admin()
    AND plant_id = public.current_user_plant_id()
  )
)
WITH CHECK (
  -- Root may invite company admins only (existing rule).
  (
    public.is_root_admin(auth.uid())
    AND role = 'company_admin'::public.app_role
  )
  -- Company Admin: ONLY the three company-level roles.
  OR (
    company_id = public.current_company_id()
    AND public.has_role(auth.uid(), 'company_admin'::public.app_role)
    AND role IN (
      'plant_admin'::public.app_role,
      'finance_manager'::public.app_role,
      'auditor'::public.app_role
    )
  )
  -- Plant Admin: only their plant's roles, scoped to their plant.
  OR (
    company_id = public.current_company_id()
    AND public.is_plant_admin()
    AND plant_id = public.current_user_plant_id()
    AND role IN (
      'plant_manager'::public.app_role,
      'production_manager'::public.app_role,
      'warehouse_manager'::public.app_role,
      'procurement_manager'::public.app_role,
      'quality_inspector'::public.app_role,
      'maintenance_engineer'::public.app_role,
      'hr_manager'::public.app_role,
      'production_operator'::public.app_role,
      'supplier_portal'::public.app_role
    )
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. employees RLS — every plant-scoped role sees only its own plant's roster.
--    hr_manager, plant_manager, warehouse, procurement, quality, maintenance,
--    production operator, production manager: plant-scoped.
--    Company-level roles (company_admin, finance_manager, auditor) + root:
--    full company roster.
-- ─────────────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS employees_all ON public.employees;
CREATE POLICY employees_all ON public.employees
FOR ALL TO authenticated
USING (
  public.is_root_admin(auth.uid())
  OR (
    company_id = public.current_company_id()
    AND public.current_user_plant_id() IS NULL
  )
  OR (
    company_id = public.current_company_id()
    AND plant_id = public.current_user_plant_id()
  )
)
WITH CHECK (
  public.is_root_admin(auth.uid())
  OR (
    company_id = public.current_company_id()
    AND public.current_user_plant_id() IS NULL
  )
  OR (
    company_id = public.current_company_id()
    AND plant_id = public.current_user_plant_id()
  )
);