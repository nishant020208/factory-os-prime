-- FactoryOS AI: Production Operator write-access hardening.
--
-- Live RLS testing found the operator role leaking access through two legacy
-- policy patterns that predate the operator role:
--
--   1) WRITE policies using `(NOT is_auditor()) AND (NOT is_customer_portal())
--      AND (NOT is_supplier_portal())` — this broad "internal user" check
--      INCLUDES production_operator, letting the operator INSERT/UPDATE
--      inventory, employees, whitelist, quality inspections, budgets,
--      expenses, taxes, goods receipts, spare parts, stock transfers,
--      shift schedules, trainings, cycle counts, BOM, departments, tasks,
--      warehouses, companies, approvals and more.
--
--   2) SELECT policies using the same broad check or a raw profiles.company_id
--      lookup — letting the operator read purchase orders, QR-code tokens,
--      packing records and the material master.
--
-- The operator's scope is "my own work" only (own work orders, own attendance,
-- own reported issues). This migration excludes the operator from every
-- internal write/read path while leaving every other role's access unchanged.

CREATE OR REPLACE FUNCTION public.is_production_operator()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'production_operator'
  );
$$;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1) Rewrite every INSERT/UPDATE policy that uses the broad "internal user"
--    pattern so it also excludes the operator. Policies scoped via
--    in_company(company_id) are upgraded to in_company_ops(company_id),
--    which excludes customer/supplier/operator.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
DECLARE
  r record;
  q text;
  w text;
  marker CONSTANT text := '(NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())';
  guard CONSTANT text := '(NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator())';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE cmd IN ('INSERT','UPDATE')
      AND (qual ILIKE '%' || marker || '%' OR with_check ILIKE '%' || marker || '%')
    ORDER BY tablename, policyname
  LOOP
    q := NULL; w := NULL;
    IF r.qual IS NOT NULL AND r.qual LIKE '%' || marker || '%' THEN
      q := replace(r.qual, marker, guard);
      q := replace(q, 'in_company(company_id)', 'in_company_ops(company_id)');
    END IF;
    IF r.with_check IS NOT NULL AND r.with_check LIKE '%' || marker || '%' THEN
      w := replace(r.with_check, marker, guard);
      w := replace(w, 'in_company(company_id)', 'in_company_ops(company_id)');
    END IF;
    IF q IS NOT NULL OR w IS NOT NULL THEN
      IF r.cmd = 'INSERT' THEN
        EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated WITH CHECK (%s)',
          r.policyname, r.schemaname, r.tablename, w);
      ELSIF r.cmd = 'UPDATE' THEN
        IF w IS NOT NULL THEN
          EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated USING (%s) WITH CHECK (%s)',
            r.policyname, r.schemaname, r.tablename, q, w);
        ELSE
          EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated USING (%s)',
            r.policyname, r.schemaname, r.tablename, q);
        END IF;
      END IF;
      RAISE NOTICE 'Hardened % ON % (%)', r.policyname, r.tablename, r.cmd;
    END IF;
  END LOOP;
END $$;

-- Restore the two approvals policies touched during syntax verification
-- (they were temporarily clobbered with bare (NOT is_auditor()) probes).
ALTER POLICY approvals_insert ON public.approvals TO authenticated WITH CHECK (
  (((NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator())) OR is_root_admin(auth.uid()))
);
ALTER POLICY approvals_update ON public.approvals TO authenticated
USING (
  (((NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator())) OR is_root_admin(auth.uid()))
)
WITH CHECK (
  (((NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator())) OR is_root_admin(auth.uid()))
);

-- ─────────────────────────────────────────────────────────────────────────────
-- 2) SELECT-policy fixes (the four broad grants found by live probing).
-- ─────────────────────────────────────────────────────────────────────────────

-- Purchase orders: the middle branch granted every non-external user
-- (including the operator) SELECT on all company POs.
DROP POLICY IF EXISTS po_select_supplier_own ON public.purchase_orders;
CREATE POLICY po_select_supplier_own ON public.purchase_orders FOR SELECT TO authenticated
USING (
  is_root_admin(auth.uid())
  OR in_company_ops(company_id)
  OR (is_supplier_portal() AND supplier_id = current_supplier_id() AND company_id = current_supplier_company())
);

-- QR codes: the internal branch granted every non-external user (including the
-- operator) SELECT on all company QR tokens. Portal branches unchanged.
DROP POLICY IF EXISTS qr_select_ops ON public.qr_codes;
CREATE POLICY qr_select_ops ON public.qr_codes FOR SELECT TO authenticated
USING (
  company_id = current_company_id() AND (
    in_company_ops(company_id)
    OR (is_supplier_portal() AND type = 'inbound_shipment' AND entity_id IN (
      SELECT purchase_orders.id FROM purchase_orders
      WHERE purchase_orders.supplier_id = current_supplier_id()
        AND purchase_orders.company_id = current_supplier_company()
    ))
    OR (is_customer_portal() AND (
      entity_id IN (SELECT sales_orders.id FROM sales_orders
        WHERE sales_orders.customer_id IN (SELECT customers.id FROM customers
          WHERE customers.user_id = auth.uid()))
      OR entity_id IN (SELECT invoices.id FROM invoices
        WHERE invoices.customer_id IN (SELECT customers.id FROM customers
          WHERE customers.user_id = auth.uid()))
      OR entity_id IN (SELECT shipments.id FROM shipments
        WHERE shipments.customer_id IN (SELECT customers.id FROM customers
          WHERE customers.user_id = auth.uid()))
    ))
  )
);

-- Packing lists: the raw profiles.company_id lookup granted the operator reads.
DROP POLICY IF EXISTS pck_select_company ON public.packing;
CREATE POLICY pck_select_company ON public.packing FOR SELECT TO authenticated
USING (in_company_ops(company_id));

-- Material master: same raw profiles.company_id lookup.
DROP POLICY IF EXISTS mat_select_company ON public.materials;
CREATE POLICY mat_select_company ON public.materials FOR SELECT TO authenticated
USING (in_company_ops(company_id));

GRANT USAGE ON SCHEMA public TO authenticated;
