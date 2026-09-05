-- =====================================================================
-- FACTORYOS AI — MATERIAL / PRODUCT / INVENTORY SCOPING (2026-09-05)
--
-- Separates the three lists that were previously over-exposed:
--
--  1. MATERIALS (raw-material master, Company Admin-owned):
--     Supplier portal accounts previously saw the ENTIRE company
--     material master (mat_select_supplier_own_company was scoped only
--     by company). A supplier must only ever see the materials they are
--     registered to supply — i.e. rows linked to them through the real
--     supplier_materials catalog. This migration re-scopes that policy
--     to the supplier's own linked materials only. Suppliers still have
--     NO write access to the master materials table (existing
--     mat_write/update/delete_company policies stay company_admin-only).
--
--  2. PRODUCTS (customer-facing catalog, Company Admin-owned):
--     Products write policies previously allowed every internal ops
--     role (plant_admin, plant_manager, production_manager,
--     warehouse_manager, quality_inspector, procurement_manager) to
--     create/edit/delete catalog entries. The product catalog is the
--     ONLY list customers order from, so it stays fully owned and
--     controlled by Company Admin (root_super_admin keeps platform
--     bypass). Customer SELECT stays exactly as before: active products
--     of the customer's own company only.
--
--  3. INVENTORY + WAREHOUSES (plant-scoped):
--     inventory_select_ops and warehouses_select_ops previously let any
--     plant-level role read the whole company's stock across every
--     plant. Plant-scoped roles (plant_admin, plant_manager,
--     production_manager, warehouse_manager, procurement_manager,
--     quality_inspector, maintenance_engineer, hr_manager,
--     production_operator) now see and manage ONLY the warehouses and
--     inventory belonging to their own plant (warehouses.plant_id =
--     current_user_plant_id()). Company-level roles (company_admin,
--     finance_manager, auditor) keep their existing company-wide scope.
--     SECURITY DEFINER RPCs (transfer_stock, resume_orders_when_stocked,
--     create_purchase_order_with_items) bypass RLS and are unaffected.
--
-- DATA-SAFETY: strictly policy replacement — no rows are deleted,
-- updated or recreated. All 9 raw materials, 6 products, 2 demo
-- suppliers and their supplier_materials links stay untouched.
-- =====================================================================

-- ─────────────── 1. MATERIALS — SUPPLIER SEES ONLY OWN LINKED MATERIALS ───────────────
-- Replace the company-wide supplier read with one that requires a real
-- supplier_materials link for this exact supplier (and same company).
DROP POLICY IF EXISTS mat_select_supplier_own_company ON public.materials;
CREATE POLICY mat_select_supplier_own_company ON public.materials
  FOR SELECT TO authenticated
  USING (
    is_supplier_portal()
    AND company_id = current_supplier_company()
    AND EXISTS (
      SELECT 1
      FROM public.supplier_materials sm
      WHERE sm.supplier_id = current_supplier_id()
        AND sm.material_id = materials.id
        AND sm.company_id = materials.company_id
    )
  );

-- Supplier write to the master materials table stays blocked: the
-- existing mat_write_company / mat_update_company / mat_delete_company
-- policies are company_admin-only and are intentionally NOT touched.

-- ─────────────── 2. PRODUCTS — COMPANY ADMIN OWNS THE CATALOG ───────────────
DROP POLICY IF EXISTS products_insert ON public.products;
CREATE POLICY products_insert ON public.products
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'company_admin'::public.app_role
      )
    )
  );

DROP POLICY IF EXISTS products_update ON public.products;
CREATE POLICY products_update ON public.products
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'company_admin'::public.app_role
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
          AND role = 'company_admin'::public.app_role
      )
    )
  );

DROP POLICY IF EXISTS products_delete ON public.products;
CREATE POLICY products_delete ON public.products
  FOR DELETE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid()
          AND role = 'company_admin'::public.app_role
      )
    )
  );

-- Customer SELECT (active products of own company only) and internal ops
-- SELECT are unchanged and intentionally left in place.

-- ─────────────── 3. INVENTORY — PLANT-SCOPED ───────────────
-- Plant-level roles see only inventory at their own plant's warehouses.
-- Company-level roles (no plant) keep company-wide visibility.
DROP POLICY IF EXISTS inventory_select_ops ON public.inventory;
CREATE POLICY inventory_select_ops ON public.inventory
  FOR SELECT TO authenticated
  USING (
    in_company_ops(company_id)
    AND NOT is_maintenance_engineer()
    AND NOT is_finance_manager()
    AND NOT is_hr_manager()
    AND (
      current_user_plant_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM public.warehouses w
        WHERE w.id = inventory.warehouse_id
          AND w.plant_id = current_user_plant_id()
      )
    )
  );

DROP POLICY IF EXISTS inventory_insert ON public.inventory;
CREATE POLICY inventory_insert ON public.inventory
  FOR INSERT TO authenticated
  WITH CHECK (
    NOT is_auditor()
    AND NOT is_customer_portal()
    AND NOT is_supplier_portal()
    AND NOT is_production_operator()
    AND NOT is_maintenance_engineer()
    AND NOT is_finance_manager()
    AND NOT is_hr_manager()
    AND NOT is_production_manager()
    AND NOT is_plant_manager()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'procurement_manager'::public.app_role
    )
    AND (
      current_user_plant_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM public.warehouses w
        WHERE w.id = inventory.warehouse_id
          AND w.plant_id = current_user_plant_id()
      )
    )
  );

DROP POLICY IF EXISTS inventory_update ON public.inventory;
CREATE POLICY inventory_update ON public.inventory
  FOR UPDATE TO authenticated
  USING (
    NOT is_auditor()
    AND NOT is_customer_portal()
    AND NOT is_supplier_portal()
    AND NOT is_production_operator()
    AND NOT is_maintenance_engineer()
    AND NOT is_finance_manager()
    AND NOT is_hr_manager()
    AND NOT is_production_manager()
    AND NOT is_plant_manager()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'procurement_manager'::public.app_role
    )
    AND (
      current_user_plant_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM public.warehouses w
        WHERE w.id = inventory.warehouse_id
          AND w.plant_id = current_user_plant_id()
      )
    )
  )
  WITH CHECK (
    NOT is_auditor()
    AND NOT is_customer_portal()
    AND NOT is_supplier_portal()
    AND NOT is_production_operator()
    AND NOT is_maintenance_engineer()
    AND NOT is_finance_manager()
    AND NOT is_hr_manager()
    AND NOT is_production_manager()
    AND NOT is_plant_manager()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'procurement_manager'::public.app_role
    )
    AND (
      current_user_plant_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM public.warehouses w
        WHERE w.id = inventory.warehouse_id
          AND w.plant_id = current_user_plant_id()
      )
    )
  );

DROP POLICY IF EXISTS inventory_delete ON public.inventory;
CREATE POLICY inventory_delete ON public.inventory
  FOR DELETE TO authenticated
  USING (
    NOT is_auditor()
    AND NOT is_customer_portal()
    AND NOT is_supplier_portal()
    AND (
      current_user_plant_id() IS NULL
      OR EXISTS (
        SELECT 1 FROM public.warehouses w
        WHERE w.id = inventory.warehouse_id
          AND w.plant_id = current_user_plant_id()
      )
    )
  );

-- ─────────────── 4. WAREHOUSES — PLANT-SCOPED ───────────────
DROP POLICY IF EXISTS warehouses_select_ops ON public.warehouses;
CREATE POLICY warehouses_select_ops ON public.warehouses
  FOR SELECT TO authenticated
  USING (
    in_company_ops(company_id)
    AND NOT is_maintenance_engineer()
    AND NOT is_finance_manager()
    AND NOT is_hr_manager()
    AND (
      current_user_plant_id() IS NULL
      OR plant_id = current_user_plant_id()
    )
  );

DROP POLICY IF EXISTS warehouses_insert ON public.warehouses;
CREATE POLICY warehouses_insert ON public.warehouses
  FOR INSERT TO authenticated
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      NOT is_auditor()
      AND NOT is_customer_portal()
      AND NOT is_supplier_portal()
      AND NOT is_production_operator()
      AND NOT is_maintenance_engineer()
      AND NOT is_finance_manager()
      AND NOT is_hr_manager()
      AND (
        current_user_plant_id() IS NULL
        OR plant_id = current_user_plant_id()
      )
    )
  );

DROP POLICY IF EXISTS warehouses_update ON public.warehouses;
CREATE POLICY warehouses_update ON public.warehouses
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      NOT is_auditor()
      AND NOT is_customer_portal()
      AND NOT is_supplier_portal()
      AND NOT is_production_operator()
      AND NOT is_maintenance_engineer()
      AND NOT is_finance_manager()
      AND NOT is_hr_manager()
      AND (
        current_user_plant_id() IS NULL
        OR plant_id = current_user_plant_id()
      )
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      NOT is_auditor()
      AND NOT is_customer_portal()
      AND NOT is_supplier_portal()
      AND NOT is_production_operator()
      AND NOT is_maintenance_engineer()
      AND NOT is_finance_manager()
      AND NOT is_hr_manager()
      AND (
        current_user_plant_id() IS NULL
        OR plant_id = current_user_plant_id()
      )
    )
  );

DROP POLICY IF EXISTS warehouses_delete ON public.warehouses;
CREATE POLICY warehouses_delete ON public.warehouses
  FOR DELETE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      NOT is_auditor()
      AND NOT is_customer_portal()
      AND NOT is_supplier_portal()
      AND (
        current_user_plant_id() IS NULL
        OR plant_id = current_user_plant_id()
      )
    )
  );