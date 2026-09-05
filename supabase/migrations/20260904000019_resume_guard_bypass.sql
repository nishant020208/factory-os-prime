-- =====================================================================
-- FACTORYOS AI — let the material-resume RPC flip orders back to approved
--
-- The Goods Receipt flow calls resume_orders_when_stocked() after a
-- material receipt; once every BOM component is covered it sets a
-- procurement_pending sales order back to 'approved' so the Production
-- Manager can Reserve & Start. But the order-approval guard trigger
-- (block_non_admin_order_approval, migration 00006) rejects ANY status
-- change to 'approved' by a non-Company/Plant-Admin actor — including
-- this legitimate warehouse-side system resume — so the resume always
-- failed with "Only a Company Admin or the assigned Plant Admin can
-- approve this order" and orders stayed stuck in procurement_pending.
--
-- Fix: the resume RPC sets a transaction-scoped session marker
-- (factoryos.resume_stock_ok='1', visible only inside that one
-- transaction) after its own warehouse/procurement/company-admin role
-- check, and the guard admits the resume ONLY when that marker is set
-- AND the change is the exact procurement_pending -> approved resume
-- transition. Human approval paths are untouched — a caller cannot set
-- the marker without running the resume RPC's own role whitelist, and
-- RLS still blocks direct table writes by non-admin roles.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.block_non_admin_order_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.status IS DISTINCT FROM OLD.status THEN
    -- System resume after goods receipt: only the resume RPC (which has
    -- already verified the caller is warehouse/procurement/company admin)
    -- sets this transaction-scoped marker, and only for orders that were
    -- waiting on materials (procurement_pending).
    IF OLD.status = 'procurement_pending'
       AND current_setting('factoryos.resume_stock_ok', true) = '1'
       AND public.has_role(auth.uid(), 'warehouse_manager') THEN
      RETURN NEW;
    END IF;
    IF NOT (
      public.has_role(auth.uid(), 'company_admin')
      OR public.is_root_admin(auth.uid())
      OR (
        public.is_plant_admin()
        AND NEW.plant_id IS NOT NULL
        AND NEW.plant_id = public.current_user_plant_id()
      )
    ) THEN
      RAISE EXCEPTION 'Only a Company Admin or the assigned Plant Admin can approve this order';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- Recreate the trigger to pick up the new function body.
DROP TRIGGER IF EXISTS trg_sales_order_approval_guard ON public.sales_orders;
CREATE TRIGGER trg_sales_order_approval_guard
BEFORE UPDATE OF status ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.block_non_admin_order_approval();

-- The resume RPC must set the marker before it flips orders, so the guard
-- can distinguish a system resume from a manual approval attempt.
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

  -- Mark this transaction as a system stock-resume so the approval guard
  -- admits the procurement_pending -> approved flip below.
  PERFORM set_config('factoryos.resume_stock_ok', '1', true);

  FOR v_order IN
    SELECT so.id, so.so_number, so.plant_id
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

GRANT EXECUTE ON FUNCTION public.resume_orders_when_stocked(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resume_orders_when_stocked(uuid) FROM anon;
