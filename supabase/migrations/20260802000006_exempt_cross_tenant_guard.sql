-- =============================================================
-- FACTORYOS AI — EXEMPT CROSS-TENANT GUARD ON SPECIAL TABLES
-- The block_cross_tenant_writes trigger added in 20260802000005
-- attaches to every table with a company_id column, but three
-- tables must be exempt because their legit flows are NOT
-- same-company writes:
--
--   1. profiles     — on BEFORE INSERT the row doesn't exist yet,
--                     so current_company_id() returns NULL and a
--                     non-null NEW.company_id falsely raises,
--                     breaking signup/whitelist profile creation.
--   2. user_roles   — role rows can be created for other users by
--                     root/admin flows; not a tenant-write vector.
--   3. customer_requests — requester legitimately selects ANY
--                     active company (cross-company request), so a
--                     user from Company A requesting Company B must
--                     be allowed (enforced by its own policies).
--
-- We simply drop the guard trigger on these three tables. The
-- rest of the schema keeps the guard.
-- =============================================================

DROP TRIGGER IF EXISTS trg_cross_tenant_guard ON public.profiles;
DROP TRIGGER IF EXISTS trg_cross_tenant_guard ON public.user_roles;
DROP TRIGGER IF EXISTS trg_cross_tenant_guard ON public.customer_requests;
