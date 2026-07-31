-- =============================================================
-- FACTORYOS AI — REFINE anon SELECT scoping + drop redundancy
-- Follow-up to 20260731000006:
-- 1. Privacy: the app only ever reads back the `id` column after
--    a public registration insert (`.insert().select("id").single()`).
--    Narrow the anon SELECT grant to the `id` column so no PII
--    (business name, email, phone, GST, address) is readable by
--    anonymous visitors, while `RETURNING id` still succeeds.
-- 2. company_registrations already has `cr_select` (USING true) for
--    authenticated from migration 20260727000000 — drop the
--    redundant `cr_select_auth` added in 20260731000006.
-- =============================================================

-- ───────────── 1. customer_requests: anon SELECT → id column only ─────
REVOKE SELECT ON public.customer_requests FROM anon;
GRANT SELECT (id) ON public.customer_requests TO anon;

-- ───────────── 2. company_registrations: anon SELECT → id column only ─
REVOKE SELECT ON public.company_registrations FROM anon;
GRANT SELECT (id) ON public.company_registrations TO anon;

-- ───────────── 3. drop redundant authenticated SELECT policy ──────────
DROP POLICY IF EXISTS cr_select_auth ON public.company_registrations;
