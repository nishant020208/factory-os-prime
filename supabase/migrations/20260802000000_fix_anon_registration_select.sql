-- =============================================================
-- FACTORYOS AI — FIX anon INSERT...RETURNING for public intake forms
-- Root cause: migration 20260801035651 dropped the cr_anon_select
-- policies on customer_requests and company_registrations. The public
-- registration forms (auth.tsx RegisterCustomer / RegisterCompany) still
-- submit with
--   supabase.from("customer_requests").insert({...}).select("id").single()
-- which sends `Prefer: return=representation`. PostgREST runs
-- `INSERT ... RETURNING id`, and Postgres checks the RETURNING row
-- against the table's SELECT policies. With no anon SELECT policy, the
-- RETURNING clause is rejected:
--   new row violates row-level security policy for table "customer_requests"
--   (SQLSTATE 42501, surfaced by PostgREST as HTTP 401/403).
--
-- Fix: restore a permissive anon SELECT policy on both tables while
-- keeping the column-level grant from 20260731000007 (SELECT (id) ONLY)
-- so anonymous visitors can ONLY ever read back the inserted row's id —
-- never business_name / email / phone / GST / address (no PII exposure).
-- =============================================================

-- ───────────── 1. customer_requests ──────────────────────────────
DROP POLICY IF EXISTS cr_anon_select ON public.customer_requests;
CREATE POLICY cr_anon_select ON public.customer_requests
  FOR SELECT TO anon USING (true);

-- Keep the narrow column grant: anon may read the id column only.
REVOKE SELECT ON public.customer_requests FROM anon;
GRANT SELECT (id) ON public.customer_requests TO anon;

-- ───────────── 2. company_registrations ──────────────────────────
DROP POLICY IF EXISTS cr_anon_select ON public.company_registrations;
CREATE POLICY cr_anon_select ON public.company_registrations
  FOR SELECT TO anon USING (true);

REVOKE SELECT ON public.company_registrations FROM anon;
GRANT SELECT (id) ON public.company_registrations TO anon;
