-- =====================================================================
-- FACTORYOS AI — PLANT HIERARCHY REWORK (2026-09-04)
--
-- DATA-SAFETY: This migration is strictly ADDITIVE. It adds columns,
-- backfills plant_id assignments onto EXISTING rows, and re-scopes RLS
-- policies. It deletes nothing and recreates nothing. All 14 demo
-- accounts keep their exact rows, roles and data.
--
-- 1. Helper functions: is_plant_admin(), current_user_plant_id()
-- 2. plants: add latitude/longitude (for nearest-plant assignment)
-- 3. sales_orders: add plant_id (nullable) + backfill existing orders
--    to the main plant so nothing loses its plant association
-- 4. customers: add latitude/longitude/plant_id
-- 5. customer_requests: add latitude/longitude
-- 6. Migrate existing plant-level employees to the main plant:
--    user_roles + profiles + whitelist rows (additive plant_id updates)
-- 7. RLS: whitelist — Plant Admin may manage whitelist rows for their
--    own plant only (plant-level roles, never company-level roles)
-- 8. RLS: sales_orders — Plant Admin sees/updates only orders assigned
--    to their plant; every other role keeps its existing scope
-- 9. RLS: employees — Plant Admin sees/edits only their plant's roster
-- =====================================================================

-- ── 1. Helpers ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_plant_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = 'plant_admin'::public.app_role
  );
$function$;

-- The plant a user is scoped to, from their plant-level user_roles row.
-- Company-level roles (finance_manager / auditor) are excluded so they
-- stay cross-plant. Customers / suppliers / root have no plant.
CREATE OR REPLACE FUNCTION public.current_user_plant_id()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT plant_id
  FROM public.user_roles
  WHERE user_id = auth.uid()
    AND plant_id IS NOT NULL
    AND role NOT IN ('finance_manager'::public.app_role, 'auditor'::public.app_role)
  ORDER BY (role = 'plant_admin'::public.app_role) DESC, created_at DESC
  LIMIT 1;
$function$;

-- ── 2. plants: coordinates ────────────────────────────────────────────
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.plants ADD COLUMN IF NOT EXISTS longitude numeric;

-- Real coordinates for the existing plants of the demo company so the
-- nearest-plant assignment has geometry to work with.
UPDATE public.plants SET latitude = 42.3314,  longitude = -83.0458 WHERE id = '22222222-2222-2222-2222-222222222222'; -- Detroit Assembly Plant
UPDATE public.plants SET latitude = 41.8781,  longitude = -87.6298 WHERE id = 'bbcf8a0c-6ccc-4fcd-aa86-ea28b2a65a02'; -- N-08 Chicago Machining Center
UPDATE public.plants SET latitude = 22.3072,  longitude = 73.1812  WHERE id = 'f5228b57-6f8d-4bd0-8ef0-4f54484f7cf0'; -- demo-plants (Vadodara)
UPDATE public.plants SET latitude = 42.3314,  longitude = -83.0458 WHERE id = '9ac439f5-dc80-47ca-8465-0260539779f6'; -- N-08 Detroit Assembly Plant

-- ── 3. sales_orders: plant association ────────────────────────────────
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS plant_id uuid REFERENCES public.plants(id);

-- Backfill existing orders to the main plant (additive, never destructive).
UPDATE public.sales_orders
SET plant_id = '22222222-2222-2222-2222-222222222222'
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND plant_id IS NULL;

-- ── 4. customers: location + plant ────────────────────────────────────
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS longitude numeric;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS plant_id uuid REFERENCES public.plants(id);

-- ── 5. customer_requests: geocoded location ───────────────────────────
ALTER TABLE public.customer_requests ADD COLUMN IF NOT EXISTS latitude numeric;
ALTER TABLE public.customer_requests ADD COLUMN IF NOT EXISTS longitude numeric;

-- ── 6. Migrate existing plant-level employees to the main plant ───────
-- Additive plant_id assignment only — no rows deleted or recreated.
UPDATE public.user_roles
SET plant_id = '22222222-2222-2222-2222-222222222222'
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND plant_id IS NULL
  AND role IN (
    'plant_admin'::public.app_role,
    'plant_manager'::public.app_role,
    'production_manager'::public.app_role,
    'warehouse_manager'::public.app_role,
    'procurement_manager'::public.app_role,
    'quality_inspector'::public.app_role,
    'maintenance_engineer'::public.app_role,
    'hr_manager'::public.app_role,
    'production_operator'::public.app_role
  );

UPDATE public.profiles
SET plant_id = '22222222-2222-2222-2222-222222222222'
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND plant_id IS NULL
  AND id IN (
    SELECT user_id FROM public.user_roles
    WHERE company_id = '11111111-1111-1111-1111-111111111111'
      AND plant_id = '22222222-2222-2222-2222-222222222222'
  );

UPDATE public.whitelist
SET plant_id = '22222222-2222-2222-2222-222222222222'
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND plant_id IS NULL
  AND role IN (
    'plant_admin'::public.app_role,
    'plant_manager'::public.app_role,
    'production_manager'::public.app_role,
    'warehouse_manager'::public.app_role,
    'procurement_manager'::public.app_role,
    'quality_inspector'::public.app_role,
    'maintenance_engineer'::public.app_role,
    'hr_manager'::public.app_role,
    'production_operator'::public.app_role
  );

-- ── 7. RLS: whitelist — Plant Admin plant-scoped management ───────────
-- Read: Plant Admin sees only their own plant's whitelist rows.
DROP POLICY IF EXISTS whitelist_select_plant ON public.whitelist;
CREATE POLICY whitelist_select_plant ON public.whitelist
FOR SELECT TO authenticated
USING (
  public.is_plant_admin()
  AND company_id = public.current_company_id()
  AND plant_id = public.current_user_plant_id()
);

-- Write: Plant Admin may invite plant-level roles for their plant only.
-- Company-level roles (finance_manager, auditor), another Plant Admin,
-- Company Admin and Root remain out of reach for Plant Admin.
DROP POLICY IF EXISTS whitelist_write ON public.whitelist;
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
    AND role IN (
      'plant_manager'::public.app_role,
      'production_manager'::public.app_role,
      'warehouse_manager'::public.app_role,
      'procurement_manager'::public.app_role,
      'quality_inspector'::public.app_role,
      'maintenance_engineer'::public.app_role,
      'hr_manager'::public.app_role,
      'production_operator'::public.app_role
    )
  )
)
WITH CHECK (
  (
    public.is_root_admin(auth.uid())
    AND role = 'company_admin'::public.app_role
  )
  OR (
    company_id = public.current_company_id()
    AND public.has_role(auth.uid(), 'company_admin'::public.app_role)
    AND role <> 'company_admin'::public.app_role
  )
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
      'production_operator'::public.app_role
    )
  )
);

-- ── 8. RLS: sales_orders — Plant Admin plant-scoped ───────────────────
DROP POLICY IF EXISTS sales_orders_select_iso ON public.sales_orders;
CREATE POLICY sales_orders_select_iso ON public.sales_orders
FOR SELECT TO authenticated
USING (
  (
    public.is_customer_portal()
    AND customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
  )
  OR (
    NOT public.is_customer_portal()
    AND NOT public.is_plant_admin()
    AND public.in_company_ops(company_id)
  )
  OR (
    public.is_plant_admin()
    AND public.in_company_ops(company_id)
    AND plant_id = public.current_user_plant_id()
  )
  OR (
    public.is_auditor()
    AND public.in_company_ops(company_id)
  )
);

DROP POLICY IF EXISTS sales_orders_update_iso ON public.sales_orders;
CREATE POLICY sales_orders_update_iso ON public.sales_orders
FOR UPDATE TO authenticated
USING (
  (
    NOT public.is_customer_portal()
    AND NOT public.is_plant_admin()
    AND public.in_company_ops(company_id)
  )
  OR (
    public.is_plant_admin()
    AND public.in_company_ops(company_id)
    AND plant_id = public.current_user_plant_id()
  )
)
WITH CHECK (
  (
    NOT public.is_customer_portal()
    AND NOT public.is_plant_admin()
    AND public.in_company_ops(company_id)
  )
  OR (
    public.is_plant_admin()
    AND public.in_company_ops(company_id)
    AND plant_id = public.current_user_plant_id()
  )
);

-- ── 9. RLS: employees — Plant Admin plant-scoped roster ───────────────
DROP POLICY IF EXISTS employees_all ON public.employees;
CREATE POLICY employees_all ON public.employees
FOR ALL TO authenticated
USING (
  public.is_root_admin(auth.uid())
  OR (
    company_id = public.current_company_id()
    AND NOT public.is_plant_admin()
  )
  OR (
    company_id = public.current_company_id()
    AND public.is_plant_admin()
    AND plant_id = public.current_user_plant_id()
  )
)
WITH CHECK (
  public.is_root_admin(auth.uid())
  OR (
    company_id = public.current_company_id()
    AND NOT public.is_plant_admin()
  )
  OR (
    company_id = public.current_company_id()
    AND public.is_plant_admin()
    AND plant_id = public.current_user_plant_id()
  )
);

-- Grant EXECUTE on the new helpers so RLS policies can use them.
GRANT EXECUTE ON FUNCTION public.is_plant_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_plant_id() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_plant_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.current_user_plant_id() FROM anon;

-- Confirm
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE tablename IN ('whitelist', 'sales_orders', 'employees')
ORDER BY tablename, policyname;