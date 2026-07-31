-- =============================================================
-- FACTORYOS AI — FIX anon INSERT...RETURNING RLS violations
-- Root cause: the app submits registration forms with
--   supabase.from("customer_requests").insert({...}).select("id").single()
-- which sends `Prefer: return=representation`. PostgREST runs
-- `INSERT ... RETURNING`, and the RETURNING rows are checked against
-- the table's SELECT policies. The `anon` role had INSERT grants and
-- an INSERT policy, but NO SELECT policy — so the RETURNING clause was
-- rejected with:
--   new row violates row-level security policy for table "customer_requests"
--   (SQLSTATE 42501, surfaced as HTTP 401/403 by PostgREST).
--
-- Fix: grant `anon` a permissive SELECT policy on the two public
-- registration tables. These tables are public intake forms — anyone
-- may submit, and only Company Admin / Root reviews the rows, so a
-- broad anon SELECT is safe and required for RETURNING to succeed.
-- =============================================================

-- ───────────── 1. customer_requests ──────────────────────────────
DROP POLICY IF EXISTS cr_anon_select ON public.customer_requests;
CREATE POLICY cr_anon_select ON public.customer_requests
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.customer_requests TO anon;

-- ───────────── 2. company_registrations ──────────────────────────
DROP POLICY IF EXISTS cr_anon_select ON public.company_registrations;
CREATE POLICY cr_anon_select ON public.company_registrations
  FOR SELECT TO anon USING (true);

GRANT SELECT ON public.company_registrations TO anon;

-- ───────────── 3. authenticated RETURNING also needs SELECT ──────
-- Authenticated users submitting the customer form hit the same
-- RETURNING check. cr_select_auth already exists for customer_requests
-- (added in 20260731000005); make sure company_registrations has a
-- matching authenticated SELECT policy too.
DROP POLICY IF EXISTS cr_select_auth ON public.company_registrations;
CREATE POLICY cr_select_auth ON public.company_registrations
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.company_registrations TO authenticated;
