-- =============================================================
-- FACTORYOS AI — CROSS-TENANT WRITE GUARD + TEMP CLEANUP
-- 1. Drop the temporary debug_policies() RPC (added in
--    20260802000002/20260802000004 for audit introspection).
-- 2. Close the cross-tenant WRITE hole: the restored backup left
--    permissive <table>_insert/_update/_delete policies on ~60
--    tables whose only write check is `NOT is_auditor()` — no
--    company_id scoping. Any authenticated non-auditor could
--    INSERT/UPDATE/DELETE rows belonging to ANY company.
--    Rather than rewriting 180 policies by hand, add a single
--    DB-layer trigger guard on every public table that has a
--    company_id column: writes to a different company are blocked
--    unless the actor is Root or the write comes from an anon /
--    service context (no auth.uid()).
-- =============================================================

-- ───────────── 1. DROP TEMP DEBUG RPC ───────────────────────────────
DROP FUNCTION IF EXISTS public.debug_policies();

-- ───────────── 2. CROSS-TENANT WRITE GUARD ──────────────────────────
CREATE OR REPLACE FUNCTION public.block_cross_tenant_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row_company uuid;
BEGIN
  -- Anonymous / service-role writes (no authenticated user) are allowed:
  -- signup triggers, anon customer registration, seeding, etc.
  IF _uid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Root Super Admin bypasses tenant scoping.
  IF is_root_admin(_uid) THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Pick the company_id from the row (NEW for INSERT/UPDATE, OLD for DELETE).
  IF TG_OP = 'DELETE' THEN
    _row_company := OLD.company_id;
  ELSE
    _row_company := NEW.company_id;
  END IF;

  -- No company_id on the row (e.g. null) → nothing to enforce.
  IF _row_company IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Block writes to a row whose company differs from the actor's company.
  IF _row_company IS DISTINCT FROM public.current_company_id() THEN
    RAISE EXCEPTION 'Cross-tenant write blocked: row company % does not match your company (table: %)',
      _row_company, TG_TABLE_NAME;
  END IF;

  RETURN COALESCE(NEW, OLD);
END $$;

-- Attach the guard to every public table that has a company_id column.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN information_schema.columns col
      ON col.table_schema = n.nspname
     AND col.table_name = c.relname
     AND col.column_name = 'company_id'
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
    GROUP BY c.relname
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_cross_tenant_guard ON public.%I;', t.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_cross_tenant_guard
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.block_cross_tenant_writes();', t.tbl);
  END LOOP;
END $$;
