-- Role policy tightening found during the Warehouse / Procurement / Quality
-- build verification:
--
-- 1. Finished Goods must ONLY enter stock from a real Quality Pass (either the
--    DB trigger on quality_inspections.result='pass', or an explicit entry by
--    a Quality Inspector / Company Admin). Warehouse Manager must NOT be able
--    to fabricate a Finished Goods row by hand — they record receipt of FG via
--    the packing table instead.
--
-- 2. Procurement Manager must NOT directly edit stock quantities. Stock
--    adjustments are Warehouse's exclusive scope (GRN in, dispatch out).
--    Procurement acts through requisitions/POs, never by writing inventory.

-- ── 1. Finished Goods — quality-only writes ──
DROP POLICY IF EXISTS finished_goods_insert_ops ON public.finished_goods;
CREATE POLICY finished_goods_insert_ops ON public.finished_goods FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_maintenance_engineer()
  AND NOT is_finance_manager()
  AND NOT is_hr_manager()
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.role IN ('quality_inspector', 'company_admin')
  )
);

-- ── 2. Inventory — exclude Procurement Manager from direct stock writes ──
DROP POLICY IF EXISTS inventory_insert ON public.inventory;
CREATE POLICY inventory_insert ON public.inventory FOR INSERT TO authenticated
WITH CHECK (
  (
    NOT is_auditor()
    AND NOT is_customer_portal()
    AND NOT is_supplier_portal()
    AND NOT is_production_operator()
    AND NOT is_maintenance_engineer()
    AND NOT is_finance_manager()
    AND NOT is_hr_manager()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'
    )
  )
  OR is_root_admin(auth.uid())
);

DROP POLICY IF EXISTS inventory_update ON public.inventory;
CREATE POLICY inventory_update ON public.inventory FOR UPDATE TO authenticated
USING (
  (
    NOT is_auditor()
    AND NOT is_customer_portal()
    AND NOT is_supplier_portal()
    AND NOT is_production_operator()
    AND NOT is_maintenance_engineer()
    AND NOT is_finance_manager()
    AND NOT is_hr_manager()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'
    )
  )
  OR is_root_admin(auth.uid())
)
WITH CHECK (
  (
    NOT is_auditor()
    AND NOT is_customer_portal()
    AND NOT is_supplier_portal()
    AND NOT is_production_operator()
    AND NOT is_maintenance_engineer()
    AND NOT is_finance_manager()
    AND NOT is_hr_manager()
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'
    )
  )
  OR is_root_admin(auth.uid())
);

DROP POLICY IF EXISTS ia_insert ON public.inventory_adjustments;
CREATE POLICY ia_insert ON public.inventory_adjustments FOR INSERT TO authenticated
WITH CHECK (
  (is_root_admin() OR (company_id = current_company_id()))
  AND NOT is_auditor()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
  AND NOT is_production_operator()
  AND NOT is_maintenance_engineer()
  AND NOT is_finance_manager()
  AND NOT is_hr_manager()
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid() AND ur.role = 'procurement_manager'
  )
);

-- ── 3. Supplier Deliveries — dispatching is the SUPPLIER's exclusive action ──
--    The previous INSERT policy's in_company_ops branch let ANY internal ops
--    role (procurement, production, …) create a dispatch on the supplier's
--    behalf. Only the real supplier account may log a dispatch; Warehouse's
--    receipt confirmation stays an UPDATE (status → received), which the
--    ops-scoped UPDATE policy already covers.
DROP POLICY IF EXISTS supplier_deliveries_insert ON public.supplier_deliveries;
CREATE POLICY supplier_deliveries_insert ON public.supplier_deliveries FOR INSERT TO authenticated
WITH CHECK (
  is_root_admin(auth.uid())
  OR (
    is_supplier_portal()
    AND supplier_id = current_supplier_id()
    AND company_id = current_supplier_company()
  )
);
