-- =============================================================
-- FACTORYOS AI — ROOT ADMIN: PLATFORM-ONLY RLS
-- Root Super Admin must NOT see company operational data.
-- Root keeps read access ONLY on platform tables:
--   companies, company_registrations, whitelist, audit_logs,
--   user_roles, profiles, notifications (root-targeted), platform_settings
-- Every operational table loses the root SELECT bypass.
--
-- Implementation:
--   1. New helper in_company_ops(_cid) = company-scoped WITHOUT the
--      is_root_admin() bypass (unlike in_company() which ORs root in).
--   2. Operational tables that used in_company() for SELECT are
--      switched to in_company_ops().
--   3. Operational tables with explicit is_root_admin() SELECT
--      policies are recreated company-scoped.
--   4. Operational FOR ALL write policies (departments/plants) lose
--      the root bypass too.
-- Platform tables keep in_company()/explicit-root so Root's console
-- (tenants, whitelist, audit, registrations) keeps working.
-- =============================================================

-- ───────────── 1. COMPANY-SCOPED HELPER (NO ROOT) ─────────────
CREATE OR REPLACE FUNCTION public.in_company_ops(_cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (_cid IS NOT NULL AND _cid = public.current_company_id());
$$;
GRANT EXECUTE ON FUNCTION public.in_company_ops(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.in_company_ops(uuid) FROM anon;

-- ───────────── 2. TABLES THAT USED in_company() FOR SELECT ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'approvals','attendance','bom','bom_items','customers','departments','documents',
    'employees','inventory','invoices','knowledge_articles','machines','payments',
    'payroll','plants','product_categories','production_orders','products',
    'quality_inspections','sales_order_items','sales_orders','shipments','suppliers',
    'support_tickets','tasks','warehouses'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_scoped', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.in_company_ops(company_id))',
      t || '_select_ops', t);
  END LOOP;
END $$;

-- ───────────── 3. TABLES THAT USED (in_company(company_id) OR is_auditor()) ─────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'budgets','compliance_records','cycle_count_items','cycle_counts','expenses',
    'goods_receipts','job_openings','leaves','machine_breakdowns','machine_status_log',
    'maintenance_schedules','maintenance_tickets','performance_reviews',
    'purchase_order_items','quality_certificates','rfqs','shift_schedules',
    'spare_parts','stock_transfers','taxes','trainings'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.in_company_ops(company_id) OR public.is_auditor())',
      t || '_select_ops', t);
  END LOOP;
END $$;

-- ───────────── 4. EXPLICIT ROOT-IN-SELECT OPERATIONAL POLICIES → REMOVE ROOT ─────────────
DROP POLICY IF EXISTS cd_select ON public.customer_documents;
CREATE POLICY cd_select_ops ON public.customer_documents
  FOR SELECT TO authenticated USING (company_id = current_company_id());

DROP POLICY IF EXISTS dn_select ON public.dashboard_notes;
CREATE POLICY dn_select_ops ON public.dashboard_notes
  FOR SELECT TO authenticated USING (company_id = current_company_id());

DROP POLICY IF EXISTS ed_select ON public.employee_departments;
CREATE POLICY ed_select_ops ON public.employee_departments
  FOR SELECT TO authenticated USING (company_id = current_company_id());

DROP POLICY IF EXISTS ia_select ON public.inventory_adjustments;
CREATE POLICY ia_select_ops ON public.inventory_adjustments
  FOR SELECT TO authenticated USING (company_id = current_company_id());

DROP POLICY IF EXISTS osh_select ON public.order_status_history;
CREATE POLICY osh_select_ops ON public.order_status_history
  FOR SELECT TO authenticated USING (company_id = current_company_id());

DROP POLICY IF EXISTS pcr_select ON public.profile_change_requests;
CREATE POLICY pcr_select_ops ON public.profile_change_requests
  FOR SELECT TO authenticated USING (company_id = current_company_id());

DROP POLICY IF EXISTS po_select_company ON public.purchase_orders;
CREATE POLICY po_select_ops ON public.purchase_orders
  FOR SELECT TO authenticated USING (company_id = current_company_id());

DROP POLICY IF EXISTS qr_select ON public.qr_codes;
CREATE POLICY qr_select_ops ON public.qr_codes
  FOR SELECT TO authenticated USING (company_id = current_company_id());

DROP POLICY IF EXISTS wo_select_company ON public.work_orders;
CREATE POLICY wo_select_ops ON public.work_orders
  FOR SELECT TO authenticated USING (company_id = current_company_id());

-- ───────────── 5. OPERATIONAL FOR ALL WRITE POLICIES → REMOVE ROOT ─────────────
DROP POLICY IF EXISTS departments_write ON public.departments;
CREATE POLICY departments_write ON public.departments
  FOR ALL TO authenticated
  USING (company_id = current_company_id())
  WITH CHECK (company_id = current_company_id());

DROP POLICY IF EXISTS plants_write ON public.plants;
CREATE POLICY plants_write ON public.plants
  FOR ALL TO authenticated
  USING ((company_id = current_company_id()) AND has_role(auth.uid(), 'company_admin'::public.app_role))
  WITH CHECK ((company_id = current_company_id()) AND has_role(auth.uid(), 'company_admin'::public.app_role));

-- NOTE: platform tables intentionally UNCHANGED — Root still needs them:
--   companies (companies_root_all / companies_select_scoped),
--   company_registrations (cr_select_root), whitelist (in_company),
--   audit_logs (in_company), user_roles (in_company), profiles (in_company),
--   notifications (notifications_select_own — root sees to_role='root_super_admin'),
--   platform_settings (ps_select_root)
