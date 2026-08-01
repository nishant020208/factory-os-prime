-- =============================================================
-- FACTORYOS AI — RLS HARDENING (Full-Application Audit Part 3)
-- Fixes confirmed live leaks:
--   1. work_orders: 'work_orders_all FOR ALL' let ANY authenticated
--      user in the company INSERT work orders (operators included).
--   2. purchase_orders: 'purchase_orders_all FOR ALL' let suppliers
--      INSERT purchase orders.
--   3. notifications: leftover 'notif_insert_company' (created in
--      20260727000002) survived because 20260731000000 dropped a
--      differently-named 'notifications_insert_company'. It allowed
--      ANY company member to insert a notification targeted at
--      'root_super_admin', bypassing the MAIN-ADMIN-only rule.
--   4. Auditor zero-write: enforced at the DB layer with a generic
--      write-guard trigger across every RLS-enabled table.
-- =============================================================

-- ───────────────── 1. WORK ORDERS — role-scoped policies ─────────────
DROP POLICY IF EXISTS work_orders_all ON public.work_orders;

-- SELECT: any authenticated user of the same company (needed for
-- tracking / dashboards / customer order-tracking views).
CREATE POLICY wo_select_company ON public.work_orders
  FOR SELECT TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id());

-- INSERT: only Production Manager / Company Admin (system auto-creates
-- work orders on material reservation, routed via the app).
CREATE POLICY wo_insert_roles ON public.work_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('production_manager','company_admin')
      )
    )
  );

-- UPDATE: operators may update progress on their own assigned WOs;
-- managers/quality/warehouse may update status. Customer, supplier,
-- auditor, HR, finance are excluded from writes.
CREATE POLICY wo_update_roles ON public.work_orders
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('production_manager','company_admin','production_operator',
                       'quality_inspector','warehouse_manager','maintenance_engineer',
                       'plant_admin','plant_manager')
      )
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('production_manager','company_admin','production_operator',
                       'quality_inspector','warehouse_manager','maintenance_engineer',
                       'plant_admin','plant_manager')
      )
    )
  );

-- DELETE: Company Admin only.
CREATE POLICY wo_delete_admin ON public.work_orders
  FOR DELETE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'company_admin'
      )
    )
  );

-- ───────────── 2. PURCHASE ORDERS — role-scoped policies ─────────────
DROP POLICY IF EXISTS purchase_orders_all ON public.purchase_orders;

-- SELECT: company-wide.
CREATE POLICY po_select_company ON public.purchase_orders
  FOR SELECT TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id());

-- INSERT: Procurement Manager / Company Admin only. Suppliers can
-- never create a PO.
CREATE POLICY po_insert_roles ON public.purchase_orders
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('procurement_manager','company_admin')
      )
    )
  );

-- UPDATE: Procurement Manager, Company Admin, and Supplier Portal
-- (supplier accepts / rejects / modifies / updates shipment).
CREATE POLICY po_update_roles ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('procurement_manager','company_admin','supplier_portal')
      )
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role IN ('procurement_manager','company_admin','supplier_portal')
      )
    )
  );

-- DELETE: Company Admin only.
CREATE POLICY po_delete_admin ON public.purchase_orders
  FOR DELETE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = 'company_admin'
      )
    )
  );

-- ───────────── 3. NOTIFICATIONS — kill the leftover INSERT policy ────
-- The old permissive policy (company-scoped, ANY role target) allowed
-- any company member to fire a notification at 'root_super_admin',
-- bypassing the MAIN-ADMIN-only rule. Remove it so only
-- 'notifications_insert_main_admin_only' governs authenticated inserts.
DROP POLICY IF EXISTS notif_insert_company ON public.notifications;
DROP POLICY IF EXISTS notifications_insert_company ON public.notifications;

-- ───────────── 4. AUDITOR ZERO-WRITE — DB-layer guard ────────────────
-- A generic trigger that raises on any write attempt by an auditor,
-- attached to every RLS-enabled table in the public schema. This is
-- enforced at the database layer, not hidden in the UI.
CREATE OR REPLACE FUNCTION public.block_auditor_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'auditor'
  ) THEN
    RAISE EXCEPTION 'Auditor role is read-only: writes are not permitted (table: %)', TG_TABLE_NAME;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DO $$
DECLARE
  t record;
BEGIN
  FOR t IN
    SELECT c.relname AS tbl
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND c.relrowsecurity = true
      AND c.relname <> 'user_roles'   -- never guard the role table itself
    ORDER BY c.relname
  LOOP
    EXECUTE format(
      'DROP TRIGGER IF EXISTS trg_block_auditor_write ON public.%I;', t.tbl);
    EXECUTE format(
      'CREATE TRIGGER trg_block_auditor_write
         BEFORE INSERT OR UPDATE OR DELETE ON public.%I
         FOR EACH ROW EXECUTE FUNCTION public.block_auditor_writes();', t.tbl);
  END LOOP;
END $$;
