-- =====================================================================
-- FACTORYOS AI — supplier portal reads the material lines on their POs
--
-- POs are now always created with purchase_order_items rows (the atomic
-- create_purchase_order_with_items RPC). A supplier accepting or
-- dispatching a PO must SEE what was ordered — materials, quantities,
-- unit prices — not just the total. The existing ops/auditor select
-- policies for purchase_order_items exclude portal roles, so add the
-- supplier branch mirroring po_select_supplier_own on purchase_orders.
-- =====================================================================

DROP POLICY IF EXISTS poi_select_supplier_own ON public.purchase_order_items;
CREATE POLICY poi_select_supplier_own ON public.purchase_order_items
  FOR SELECT TO authenticated
  USING (
    is_supplier_portal()
    AND EXISTS (
      SELECT 1 FROM public.purchase_orders po
      WHERE po.id = purchase_order_items.purchase_order_id
        AND po.supplier_id = current_supplier_id()
        AND po.company_id = current_supplier_company()
    )
  );
