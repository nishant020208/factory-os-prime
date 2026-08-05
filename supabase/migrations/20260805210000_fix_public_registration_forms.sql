-- =============================================================
-- FACTORYOS AI — FIX PUBLIC REGISTRATION FORMS
-- Root cause: migration 20260805135854 dropped the cr_anon_select
-- policies on company_registrations and customer_requests (added by
-- 20260802000000). The public forms in auth.tsx (RegisterCompany /
-- RegisterCustomer) submit with
--   supabase.from("company_registrations").insert({...}).select("id").single()
-- i.e. `Prefer: return=representation` → Postgres runs
-- `INSERT ... RETURNING id`, which re-checks SELECT RLS on the
-- returned row. With no anon SELECT policy, anonymous visitors get:
--   "new row violates row-level security policy for table ..."
-- and cannot register at all.
--
-- Security intent preserved: anon may SELECT the `id` column ONLY
-- (column-restricted grant), never the PII columns (email, phone,
-- business name, address, GST). Only authenticated roles with the
-- cr_select_root / cr_select_auth policies can read the rest.
-- =============================================================

-- ───────────── 1. company_registrations ───────────────────────
DROP POLICY IF EXISTS cr_anon_select ON public.company_registrations;
CREATE POLICY cr_anon_select ON public.company_registrations
  FOR SELECT TO anon USING (true);

REVOKE SELECT ON public.company_registrations FROM anon;
GRANT SELECT (id) ON public.company_registrations TO anon;

-- ───────────── 2. customer_requests ───────────────────────────
DROP POLICY IF EXISTS cr_anon_select ON public.customer_requests;
CREATE POLICY cr_anon_select ON public.customer_requests
  FOR SELECT TO anon USING (true);

REVOKE SELECT ON public.customer_requests FROM anon;
GRANT SELECT (id) ON public.customer_requests TO anon;
