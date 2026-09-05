-- =====================================================================
-- FACTORYOS AI — resume production orders once received materials are in
--
-- The Production Planner material-check flow lets a Production Manager
-- flag an approved sales order as "short on raw materials" and raise it to
-- Procurement (sales_orders.status -> 'procurement_pending'). Procurement
-- orders the material, the supplier ships it, and the warehouse confirms
-- receipt (Goods Receipt bumps inventory). This function is called right
-- after that receipt confirmation: it re-runs the same BOM-vs-stock check
-- the Planner page shows and flips every procurement_pending order whose
-- components are now fully covered back to 'approved', so the Production
-- Manager sees "Reserve & Start" again — and the caller notifies them.
--
-- No schema change: pure function. Caller (goods-receipt) must belong to
-- the company and be a warehouse/procurement/company-admin actor.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.resume_orders_when_stocked(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_role_ok    boolean;
  v_order      record;
  v_item       record;
  v_product_id uuid;
  v_order_qty  numeric;
  v_bom_id     uuid;
  v_component  uuid;
  v_required   numeric;
  v_on_hand    numeric;
  v_ok         boolean := true;
  v_resumed    jsonb := '[]'::jsonb;
BEGIN
  -- Only an employee of this company may trigger the resume; auditors are
  -- read-only observers and may not mutate order state.
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.company_id = p_company_id
        AND ur.role IN ('company_admin','procurement_manager','warehouse_manager')
    ),
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'auditor')
  INTO v_role_ok;

  IF NOT v_role_ok OR v_role_ok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized to resume production orders');
  END IF;

  FOR v_order IN
    SELECT so.id, so.so_number
    FROM public.sales_orders so
    WHERE so.company_id = p_company_id
      AND so.status = 'procurement_pending'
    ORDER BY so.created_at ASC
  LOOP
    -- The product being made comes from the order's first line.
    SELECT soi.product_id, soi.quantity
      INTO v_product_id, v_order_qty
      FROM public.sales_order_items soi
      WHERE soi.sales_order_id = v_order.id
      ORDER BY soi.created_at ASC
      LIMIT 1;
    CONTINUE WHEN v_product_id IS NULL OR v_order_qty IS NULL;

    -- The BOM actually used by the planner (same lookup it performs).
    SELECT b.id INTO v_bom_id
      FROM public.bom b
      WHERE b.company_id = p_company_id AND b.product_id = v_product_id
      ORDER BY b.created_at DESC
      LIMIT 1;
    CONTINUE WHEN v_bom_id IS NULL;

    v_ok := true;
    FOR v_item IN
      SELECT bi.component_product_id, bi.quantity
      FROM public.bom_items bi
      WHERE bi.bom_id = v_bom_id
    LOOP
      v_component := v_item.component_product_id;
      v_required  := round(COALESCE(v_item.quantity, 0) * v_order_qty, 2);
      SELECT COALESCE(SUM(i.quantity), 0) INTO v_on_hand
        FROM public.inventory i
        WHERE i.company_id = p_company_id
          AND (i.material_id = v_component OR i.product_id = v_component);
      IF v_on_hand < v_required THEN
        v_ok := false;
        EXIT;
      END IF;
    END LOOP;

    -- A BOM with no component lines cannot be satisfied by stock; leave the
    -- order alone rather than auto-approving it.
    IF NOT EXISTS (
      SELECT 1 FROM public.bom_items bi WHERE bi.bom_id = v_bom_id
    ) THEN
      v_ok := false;
    END IF;

    IF v_ok THEN
      UPDATE public.sales_orders
        SET status = 'approved',
            updated_at = now()
        WHERE id = v_order.id;
      v_resumed := v_resumed || jsonb_build_object('id', v_order.id, 'so_number', v_order.so_number);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'resumed', v_resumed);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resume_orders_when_stocked(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resume_orders_when_stocked(uuid) FROM anon;
