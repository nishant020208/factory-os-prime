-- ============================================================================
-- Fix: resume_orders_when_stocked(uuid, uuid) overload
-- The incoming-inspection RPC (20260905000008) and inventory semantics RPC
-- (20260906000001) call public.resume_orders_when_stocked(v_insp.company_id,
-- v_insp.material_id) — a 2-argument form that was never defined. Only the
-- 1-argument (company_id) form existed, so approving an incoming inspection
-- that had been waiting on a material failed with "function ... does not
-- exist". This defines the 2-arg overload: it resumes procurement_pending
-- sales orders whose BOM consumes the just-stocked material, once that
-- material's available stock covers the requirement. Same authorization and
-- available-stock semantics as the company-wide form.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.resume_orders_when_stocked(
  p_company_id uuid,
  p_material_id uuid
)
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
  v_required   numeric;
  v_on_hand    numeric;
  v_reserved   numeric;
  v_quarantined numeric;
  v_damaged    numeric;
  v_available  numeric;
  v_resumed    jsonb := '[]'::jsonb;
  v_ok         boolean;
BEGIN
  SELECT
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.company_id = p_company_id
        AND ur.role IN ('company_admin','procurement_manager','warehouse_manager','quality_inspector')
    ),
    EXISTS (SELECT 1 FROM public.user_roles ur
            WHERE ur.user_id = auth.uid() AND ur.role = 'auditor')
  INTO v_role_ok;

  IF NOT v_role_ok OR v_role_ok IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Not authorized to resume production orders');
  END IF;

  PERFORM set_config('factoryos.resume_stock_ok', '1', true);

  FOR v_order IN
    SELECT so.id, so.so_number, so.plant_id
    FROM public.sales_orders so
    WHERE so.company_id = p_company_id
      AND so.status = 'procurement_pending'
    ORDER BY so.created_at ASC
  LOOP
    SELECT soi.product_id, soi.quantity
      INTO v_product_id, v_order_qty
      FROM public.sales_order_items soi
      WHERE soi.sales_order_id = v_order.id
      ORDER BY soi.created_at ASC
      LIMIT 1;
    CONTINUE WHEN v_product_id IS NULL OR v_order_qty IS NULL;

    -- Only orders whose BOM actually consumes this material can be resumed by
    -- this material's receipt.
    SELECT b.id INTO v_bom_id
      FROM public.bom b
      WHERE b.company_id = p_company_id AND b.product_id = v_product_id
      ORDER BY b.created_at DESC
      LIMIT 1;
    CONTINUE WHEN v_bom_id IS NULL;

    IF NOT EXISTS (
      SELECT 1 FROM public.bom_items bi
      WHERE bi.bom_id = v_bom_id AND bi.component_product_id = p_material_id
    ) THEN
      CONTINUE;
    END IF;

    -- All BOM components must now be available (the whole order resumes, not
    -- just the one line) — matches the company-wide function's semantics.
    v_ok := true;
    FOR v_item IN
      SELECT bi.component_product_id, bi.quantity
      FROM public.bom_items bi
      WHERE bi.bom_id = v_bom_id
    LOOP
      v_required := round(COALESCE(v_item.quantity, 0) * v_order_qty, 2);

      SELECT
        COALESCE(SUM(quantity), 0),
        COALESCE(SUM(reserved_quantity), 0),
        COALESCE(SUM(quarantined_quantity), 0),
        COALESCE(SUM(damaged_qty), 0)
      INTO v_on_hand, v_reserved, v_quarantined, v_damaged
      FROM public.inventory
      WHERE company_id = p_company_id
        AND (material_id = v_item.component_product_id
             OR product_id = v_item.component_product_id);

      v_available := GREATEST(0, v_on_hand - v_reserved - v_quarantined - v_damaged);
      IF v_available < v_required THEN
        v_ok := false;
        EXIT;
      END IF;
    END LOOP;

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
      v_resumed := v_resumed || jsonb_build_object(
        'id', v_order.id,
        'so_number', v_order.so_number,
        'plant_id', v_order.plant_id
      );
    END IF;
  END LOOP;

  RETURN jsonb_build_object('ok', true, 'resumed', v_resumed);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.resume_orders_when_stocked(uuid, uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resume_orders_when_stocked(uuid, uuid) FROM anon;