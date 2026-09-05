-- =====================================================================
-- FACTORYOS AI — OPERATOR READ FIX + AUTO-GENERATED BOM (2026-09-05)
--
--  1. WHITELIST READ FOR INTERNAL OPS: whitelist had SELECT policies only
--     for root / company_admin / plant_admin, so Production Manager (and
--     HR on the Employees page) silently got zero rows — the Assign
--     Operator dropdown in Production Planning showed no operators. Add a
--     company-ops SELECT policy so internal employees can read their own
--     company's whitelist (invite/approval data). Customer / supplier /
--     auditor stay excluded.
--
--  2. AUTO-GENERATED BOM HEADER: every new product now gets its BOM
--     header automatically (version 'v1', status 'active') the moment it
--     is created — via a DB trigger, so it happens for the UI, seeds and
--     any server-side flow alike. Production Planning then always has a
--     BOM to attach raw-material components to.
--
--  3. BACKFILL: any existing product without a BOM header gets one
--     (idempotent — additive, nothing deleted or recreated).
--
-- DATA-SAFETY: additive only — all existing materials, products, BOMs
-- and whitelist rows are untouched.
-- =====================================================================

-- ─────────────── 1. WHITELIST READ FOR INTERNAL OPS ───────────────
DROP POLICY IF EXISTS whitelist_select_ops ON public.whitelist;
CREATE POLICY whitelist_select_ops ON public.whitelist
  FOR SELECT TO authenticated
  USING (
    in_company_ops(company_id)
  );

-- ─────────────── 2. AUTO-GENERATED BOM HEADER ON PRODUCT CREATE ───────────────
CREATE OR REPLACE FUNCTION public.auto_create_bom_header()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.bom (company_id, product_id, version, status, notes)
  VALUES (NEW.company_id, NEW.id, 'v1', 'active', 'Auto-generated BOM for ' || NEW.name);
  RETURN NEW;
END $function$;

DROP TRIGGER IF EXISTS auto_create_bom_header ON public.products;
CREATE TRIGGER auto_create_bom_header
  AFTER INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.auto_create_bom_header();

-- ─────────────── 3. BACKFILL — existing products without a BOM header ───────────────
INSERT INTO public.bom (company_id, product_id, version, status, notes)
SELECT p.company_id, p.id, 'v1', 'active', 'Auto-generated BOM for ' || p.name
FROM public.products p
WHERE NOT EXISTS (
  SELECT 1 FROM public.bom b WHERE b.product_id = p.id
);