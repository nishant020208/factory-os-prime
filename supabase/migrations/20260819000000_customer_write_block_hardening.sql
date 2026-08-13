-- ─────────────────────────────────────────────────────────────
-- 20260819000000 — Customer Portal RLS hardening
--
-- 1. purchase_orders: customers could read ALL company POs via the
--    company-wide branch of po_select_supplier_own. Exclude customers.
-- 2. Bare `(NOT is_auditor())` policies on internal tables granted
--    INSERT/UPDATE/DELETE to every authenticated non-auditor, including
--    customer_portal and supplier_portal. Rewrite each to also exclude
--    both external portal roles.
-- 3. sales_order_items INSERT is the ONE write customers need (New Order
--    flow) — replaced with a customer-owned-order-scoped policy.
-- ─────────────────────────────────────────────────────────────

-- ── 1) purchase_orders SELECT — block customers ──
DROP POLICY IF EXISTS po_select_supplier_own ON public.purchase_orders;
CREATE POLICY po_select_supplier_own ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND NOT is_supplier_portal()
      AND NOT is_customer_portal()
    )
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
  );

-- ── 2) sales_order_items INSERT — customer-owned-order-scoped ──
DROP POLICY IF EXISTS sales_order_items_insert ON public.sales_order_items;
CREATE POLICY sales_order_items_insert ON public.sales_order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND (
        (
          NOT is_customer_portal()
          AND NOT is_supplier_portal()
          AND NOT is_auditor()
        )
        OR (
          is_customer_portal()
          AND EXISTS (
            SELECT 1
            FROM public.sales_orders so
            JOIN public.customers c ON c.id = so.customer_id
            WHERE so.id = sales_order_id
              AND c.user_id = auth.uid()
          )
        )
      )
    )
  );

-- ── 3) Harden every remaining bare `NOT is_auditor()` policy ──
-- Rebuilds policies whose qual/with_check references is_auditor() but
-- does NOT already reference the portal roles, replacing the bare check
-- with the triple exclusion. Idempotent: after the first run the
-- policies already mention is_customer_portal() so they are skipped.
DO $$
DECLARE
  r record;
  new_qual text;
  new_wc   text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual::text, '') ILIKE '%is_auditor()%'
        OR COALESCE(with_check::text, '') ILIKE '%is_auditor()%'
      )
      AND NOT (
        COALESCE(qual::text, '') ILIKE '%is_customer_portal()%'
        OR COALESCE(with_check::text, '') ILIKE '%is_customer_portal()%'
      )
      AND NOT (
        COALESCE(qual::text, '') ILIKE '%is_supplier_portal()%'
        OR COALESCE(with_check::text, '') ILIKE '%is_supplier_portal()%'
      )
  LOOP
    -- Widen every `NOT is_auditor()` occurrence to exclude portal roles
    new_qual := replace(
      COALESCE(r.qual::text, ''),
      'is_auditor()',
      'is_auditor() AND NOT is_customer_portal() AND NOT is_supplier_portal()'
    );
    new_wc := replace(
      COALESCE(r.with_check::text, ''),
      'is_auditor()',
      'is_auditor() AND NOT is_customer_portal() AND NOT is_supplier_portal()'
    );

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);

    IF r.cmd = 'ALL' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO %s USING (%s) WITH CHECK (%s)',
        r.policyname, r.tablename,
        (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) AS x),
        new_qual, new_wc
      );
    ELSIF r.cmd = 'INSERT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR INSERT TO %s WITH CHECK (%s)',
        r.policyname, r.tablename,
        (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) AS x),
        new_wc
      );
    ELSIF r.cmd = 'UPDATE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR UPDATE TO %s USING (%s) WITH CHECK (%s)',
        r.policyname, r.tablename,
        (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) AS x),
        new_qual, new_wc
      );
    ELSIF r.cmd = 'DELETE' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR DELETE TO %s USING (%s)',
        r.policyname, r.tablename,
        (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) AS x),
        new_qual
      );
    ELSIF r.cmd = 'SELECT' THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR SELECT TO %s USING (%s)',
        r.policyname, r.tablename,
        (SELECT string_agg(quote_ident(x), ', ') FROM unnest(r.roles) AS x),
        new_qual
      );
    END IF;
  END LOOP;
END $$;

-- ── Confirm ──
SELECT policyname, tablename, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    COALESCE(qual::text, '') ILIKE '%is_customer_portal()%'
    OR COALESCE(with_check::text, '') ILIKE '%is_customer_portal()%'
  )
ORDER BY tablename, cmd;
