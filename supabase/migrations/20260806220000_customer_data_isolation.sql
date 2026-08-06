-- =============================================================================
-- CUSTOMER DATA ISOLATION
-- -----------------------------------------------------------------------------
-- Problem: customer-relevant tables used company-scoped SELECT policies
-- (in_company_ops / company_id = current_company_id()). A customer's profile
-- carries a company_id, so ANY customer could SELECT every row in the company:
-- all customers, sales orders, invoices, payments, shipments, support tickets,
-- customer documents, order history, production orders, finished goods.
--
-- Fix: a customer_portal user may only read rows that belong to their own
-- customer account(s) — i.e. rows whose customer_id resolves to a `customers`
-- row with user_id = auth.uid(). Internal roles keep company scope; the
-- auditor keeps read-only company scope; root keeps platform-only (unchanged).
-- =============================================================================

-- ───────────── 1. HELPER: is_customer_portal() ─────────────────────────────
CREATE OR REPLACE FUNCTION public.is_customer_portal()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'customer_portal'::public.app_role
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_customer_portal() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_customer_portal() FROM anon, PUBLIC;

-- ───────────── 2. customers ────────────────────────────────────────────────
-- Customer portal user: only their own customers row (user_id = auth.uid()).
-- Internal roles: company scope. Auditor: read-only company scope.
DROP POLICY IF EXISTS customers_select_ops ON public.customers;
DROP POLICY IF EXISTS cust_select_own ON public.customers;
CREATE POLICY customers_select_iso ON public.customers
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND user_id = auth.uid())
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );

-- Customers write access stays company-scoped for internal roles only.
-- (The approval flow inserts via cust_insert_company, which is company-scoped.)
DROP POLICY IF EXISTS customers_insert ON public.customers;
CREATE POLICY customers_insert_iso ON public.customers
  FOR INSERT TO authenticated
  WITH CHECK (
    (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR public.is_root_admin(auth.uid())
  );

DROP POLICY IF EXISTS customers_update ON public.customers;
CREATE POLICY customers_update_iso ON public.customers
  FOR UPDATE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
  WITH CHECK (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

DROP POLICY IF EXISTS customers_delete ON public.customers;
CREATE POLICY customers_delete_iso ON public.customers
  FOR DELETE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

-- ───────────── 3. sales_orders ─────────────────────────────────────────────
DROP POLICY IF EXISTS sales_orders_select_ops ON public.sales_orders;
CREATE POLICY sales_orders_select_iso ON public.sales_orders
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );

-- A customer may only ever insert an order for their OWN customer account.
DROP POLICY IF EXISTS sales_orders_insert ON public.sales_orders;
CREATE POLICY sales_orders_insert_iso ON public.sales_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_customer_portal()
      AND company_id = public.current_company_id()
      AND customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR public.is_root_admin(auth.uid())
  );

DROP POLICY IF EXISTS sales_orders_update ON public.sales_orders;
CREATE POLICY sales_orders_update_iso ON public.sales_orders
  FOR UPDATE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
  WITH CHECK (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

DROP POLICY IF EXISTS sales_orders_delete ON public.sales_orders;
CREATE POLICY sales_orders_delete_iso ON public.sales_orders
  FOR DELETE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

-- ───────────── 4. customer_orders ──────────────────────────────────────────
DROP POLICY IF EXISTS co_select_company ON public.customer_orders;
CREATE POLICY customer_orders_select_iso ON public.customer_orders
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );

-- Keep the customer INSERT scoped to their own account + own company.
DROP POLICY IF EXISTS co_insert_customer ON public.customer_orders;
CREATE POLICY co_insert_customer_iso ON public.customer_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_customer_portal()
      AND company_id = public.current_company_id()
      AND customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
  );

DROP POLICY IF EXISTS co_update_company ON public.customer_orders;
CREATE POLICY customer_orders_update_iso ON public.customer_orders
  FOR UPDATE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
  WITH CHECK (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

-- ───────────── 5. invoices / payments / shipments / customer_documents ──────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['invoices','payments','shipments','customer_documents'] LOOP
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I', t || '_select_ops', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (
         (public.is_customer_portal() AND customer_id IN (
           SELECT id FROM public.customers WHERE user_id = auth.uid()))
         OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
         OR (public.is_auditor() AND public.in_company_ops(company_id))
       )',
      t || '_select_iso', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I', t || '_insert', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK (
         (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
         OR public.is_root_admin(auth.uid())
       )',
      t || '_insert_iso', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I', t || '_update', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated
         USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
         WITH CHECK (NOT public.is_customer_portal() AND public.in_company_ops(company_id))',
      t || '_update_iso', t);
    EXECUTE format(
      'DROP POLICY IF EXISTS %I ON public.%I', t || '_delete', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated
         USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))',
      t || '_delete_iso', t);
  END LOOP;
END $$;

-- support_tickets: customers may CREATE tickets for their own account, but
-- may only READ/UPDATE/DELETE their own.
DROP POLICY IF EXISTS support_tickets_select_ops ON public.support_tickets;
CREATE POLICY support_tickets_select_iso ON public.support_tickets
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND customer_id IN (
      SELECT id FROM public.customers WHERE user_id = auth.uid()))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );

DROP POLICY IF EXISTS support_tickets_insert ON public.support_tickets;
CREATE POLICY support_tickets_insert_iso ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_customer_portal()
      AND company_id = public.current_company_id()
      AND customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR public.is_root_admin(auth.uid())
  );

DROP POLICY IF EXISTS support_tickets_update ON public.support_tickets;
CREATE POLICY support_tickets_update_iso ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
  WITH CHECK (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

DROP POLICY IF EXISTS support_tickets_delete ON public.support_tickets;
CREATE POLICY support_tickets_delete_iso ON public.support_tickets
  FOR DELETE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

-- ───────────── 6. order_status_history ─────────────────────────────────────
-- No customer_id; scope a customer to history rows whose order_id belongs to
-- their own sales orders.
DROP POLICY IF EXISTS osh_select_ops ON public.order_status_history;
CREATE POLICY osh_select_iso ON public.order_status_history
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND order_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );

-- ───────────── 7. production_orders ────────────────────────────────────────
-- Customers only see production orders tied to their own sales orders.
DROP POLICY IF EXISTS production_orders_select_ops ON public.production_orders;
CREATE POLICY production_orders_select_iso ON public.production_orders
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND sales_order_id IN (
      SELECT id FROM public.sales_orders
      WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())))
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );

DROP POLICY IF EXISTS production_orders_insert ON public.production_orders;
CREATE POLICY production_orders_insert_iso ON public.production_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR public.is_root_admin(auth.uid())
  );

DROP POLICY IF EXISTS production_orders_update ON public.production_orders;
CREATE POLICY production_orders_update_iso ON public.production_orders
  FOR UPDATE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
  WITH CHECK (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

DROP POLICY IF EXISTS production_orders_delete ON public.production_orders;
CREATE POLICY production_orders_delete_iso ON public.production_orders
  FOR DELETE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

-- ───────────── 8. finished_goods ───────────────────────────────────────────
DROP POLICY IF EXISTS fg_select_company ON public.finished_goods;
CREATE POLICY finished_goods_select_iso ON public.finished_goods
  FOR SELECT TO authenticated
  USING (
    (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );

-- ───────────── 9. documents (customers see only their own uploads) ─────────
DROP POLICY IF EXISTS documents_select_ops ON public.documents;
CREATE POLICY documents_select_iso ON public.documents
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND uploaded_by = auth.uid())
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );

DROP POLICY IF EXISTS documents_insert ON public.documents;
CREATE POLICY documents_insert_iso ON public.documents
  FOR INSERT TO authenticated
  WITH CHECK (
    (public.is_customer_portal() AND company_id = public.current_company_id())
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR public.is_root_admin(auth.uid())
  );

DROP POLICY IF EXISTS documents_update ON public.documents;
CREATE POLICY documents_update_iso ON public.documents
  FOR UPDATE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
  WITH CHECK (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

DROP POLICY IF EXISTS documents_delete ON public.documents;
CREATE POLICY documents_delete_iso ON public.documents
  FOR DELETE TO authenticated
  USING (NOT public.is_customer_portal() AND public.in_company_ops(company_id));

-- ───────────── 10. profile_change_requests (settings page) ─────────────────
-- A customer may only see their own change requests; internal roles see the
-- company's requests (Company Admin must review them).
DROP POLICY IF EXISTS pcr_select_ops ON public.profile_change_requests;
CREATE POLICY pcr_select_iso ON public.profile_change_requests
  FOR SELECT TO authenticated
  USING (
    (public.is_customer_portal() AND user_id = auth.uid())
    OR (NOT public.is_customer_portal() AND public.in_company_ops(company_id))
    OR (public.is_auditor() AND public.in_company_ops(company_id))
  );
