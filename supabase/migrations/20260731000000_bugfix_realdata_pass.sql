-- =============================================================
-- FACTORYOS AI — BUGFIX + REAL-DATA PASS (2026-07-31)
-- 1. MAIN-ADMIN identity flag for messaging Root Super Admin
-- 2. Root admin can receive company-registration notifications
-- 3. Public customer registration into customer_requests
-- 4. Public platform stats RPC for live landing-page numbers
-- 5. Active-companies RPC for customer registration dropdown
-- =============================================================

-- ───────────────────────── 1. MAIN-ADMIN FLAG ─────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_main_admin boolean NOT NULL DEFAULT false;
COMMENT ON COLUMN public.profiles.is_main_admin IS
  'Designated MAIN-ADMIN account. Only this profile may send manual
   messages targeted at the Root Super Admin role. Enforced by RLS.';

-- Helper: is the current user the designated MAIN-ADMIN?
CREATE OR REPLACE FUNCTION public.is_main_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (SELECT is_main_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- Seed: flag the first root_super_admin user as MAIN-ADMIN so the
-- "Message Root Admin" capability works out of the box. The owner can
-- reassign this to any account by setting profiles.is_main_admin = true.
UPDATE public.profiles
SET is_main_admin = true
WHERE id IN (
  SELECT ur.user_id
  FROM public.user_roles ur
  WHERE ur.role = 'root_super_admin'
  LIMIT 1
);

-- ───────────────────── 2. NOTIFICATIONS RLS ────────────────────────────
-- Allow the notifications table to carry root-targeted rows (e.g. new
-- company registrations) by relaxing the SELECT scoping for root admins.
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT USING (
    -- Root admin: sees root-targeted notifications regardless of company
    (is_root_admin() AND to_role = 'root_super_admin')
    OR
    (
      company_id = (SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
      AND (
        to_user = auth.uid()
        OR to_role = (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1)
        OR EXISTS (
          SELECT 1 FROM public.user_roles ur2
          WHERE ur2.user_id = auth.uid() AND ur2.role = 'company_admin'
            AND ur2.company_id = public.notifications.company_id
        )
      )
    )
  );

-- INSERT: strict — only the designated MAIN-ADMIN may target Root.
-- Anonymous users may only fire new-company-registration notices to Root
-- and customer-access-request notices to a specific Company Admin.
DROP POLICY IF EXISTS "notifications_insert_all" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_company" ON public.notifications;
CREATE POLICY notifications_insert_main_admin_only ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    to_role IS DISTINCT FROM 'root_super_admin'
    OR is_main_admin()
  );

CREATE POLICY notifications_insert_anon_registration ON public.notifications
  FOR INSERT TO anon
  WITH CHECK (
    to_role IS NOT NULL
    AND (
      (to_role = 'root_super_admin' AND title ILIKE '%new company registration%')
      OR (to_role = 'company_admin'  AND title ILIKE '%customer access request%' AND company_id IS NOT NULL)
    )
  );

GRANT INSERT ON public.notifications TO anon;

-- ─────────────── 3. PUBLIC CUSTOMER REGISTRATION ───────────────────────
-- A visitor (authenticated or anon) submits a customer access request
-- for a specific company. Company Admin approves in the Customer Requests tab.
DROP POLICY IF EXISTS cr_anon_insert ON public.customer_requests;
CREATE POLICY cr_anon_insert ON public.customer_requests
  FOR INSERT TO anon WITH CHECK (true);
GRANT SELECT, INSERT ON public.customer_requests TO anon;

-- ───────────── 4. PLATFORM STATS RPC (live landing numbers) ────────────
CREATE OR REPLACE FUNCTION public.get_platform_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _companies int;
  _machines int;
  _users    int;
  _uptime   numeric;
BEGIN
  SELECT count(*) INTO _companies FROM public.companies WHERE status = 'active';
  SELECT count(*) INTO _machines FROM public.machines;
  SELECT count(*) INTO _users    FROM public.profiles;
  SELECT round(100 * avg(CASE WHEN m.status = 'operational' THEN 1 ELSE 0 END)::numeric, 1)
    INTO _uptime
  FROM public.machines m
  WHERE m.status IN ('operational','down','maintenance');
  IF _uptime IS NULL THEN _uptime := 0; END IF;
  RETURN jsonb_build_object(
    'companies', COALESCE(_companies, 0),
    'machines',  COALESCE(_machines, 0),
    'users',     COALESCE(_users, 0),
    'uptime',    _uptime
  );
END $$;

GRANT EXECUTE ON FUNCTION public.get_platform_stats() TO anon, authenticated;

-- ───────── 6. MATERIALS WRITE RLS — COMPANY ADMIN ONLY (Fix #8) ───────
-- Customer (and every other role) keeps SELECT for the order form dropdown,
-- but INSERT / UPDATE / DELETE on materials is reserved for the Company Admin.
-- This is enforced at the DB layer, not just hidden in the UI.
DROP POLICY IF EXISTS mat_write_company ON public.materials;
DROP POLICY IF EXISTS mat_update_company ON public.materials;
DROP POLICY IF EXISTS mat_delete_company ON public.materials;

CREATE POLICY mat_write_company ON public.materials FOR INSERT TO authenticated
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'company_admin'))
  );
CREATE POLICY mat_update_company ON public.materials FOR UPDATE TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'company_admin'))
  )
  WITH CHECK (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'company_admin'))
  );
CREATE POLICY mat_delete_company ON public.materials FOR DELETE TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    AND (SELECT EXISTS (SELECT 1 FROM public.user_roles
          WHERE user_id = auth.uid() AND role = 'company_admin'))
  );

-- ───────────── 5. ACTIVE COMPANIES RPC (customer dropdown) ─────────────
CREATE OR REPLACE FUNCTION public.get_active_companies()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'industry', c.industry,
    'country', c.country
  )), '[]'::jsonb)
  INTO _rows
  FROM public.companies c
  WHERE c.status = 'active'
  ORDER BY c.name;
  RETURN _rows;
END $$;

GRANT EXECUTE ON FUNCTION public.get_active_companies() TO anon, authenticated;
