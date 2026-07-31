-- =============================================================
-- FACTORYOS AI — FIX customer_requests RLS POLICIES
-- Root cause: the cr_insert_own and cr_select_company policies
-- evaluated `SELECT email FROM auth.users WHERE id = auth.uid()`,
-- but the `authenticated` role has no SELECT grant on auth.users
-- in this project. Policy evaluation itself threw
-- "permission denied for table users", which the client surfaces
-- as "new row violates row-level security policy".
--
-- Fix: use auth.jwt() ->> 'email' (JWT claims — no table access)
-- and let authenticated INSERT the public intake form the same
-- way anon can. The Company Admin reviews rows in the
-- Customer Requests tab.
-- =============================================================

-- Insert policy: any authenticated user may submit a request
-- (same intake behaviour as the anon policy). Replaces cr_insert_own.
DROP POLICY IF EXISTS cr_insert_own ON public.customer_requests;
CREATE POLICY cr_insert_auth ON public.customer_requests FOR INSERT TO authenticated
  WITH CHECK (true);

-- Select policy: Company Admin sees all rows for their company;
-- a requester sees their own pending row by JWT email. No auth.users query.
DROP POLICY IF EXISTS cr_select_company ON public.customer_requests;
CREATE POLICY cr_select_auth ON public.customer_requests FOR SELECT TO authenticated
  USING (
    company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
    OR email = (auth.jwt() ->> 'email')
  );

-- Update policy stays scoped to Company Admin (uses user_roles, not auth.users).
-- Recreate defensively in case the old one referenced anything stale.
DROP POLICY IF EXISTS cr_update_company ON public.customer_requests;
CREATE POLICY cr_update_company ON public.customer_requests FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin')))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin')));