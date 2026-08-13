-- =====================================================================
-- FACTORYOS AI — SUPPLIER READ-BLOCK ON INTERNAL ERP (2026-08-17)
--
-- Root cause: `current_company_id()` resolves a company for ANY
-- authenticated user (it reads user_roles), and `in_company_ops()` /
-- `in_company()` never excluded the EXTERNAL supplier_portal role. As a
-- result the supplier could SELECT company inventory, customers,
-- sales_orders, qr_codes and every other table that uses these helpers.
--
-- Fix: these helpers now return false for supplier_portal (the supplier
-- must never read internal ERP data). customer_portal keeps its access
-- because its flows legitimately read materials/prices and its
-- customer-scoped policies already gate the sensitive tables.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.in_company_ops(_cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    _cid IS NOT NULL
    AND _cid = public.current_company_id()
    AND NOT public.is_supplier_portal()
  );
$function$;

CREATE OR REPLACE FUNCTION public.in_company(_cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    public.is_root_admin(auth.uid())
    OR (
      _cid IS NOT NULL
      AND _cid = public.current_company_id()
      AND NOT public.is_supplier_portal()
    )
  );
$function$;

-- qr_codes used a bare company check (no helper) — same leak.
DROP POLICY IF EXISTS qr_select_ops ON public.qr_codes;
CREATE POLICY qr_select_ops ON public.qr_codes
  FOR SELECT TO authenticated
  USING (
    company_id = current_company_id()
    AND NOT is_supplier_portal()
  );

-- Confirm
SELECT proname
FROM pg_proc
WHERE proname IN ('in_company_ops', 'in_company');
