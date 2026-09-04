-- =====================================================================
-- FACTORYOS AI — CUSTOMER REQUESTS CITY COLUMN (2026-09-04)
--
-- The customer registration form captures a City / Location field used
-- for nearest-plant auto-assignment. Additive column only.
-- =====================================================================

ALTER TABLE public.customer_requests ADD COLUMN IF NOT EXISTS city text;