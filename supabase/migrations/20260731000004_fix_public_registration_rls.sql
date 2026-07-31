-- =============================================================
-- FACTORYOS AI — FIX PUBLIC REGISTRATION RLS
-- Two issues:
-- 1. company_registrations has a cr_anon_insert policy (WITH CHECK true)
--    but NO GRANT for the anon role, so anonymous users can't INSERT.
-- 2. customer_requests has GRANT INSERT, SELECT TO anon and a
--    cr_anon_insert policy, but the cr_insert_own policy (authenticated)
--    may conflict. We ensure both work correctly.
-- =============================================================

-- Grant anon access to company_registrations (was missing)
GRANT SELECT, INSERT ON public.company_registrations TO anon;

-- Ensure customer_requests grants for anon are explicit
GRANT SELECT, INSERT ON public.customer_requests TO anon;

-- Also ensure the notifications table allows anon to insert (for the
-- notification sent when a customer submits a request)
GRANT INSERT ON public.notifications TO anon;