-- FactoryOS AI: HR Manager, Finance Manager & Maintenance Engineer scope
-- hardening.
--
-- The three role specs define strict CANNOT lists (HR: no production /
-- inventory / orders / finance; Finance: no inventory / production / orders /
-- payroll; Maintenance: no inventory / orders / finance / production). The
-- shared in_company_ops() helper grants every internal ops role company-wide
-- SELECT, and the broad internal write guard grants every non-operator role
-- INSERT/UPDATE on internal tables — both predate these three roles' scopes.
--
-- This migration excludes each role from the tables outside its scope while
-- leaving every other role, the Auditor (kept via the is_auditor() branches),
-- and the role's own legitimate tables untouched.

-- ── Role helpers ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_hr_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'hr_manager'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_maintenance_engineer()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'maintenance_engineer'
  );
$$;

-- ── 1) HR Manager: exclude from production / inventory / orders / finance ───
DO $$
DECLARE
  r record;
  q text;
  w text;
  tbl CONSTANT text[] := ARRAY[
    'inventory','machines','products','customers','suppliers','sales_orders',
    'customer_orders','production_orders','work_orders','invoices','payments',
    'shipments','purchase_orders','quality_inspections','support_tickets',
    'expenses','taxes','budgets','supplier_invoices','supplier_payments',
    'spare_parts','machine_breakdowns','machine_status_log',
    'maintenance_schedules','maintenance_tickets','materials','packing',
    'qr_codes','goods_receipts','stock_transfers','cycle_counts','bom',
    'warehouses','rfqs','purchase_requisitions'
  ];
  guard CONSTANT text := '(NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator())';
  guard_new CONSTANT text := guard || ' AND (NOT is_hr_manager())';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = ANY(tbl)
      AND (qual ILIKE '%in_company_ops(company_id)%'
        OR with_check ILIKE '%in_company_ops(company_id)%'
        OR qual ILIKE '%' || guard || '%'
        OR with_check ILIKE '%' || guard || '%')
    ORDER BY tablename, policyname
  LOOP
    q := r.qual; w := r.with_check;
    IF r.cmd = 'SELECT' THEN
      q := replace(q, 'in_company_ops(company_id)',
        '(in_company_ops(company_id) AND NOT is_hr_manager())');
    ELSE
      IF q IS NOT NULL THEN
        q := replace(q, guard, guard_new);
        q := replace(q, 'in_company_ops(company_id)',
          '(in_company_ops(company_id) AND NOT is_hr_manager())');
      END IF;
      IF w IS NOT NULL THEN
        w := replace(w, guard, guard_new);
        w := replace(w, 'in_company_ops(company_id)',
          '(in_company_ops(company_id) AND NOT is_hr_manager())');
      END IF;
    END IF;
    IF r.cmd = 'SELECT' OR r.cmd = 'DELETE' THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated USING (%s)',
        r.policyname, r.schemaname, r.tablename, q);
    ELSIF r.cmd = 'INSERT' THEN
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
    RAISE NOTICE 'HR-hardened % ON % (%)', r.policyname, r.tablename, r.cmd;
  END LOOP;
END $$;

-- ── 2) Finance Manager: exclude from inventory / production / orders / HR ───
DO $$
DECLARE
  r record;
  q text;
  w text;
  sel CONSTANT text[] := ARRAY[
    'inventory','machines','work_orders','production_orders','shipments',
    'employees','attendance','leaves','spare_parts','machine_breakdowns',
    'machine_status_log','maintenance_schedules','maintenance_tickets',
    'materials','packing','goods_receipts','stock_transfers','cycle_counts',
    'bom','warehouses','rfqs','purchase_requisitions','quality_inspections',
    'support_tickets','customer_orders','sales_orders'
  ];
  wrt CONSTANT text[] := sel || ARRAY[
    'products','customers','suppliers','departments','job_postings',
    'candidates','whitelist','trainings'
  ];
  guard CONSTANT text := '(NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator())';
  guard_new CONSTANT text := guard || ' AND (NOT is_finance_manager())';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = ANY(wrt)
      AND cmd <> 'SELECT'
      AND (qual ILIKE '%in_company_ops(company_id)%'
        OR with_check ILIKE '%in_company_ops(company_id)%'
        OR qual ILIKE '%' || guard || '%'
        OR with_check ILIKE '%' || guard || '%')
    ORDER BY tablename, policyname
  LOOP
    q := r.qual; w := r.with_check;
    IF q IS NOT NULL THEN
      q := replace(q, guard, guard_new);
      q := replace(q, 'in_company_ops(company_id)',
        '(in_company_ops(company_id) AND NOT is_finance_manager())');
    END IF;
    IF w IS NOT NULL THEN
      w := replace(w, guard, guard_new);
      w := replace(w, 'in_company_ops(company_id)',
        '(in_company_ops(company_id) AND NOT is_finance_manager())');
    END IF;
    IF r.cmd = 'DELETE' THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated USING (%s)',
        r.policyname, r.schemaname, r.tablename, q);
    ELSIF r.cmd = 'INSERT' THEN
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
    RAISE NOTICE 'FINANCE-hardened % ON % (%)', r.policyname, r.tablename, r.cmd;
  END LOOP;

  -- Finance Manager read-block on the same production/HR surface (in_company_ops
  -- grants company-wide SELECT to every internal ops role).
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = ANY(sel)
      AND cmd = 'SELECT'
      AND qual ILIKE '%in_company_ops(company_id)%'
    ORDER BY tablename, policyname
  LOOP
    q := replace(r.qual, 'in_company_ops(company_id)',
      '(in_company_ops(company_id) AND NOT is_finance_manager())');
    EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated USING (%s)',
      r.policyname, r.schemaname, r.tablename, q);
    RAISE NOTICE 'FINANCE-read-hardened % ON %', r.policyname, r.tablename;
  END LOOP;
END $$;

-- ── 3) Maintenance Engineer: exclude from inventory / orders / finance / HR ──
DO $$
DECLARE
  r record;
  q text;
  w text;
  tbl CONSTANT text[] := ARRAY[
    'inventory','products','customers','suppliers','sales_orders',
    'customer_orders','invoices','payments','shipments','purchase_orders',
    'supplier_invoices','supplier_payments','expenses','taxes','budgets',
    'employees','attendance','payroll','leaves','materials','packing',
    'goods_receipts','stock_transfers','cycle_counts','bom','warehouses',
    'qr_codes','quality_inspections','support_tickets','departments',
    'job_postings','candidates','production_orders','rfqs',
    'purchase_requisitions','work_orders'
  ];
  guard CONSTANT text := '(NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator())';
  guard_new CONSTANT text := guard || ' AND (NOT is_maintenance_engineer())';
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname, cmd, qual, with_check
    FROM pg_policies
    WHERE tablename = ANY(tbl)
      AND (qual ILIKE '%in_company_ops(company_id)%'
        OR with_check ILIKE '%in_company_ops(company_id)%'
        OR qual ILIKE '%' || guard || '%'
        OR with_check ILIKE '%' || guard || '%')
    ORDER BY tablename, policyname
  LOOP
    q := r.qual; w := r.with_check;
    IF r.cmd = 'SELECT' THEN
      q := replace(q, 'in_company_ops(company_id)',
        '(in_company_ops(company_id) AND NOT is_maintenance_engineer())');
    ELSE
      IF q IS NOT NULL THEN
        q := replace(q, guard, guard_new);
        q := replace(q, 'in_company_ops(company_id)',
          '(in_company_ops(company_id) AND NOT is_maintenance_engineer())');
      END IF;
      IF w IS NOT NULL THEN
        w := replace(w, guard, guard_new);
        w := replace(w, 'in_company_ops(company_id)',
          '(in_company_ops(company_id) AND NOT is_maintenance_engineer())');
      END IF;
    END IF;
    IF r.cmd = 'SELECT' OR r.cmd = 'DELETE' THEN
      EXECUTE format('ALTER POLICY %I ON %I.%I TO authenticated USING (%s)',
        r.policyname, r.schemaname, r.tablename, q);
    ELSIF r.cmd = 'INSERT' THEN
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
    RAISE NOTICE 'MAINT-hardened % ON % (%)', r.policyname, r.tablename, r.cmd;
  END LOOP;
END $$;

-- ── 3b) Whitelist: HR may SUBMIT a request (existing onboarding flow) but may
-- NOT decide it — approving/rejecting whitelist status stays Company Admin's.
DROP POLICY IF EXISTS whitelist_update ON public.whitelist;
CREATE POLICY whitelist_update ON public.whitelist FOR UPDATE TO authenticated
USING (
  (((NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator()) AND (NOT is_hr_manager())) OR is_root_admin(auth.uid()))
)
WITH CHECK (
  (((NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal()) AND (NOT is_production_operator()) AND (NOT is_hr_manager())) OR is_root_admin(auth.uid()))
);

-- ── 4) Work orders: maintenance engineer must NOT modify them ───────────────
-- Maintenance Engineer must not see or modify work orders either.
DROP POLICY IF EXISTS work_orders_select_scoped ON public.work_orders;
CREATE POLICY work_orders_select_scoped ON public.work_orders FOR SELECT TO authenticated
USING (
  is_root_admin(auth.uid())
  OR (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('company_admin','plant_admin','plant_manager','production_manager','quality_inspector')
    )
  )
);

DROP POLICY IF EXISTS work_orders_update_scoped ON public.work_orders;
CREATE POLICY work_orders_update_scoped ON public.work_orders FOR UPDATE TO authenticated
USING (
  is_root_admin(auth.uid())
  OR (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('company_admin','plant_admin','plant_manager','production_manager','quality_inspector')
    )
  )
)
WITH CHECK (
  is_root_admin(auth.uid())
  OR (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('company_admin','plant_admin','plant_manager','production_manager','quality_inspector')
    )
  )
);

GRANT USAGE ON SCHEMA public TO authenticated;
