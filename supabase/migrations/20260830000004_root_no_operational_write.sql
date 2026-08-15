-- =====================================================================
-- FACTORYOS AI — ROOT SUPER ADMIN: NO OPERATIONAL WRITE BACKDOOR
-- (2026-08-30)
--
-- Root Super Admin is the platform owner — it approves companies,
-- whitelists Company Admins and watches platform-wide aggregates. It
-- must NOT have routine write access into any single company's
-- day-to-day operational data (orders, work orders, inventory,
-- invoices, employees, payroll, machines, inspections, POs).
--
-- The live policy dump showed `OR is_root_admin(auth.uid())` write
-- branches on every operational table — a superuser backdoor that
-- undermines the per-role isolation verified across all 14 other role
-- builds. Each is removed below; Root keeps SELECT everywhere (via the
-- is_root_admin read branches already present) and keeps write access
-- to PLATFORM tables only (companies, whitelist, platform_settings,
-- company_registrations, audit_logs).
-- =====================================================================

-- ── sales_orders ─────────────────────────────────────────────────────
DROP POLICY IF EXISTS sales_orders_insert_iso ON public.sales_orders;
CREATE POLICY sales_orders_insert_iso ON public.sales_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_customer_portal()
      AND company_id = public.current_company_id()
      AND customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id)
        AND (NOT is_maintenance_engineer()) AND (NOT is_finance_manager()) AND (NOT is_hr_manager()))
  );

DROP POLICY IF EXISTS sales_orders_update_iso ON public.sales_orders;
CREATE POLICY sales_orders_update_iso ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (
    (NOT public.is_customer_portal()) AND public.in_company_ops(company_id)
    AND (NOT is_maintenance_engineer()) AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  )
  WITH CHECK (
    (NOT public.is_customer_portal()) AND public.in_company_ops(company_id)
    AND (NOT is_maintenance_engineer()) AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  );

DROP POLICY IF EXISTS sales_orders_delete_iso ON public.sales_orders;
CREATE POLICY sales_orders_delete_iso ON public.sales_orders
  FOR DELETE TO authenticated
  USING (
    (NOT public.is_customer_portal()) AND public.in_company_ops(company_id)
    AND (NOT is_maintenance_engineer()) AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  );

-- ── work_orders ──────────────────────────────────────────────────────
DROP POLICY IF EXISTS work_orders_update_scoped ON public.work_orders;
CREATE POLICY work_orders_update_scoped ON public.work_orders
FOR UPDATE TO authenticated
USING (
  (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('production_manager','quality_inspector')
    )
  )
)
WITH CHECK (
  (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role IN ('production_manager','quality_inspector')
    )
  )
);

DROP POLICY IF EXISTS work_orders_delete_admin ON public.work_orders;
CREATE POLICY work_orders_delete_admin ON public.work_orders
FOR DELETE TO authenticated
USING (
  company_id = current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'company_admin'::public.app_role
  )
);

-- ── inventory ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS inventory_insert ON public.inventory;
CREATE POLICY inventory_insert ON public.inventory
FOR INSERT TO authenticated
WITH CHECK (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  AND (NOT is_production_manager()) AND (NOT is_plant_manager())
  AND (NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'::public.app_role
  ))
);

DROP POLICY IF EXISTS inventory_update ON public.inventory;
CREATE POLICY inventory_update ON public.inventory
FOR UPDATE TO authenticated
USING (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  AND (NOT is_production_manager()) AND (NOT is_plant_manager())
  AND (NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'::public.app_role
  ))
)
WITH CHECK (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
  AND (NOT is_production_manager()) AND (NOT is_plant_manager())
  AND (NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'::public.app_role
  ))
);

DROP POLICY IF EXISTS inventory_delete ON public.inventory;
CREATE POLICY inventory_delete ON public.inventory
FOR DELETE TO authenticated
USING (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
);

-- ── invoices ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS invoices_insert_iso ON public.invoices;
CREATE POLICY invoices_insert_iso ON public.invoices
FOR INSERT TO authenticated
WITH CHECK (
  (NOT is_customer_portal()) AND in_company_ops(company_id)
  AND (NOT is_maintenance_engineer()) AND (NOT is_hr_manager())
);

DROP POLICY IF EXISTS invoices_update_iso ON public.invoices;
CREATE POLICY invoices_update_iso ON public.invoices
FOR UPDATE TO authenticated
USING (
  (NOT is_customer_portal()) AND in_company_ops(company_id)
  AND (NOT is_maintenance_engineer()) AND (NOT is_hr_manager())
)
WITH CHECK (
  (NOT is_customer_portal()) AND in_company_ops(company_id)
  AND (NOT is_maintenance_engineer()) AND (NOT is_hr_manager())
);

DROP POLICY IF EXISTS invoices_delete_iso ON public.invoices;
CREATE POLICY invoices_delete_iso ON public.invoices
FOR DELETE TO authenticated
USING (
  (NOT is_customer_portal()) AND in_company_ops(company_id)
  AND (NOT is_maintenance_engineer()) AND (NOT is_hr_manager())
);

-- ── employees ────────────────────────────────────────────────────────
DROP POLICY IF EXISTS employees_insert ON public.employees;
CREATE POLICY employees_insert ON public.employees
FOR INSERT TO authenticated
WITH CHECK (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager())
);

DROP POLICY IF EXISTS employees_update ON public.employees;
CREATE POLICY employees_update ON public.employees
FOR UPDATE TO authenticated
USING (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager())
)
WITH CHECK (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager())
);

DROP POLICY IF EXISTS employees_delete ON public.employees;
CREATE POLICY employees_delete ON public.employees
FOR DELETE TO authenticated
USING (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
);

-- ── production_orders ────────────────────────────────────────────────
DROP POLICY IF EXISTS production_orders_insert_iso ON public.production_orders;
CREATE POLICY production_orders_insert_iso ON public.production_orders
FOR INSERT TO authenticated
WITH CHECK (
  (NOT is_customer_portal()) AND in_company_ops(company_id)
  AND (NOT is_maintenance_engineer()) AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
);

DROP POLICY IF EXISTS production_orders_update_iso ON public.production_orders;
CREATE POLICY production_orders_update_iso ON public.production_orders
FOR UPDATE TO authenticated
USING (
  (NOT is_customer_portal()) AND in_company_ops(company_id)
  AND (NOT is_maintenance_engineer()) AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
)
WITH CHECK (
  (NOT is_customer_portal()) AND in_company_ops(company_id)
  AND (NOT is_maintenance_engineer()) AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
);

DROP POLICY IF EXISTS production_orders_delete_iso ON public.production_orders;
CREATE POLICY production_orders_delete_iso ON public.production_orders
FOR DELETE TO authenticated
USING (
  (NOT is_customer_portal()) AND in_company_ops(company_id)
  AND (NOT is_maintenance_engineer()) AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
);

-- ── purchase_orders ──────────────────────────────────────────────────
DROP POLICY IF EXISTS po_insert_roles ON public.purchase_orders;
CREATE POLICY po_insert_roles ON public.purchase_orders
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('procurement_manager'::public.app_role, 'company_admin'::public.app_role)
  )
);

DROP POLICY IF EXISTS po_update_supplier_own ON public.purchase_orders;
CREATE POLICY po_update_supplier_own ON public.purchase_orders
FOR UPDATE TO authenticated
USING (
  (company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('procurement_manager'::public.app_role, 'company_admin'::public.app_role, 'warehouse_manager'::public.app_role)
    ))
  OR (is_supplier_portal() AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
      AND status IN ('sent','pending','modification_requested','accepted','in_progress'))
)
WITH CHECK (
  (company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role IN ('procurement_manager'::public.app_role, 'company_admin'::public.app_role, 'warehouse_manager'::public.app_role)
    ))
  OR (is_supplier_portal() AND supplier_id = current_supplier_id() AND company_id = current_supplier_company())
);

DROP POLICY IF EXISTS po_delete_admin ON public.purchase_orders;
CREATE POLICY po_delete_admin ON public.purchase_orders
FOR DELETE TO authenticated
USING (
  company_id = current_company_id()
  AND EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'company_admin'::public.app_role
  )
);

-- ── attendance (root was never granted; delete_manager/update_manager untouched) ──

-- ── payroll ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS payroll_insert ON public.payroll;
CREATE POLICY payroll_insert ON public.payroll
FOR INSERT TO authenticated
WITH CHECK (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
);

DROP POLICY IF EXISTS payroll_update ON public.payroll;
CREATE POLICY payroll_update ON public.payroll
FOR UPDATE TO authenticated
USING (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
)
WITH CHECK (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
);

DROP POLICY IF EXISTS payroll_delete ON public.payroll;
CREATE POLICY payroll_delete ON public.payroll
FOR DELETE TO authenticated
USING (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
);

-- ── machines ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS machines_insert ON public.machines;
CREATE POLICY machines_insert ON public.machines
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id() AND is_tenant_admin()
);

DROP POLICY IF EXISTS machines_update ON public.machines;
CREATE POLICY machines_update ON public.machines
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id() AND (is_tenant_admin() OR is_maintenance_engineer())
)
WITH CHECK (
  company_id = current_company_id() AND (is_tenant_admin() OR is_maintenance_engineer())
);

-- ── quality_inspections ──────────────────────────────────────────────
DROP POLICY IF EXISTS quality_inspections_insert ON public.quality_inspections;
CREATE POLICY quality_inspections_insert ON public.quality_inspections
FOR INSERT TO authenticated
WITH CHECK (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager()) AND (NOT is_hr_manager()) AND (NOT is_production_manager())
);

DROP POLICY IF EXISTS quality_inspections_update ON public.quality_inspections;
CREATE POLICY quality_inspections_update ON public.quality_inspections
FOR UPDATE TO authenticated
USING (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
)
WITH CHECK (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
  AND (NOT is_production_operator()) AND (NOT is_maintenance_engineer())
  AND (NOT is_finance_manager()) AND (NOT is_hr_manager())
);

DROP POLICY IF EXISTS quality_inspections_delete ON public.quality_inspections;
CREATE POLICY quality_inspections_delete ON public.quality_inspections
FOR DELETE TO authenticated
USING (
  (NOT is_auditor()) AND (NOT is_customer_portal()) AND (NOT is_supplier_portal())
);

-- Confirm remaining root write branches (should be platform tables only)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE (qual ILIKE '%is_root_admin%' OR with_check ILIKE '%is_root_admin%')
  AND cmd IN ('INSERT','UPDATE','DELETE')
  AND tablename NOT IN ('companies','whitelist','platform_settings','company_registrations')
ORDER BY tablename, cmd;
