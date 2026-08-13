-- =====================================================================
-- FACTORYOS AI — SUPPLIER ISOLATION HARDENING (2026-08-17)
--
-- Every supplier-scoped RLS branch previously checked only
-- `supplier_id = current_supplier_id()`. Because supplier ids are global
-- UUIDs, a PO / invoice / payment / message created under ANOTHER company
-- but addressed to this supplier id would have been visible. This pass
-- adds an explicit single-tenant guard: the row's company_id must equal
-- the company the supplier itself belongs to.
-- =====================================================================

-- Helper: the company_id of the caller's own supplier row (NULL if not linked)
CREATE OR REPLACE FUNCTION public.current_supplier_company()
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT s.company_id
  FROM public.suppliers s
  WHERE s.id = public.current_supplier_id()
  LIMIT 1;
$function$;

-- ─────────────── PURCHASE ORDERS ───────────────
DROP POLICY IF EXISTS po_select_supplier_own ON public.purchase_orders;
CREATE POLICY po_select_supplier_own ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (company_id = current_company_id() AND NOT is_supplier_portal())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
  );

DROP POLICY IF EXISTS po_update_supplier_own ON public.purchase_orders;
CREATE POLICY po_update_supplier_own ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('procurement_manager','company_admin')
      )
    )
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
      AND status IN ('sent','pending','modification_requested','accepted','in_progress')
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('procurement_manager','company_admin')
      )
    )
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
  );

-- ─────────────── SUPPLIERS ───────────────
DROP POLICY IF EXISTS suppliers_select_own_or_ops ON public.suppliers;
CREATE POLICY suppliers_select_own_or_ops ON public.suppliers
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND id = current_supplier_id()
    )
    OR (
      NOT is_supplier_portal()
      AND in_company_ops(company_id)
    )
  );

DROP POLICY IF EXISTS suppliers_update_scoped ON public.suppliers;
CREATE POLICY suppliers_update_scoped ON public.suppliers
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND id = current_supplier_id()
    )
    OR (
      NOT is_supplier_portal()
      AND NOT is_auditor()
      AND in_company_ops(company_id)
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND id = current_supplier_id()
    )
    OR (
      NOT is_supplier_portal()
      AND NOT is_auditor()
      AND in_company_ops(company_id)
    )
  );

-- ─────────────── SUPPLIER INVOICES ───────────────
DROP POLICY IF EXISTS supplier_invoices_select ON public.supplier_invoices;
CREATE POLICY supplier_invoices_select ON public.supplier_invoices
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
    OR (NOT is_supplier_portal() AND in_company_ops(company_id))
  );

DROP POLICY IF EXISTS supplier_invoices_insert ON public.supplier_invoices;
CREATE POLICY supplier_invoices_insert ON public.supplier_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

-- ─────────────── SUPPLIER PAYMENTS ───────────────
DROP POLICY IF EXISTS supplier_payments_select ON public.supplier_payments;
CREATE POLICY supplier_payments_select ON public.supplier_payments
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
    OR (NOT is_supplier_portal() AND in_company_ops(company_id))
  );

-- ─────────────── SUPPLIER MESSAGES ───────────────
DROP POLICY IF EXISTS supplier_messages_select ON public.supplier_messages;
CREATE POLICY supplier_messages_select ON public.supplier_messages
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND company_id = current_supplier_company()
      AND (supplier_id = current_supplier_id() OR po_id IN (
        SELECT id FROM public.purchase_orders
        WHERE supplier_id = current_supplier_id()
          AND company_id = current_supplier_company()
      ))
    )
    OR (
      NOT is_supplier_portal()
      AND in_company_ops(company_id)
    )
  );

DROP POLICY IF EXISTS supplier_messages_insert ON public.supplier_messages;
CREATE POLICY supplier_messages_insert ON public.supplier_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
    OR (
      NOT is_supplier_portal()
      AND NOT is_auditor()
      AND in_company_ops(company_id)
    )
  );

-- ─────────────── SUPPLIER DELIVERIES ───────────────
DROP POLICY IF EXISTS supplier_deliveries_select ON public.supplier_deliveries;
CREATE POLICY supplier_deliveries_select ON public.supplier_deliveries
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
    OR (NOT is_supplier_portal() AND in_company_ops(company_id))
  );

DROP POLICY IF EXISTS supplier_deliveries_insert ON public.supplier_deliveries;
CREATE POLICY supplier_deliveries_insert ON public.supplier_deliveries
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
    OR (NOT is_supplier_portal() AND NOT is_auditor() AND in_company_ops(company_id))
  );

-- Confirm
SELECT policyname, tablename
FROM pg_policies
WHERE tablename IN ('purchase_orders','suppliers','supplier_invoices','supplier_payments','supplier_messages','supplier_deliveries')
  AND policyname LIKE '%supplier%'
ORDER BY tablename, policyname;
