-- ============================================================================
-- Migration: Inventory State Semantics & Availability Calculation
-- ============================================================================
--
-- CORE INVARIANT (enforced by CHECK constraint):
--   quantity >= reserved_quantity + quarantined_quantity + damaged_qty
--
-- SEMANTICS:
--   quantity              = physical on-hand stock in the warehouse
--   reserved_quantity     = stock committed to production orders (not yet consumed)
--   quarantined_quantity  = stock held pending quality inspection
--   damaged_qty           = stock written off as damaged / unsalvageable
--   available_qty (VIEW)  = quantity - reserved - quarantined - damaged
--
-- All production, procurement, and BOM decisions use available_qty.
-- Stock transfers consume available_qty.
-- QC release transitions quarantined -> available.
-- ============================================================================

-- 1. Add damaged_qty column
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS damaged_qty numeric NOT NULL DEFAULT 0;

-- 2. Add CHECK constraint: on-hand must cover all sub-states
ALTER TABLE public.inventory
ADD CONSTRAINT inventory_state_invariant
CHECK (quantity >= reserved_quantity + quarantined_quantity + damaged_qty);

-- 3. Add non-negative constraints for new columns
ALTER TABLE public.inventory
ADD CONSTRAINT inventory_damaged_qty_non_negative
CHECK (damaged_qty >= 0);

ALTER TABLE public.inventory
ADD CONSTRAINT inventory_reserved_qty_non_negative
CHECK (reserved_quantity >= 0);

ALTER TABLE public.inventory
ADD CONSTRAINT inventory_quarantined_qty_non_negative
CHECK (quarantined_quantity >= 0);

-- 4. Create a view that exposes available quantity
CREATE OR REPLACE VIEW public.inventory_available AS
SELECT
  i.*,
  GREATEST(0, i.quantity - i.reserved_quantity - i.quarantined_quantity - i.damaged_qty)
    AS available_qty
FROM public.inventory i;

-- ============================================================================
-- 5. REPLACE process_incoming_inspection — atomic quarantine/release
-- ============================================================================
CREATE OR REPLACE FUNCTION public.process_incoming_inspection(
  p_inspection_id uuid,
  p_decision text,
  p_notes text DEFAULT NULL,
  p_rejection_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_insp public.incoming_material_inspections%ROWTYPE;
  v_user_id uuid;
  v_user_email text;
  v_inv_id uuid;
  v_po_num text;
  v_mat_name text;
  v_has_role boolean;
  v_new_on_hand numeric;
BEGIN
  v_user_id := auth.uid();
  SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND role IN (
        'quality_inspector'::public.app_role,
        'company_admin'::public.app_role,
        'plant_admin'::public.app_role
      )
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Only Quality Inspector or Admin can approve/reject incoming materials';
  END IF;

  SELECT * INTO v_insp FROM public.incoming_material_inspections
  WHERE id = p_inspection_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Incoming inspection not found: %', p_inspection_id;
  END IF;

  IF v_insp.status != 'pending' THEN
    RAISE EXCEPTION 'Inspection is already finalized with status: %', v_insp.status;
  END IF;

  IF p_decision NOT IN ('approved', 'rejected') THEN
    RAISE EXCEPTION 'Invalid decision: %. Must be approved or rejected', p_decision;
  END IF;

  SELECT po_number INTO v_po_num FROM public.purchase_orders WHERE id = v_insp.purchase_order_id;
  SELECT name INTO v_mat_name FROM public.materials WHERE id = v_insp.material_id;

  UPDATE public.incoming_material_inspections
  SET
    status = p_decision,
    result = p_decision,
    inspector_id = v_user_id,
    inspection_notes = p_notes,
    rejection_reason = p_rejection_reason,
    inspected_at = now()
  WHERE id = p_inspection_id;

  IF v_insp.goods_receipt_id IS NOT NULL THEN
    UPDATE public.goods_receipts
    SET
      inspection_status = p_decision,
      inspector_id = v_user_id,
      inspected_at = now()
    WHERE id = v_insp.goods_receipt_id;
  END IF;

  IF p_decision = 'approved' THEN
    -- Material approved: add to on-hand AND to available.
    -- Move from quarantined -> available if it was quarantined.
    SELECT id INTO v_inv_id FROM public.inventory
    WHERE company_id = v_insp.company_id
      AND warehouse_id = v_insp.warehouse_id
      AND material_id = v_insp.material_id
    LIMIT 1;

    IF v_inv_id IS NOT NULL THEN
      -- Increase on-hand by the inspected quantity
      UPDATE public.inventory
      SET
        quantity = quantity + v_insp.quantity,
        quarantined_quantity = GREATEST(0, quarantined_quantity - v_insp.quantity),
        updated_at = now()
      WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.inventory (
        company_id, warehouse_id, material_id,
        quantity, reserved_quantity, quarantined_quantity, damaged_qty, updated_at
      ) VALUES (
        v_insp.company_id, v_insp.warehouse_id, v_insp.material_id,
        v_insp.quantity, 0, 0, 0, now()
      );
    END IF;

    PERFORM public.resume_orders_when_stocked(v_insp.company_id, v_insp.material_id);

  ELSIF p_decision = 'rejected' THEN
    -- Material rejected: add to on-hand but quarantined (NOT available).
    SELECT id INTO v_inv_id FROM public.inventory
    WHERE company_id = v_insp.company_id
      AND warehouse_id = v_insp.warehouse_id
      AND material_id = v_insp.material_id
    LIMIT 1;

    IF v_inv_id IS NOT NULL THEN
      UPDATE public.inventory
      SET
        quantity = quantity + v_insp.quantity,
        quarantined_quantity = quarantined_quantity + v_insp.quantity,
        updated_at = now()
      WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.inventory (
        company_id, warehouse_id, material_id,
        quantity, reserved_quantity, quarantined_quantity, damaged_qty, updated_at
      ) VALUES (
        v_insp.company_id, v_insp.warehouse_id, v_insp.material_id,
        v_insp.quantity, 0, v_insp.quantity, 0, now()
      );
    END IF;
  END IF;

  INSERT INTO public.audit_logs (
    company_id, user_id, action, entity_type, entity_id, new_values, created_at
  ) VALUES (
    v_insp.company_id,
    v_user_id,
    'INCOMING_INSPECTION_' || upper(p_decision),
    'incoming_material_inspections',
    p_inspection_id::text,
    jsonb_build_object(
      'inspection_id', p_inspection_id,
      'decision', p_decision,
      'material_id', v_insp.material_id,
      'material_name', v_mat_name,
      'warehouse_id', v_insp.warehouse_id,
      'quantity', v_insp.quantity,
      'po_number', v_po_num,
      'notes', p_notes,
      'rejection_reason', p_rejection_reason
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'decision', p_decision,
    'inspection_id', p_inspection_id,
    'material', v_mat_name,
    'quantity', v_insp.quantity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_incoming_inspection(uuid, text, text, text) TO authenticated;

-- ============================================================================
-- 6. REPLACE transfer_stock — consume available, not raw on-hand
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transfer_stock(
  p_company_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_product_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_from      public.inventory%ROWTYPE;
  v_to_qty    numeric;
  v_material  uuid;
  v_available numeric;
  v_transfer  public.stock_transfers;
  v_result    jsonb;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND company_id = p_company_id
      AND role IN ('warehouse_manager', 'company_admin', 'plant_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only Warehouse Manager, Company Admin or Plant Admin can create transfers';
  END IF;

  IF p_from_warehouse_id = p_to_warehouse_id THEN
    RAISE EXCEPTION 'Source and destination must be different locations';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;

  -- Lock and read source row
  SELECT * INTO v_from
  FROM public.inventory
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_from_warehouse_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock of this product at the source location';
  END IF;

  -- Calculate available: on-hand minus reserved, quarantined, damaged
  v_available := GREATEST(0,
    v_from.quantity - v_from.reserved_quantity - v_from.quarantined_quantity - v_from.damaged_qty
  );

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock at source: available %, requested %', v_available, p_quantity;
  END IF;

  v_material := v_from.material_id;

  -- Read destination
  SELECT quantity INTO v_to_qty
  FROM public.inventory
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_to_warehouse_id
  FOR UPDATE;
  v_to_qty := COALESCE(v_to_qty, 0);

  -- Atomic: decrement source available, increment destination on-hand
  UPDATE public.inventory
  SET quantity = quantity - p_quantity, updated_at = now()
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_from_warehouse_id;

  INSERT INTO public.inventory (company_id, product_id, material_id, warehouse_id, quantity, updated_at)
  VALUES (p_company_id, p_product_id, v_material, p_to_warehouse_id, p_quantity, now())
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity, updated_at = now();

  -- Transfer record
  INSERT INTO public.stock_transfers (
    company_id, from_warehouse_id, to_warehouse_id, material_id, product_id,
    quantity, status, notes, created_by
  )
  VALUES (
    p_company_id, p_from_warehouse_id, p_to_warehouse_id, v_material, p_product_id,
    p_quantity, 'completed', p_notes, v_user_id
  )
  RETURNING * INTO v_transfer;

  -- Stock movement ledger
  INSERT INTO public.inventory_adjustments (
    company_id, product_id, warehouse_id, old_quantity, new_quantity, delta, reason, adjusted_by
  )
  VALUES
    (p_company_id, p_product_id, p_from_warehouse_id,
     v_from.quantity, v_from.quantity - p_quantity, -p_quantity,
     COALESCE(p_notes, 'Inter-warehouse transfer out'), v_user_id),
    (p_company_id, p_product_id, p_to_warehouse_id,
     v_to_qty, v_to_qty + p_quantity, p_quantity,
     COALESCE(p_notes, 'Inter-warehouse transfer in'), v_user_id);

  INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_id, metadata)
  VALUES (p_company_id, v_user_id, 'stock_transferred', 'stock_transfers', v_transfer.id,
    jsonb_build_object(
      'from_warehouse_id', p_from_warehouse_id,
      'to_warehouse_id', p_to_warehouse_id,
      'product_id', p_product_id,
      'quantity', p_quantity,
      'notes', p_notes,
      'from_old_qty', v_from.quantity,
      'from_new_qty', v_from.quantity - p_quantity,
      'to_old_qty', v_to_qty,
      'to_new_qty', v_to_qty + p_quantity
    ));

  v_result := jsonb_build_object(
    'id', v_transfer.id,
    'status', v_transfer.status,
    'quantity', v_transfer.quantity,
    'from_warehouse_id', v_transfer.from_warehouse_id,
    'to_warehouse_id', v_transfer.to_warehouse_id,
    'product_id', v_transfer.product_id
  );
  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, uuid, numeric, text) TO authenticated;

-- ============================================================================
-- 7. REPLACE transfer_stock_between_warehouses — consume available, write ledger
-- ============================================================================
CREATE OR REPLACE FUNCTION public.transfer_stock_between_warehouses(
  p_company_id uuid,
  p_from_warehouse_id uuid,
  p_to_warehouse_id uuid,
  p_material_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from      public.inventory%ROWTYPE;
  v_dest_inv_id uuid;
  v_transfer_id uuid;
  v_mat_name text;
  v_available numeric;
  v_to_qty   numeric;
BEGIN
  IF p_from_warehouse_id = p_to_warehouse_id THEN
    RAISE EXCEPTION 'Source and destination warehouses cannot be the same';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be positive';
  END IF;

  -- Lock and read source row
  SELECT * INTO v_from
  FROM public.inventory
  WHERE company_id = p_company_id
    AND warehouse_id = p_from_warehouse_id
    AND material_id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No stock of this material at the source warehouse';
  END IF;

  -- Calculate available
  v_available := GREATEST(0,
    v_from.quantity - v_from.reserved_quantity - v_from.quarantined_quantity - v_from.damaged_qty
  );

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock at source. Available: %, Requested: %', v_available, p_quantity;
  END IF;

  -- Decrement source on-hand
  UPDATE public.inventory
  SET quantity = quantity - p_quantity, updated_at = now()
  WHERE company_id = p_company_id
    AND warehouse_id = p_from_warehouse_id
    AND material_id = p_material_id;

  -- Increment or insert destination
  SELECT id, quantity INTO v_dest_inv_id, v_to_qty FROM public.inventory
  WHERE company_id = p_company_id
    AND warehouse_id = p_to_warehouse_id
    AND material_id = p_material_id;

  v_to_qty := COALESCE(v_to_qty, 0);

  IF v_dest_inv_id IS NOT NULL THEN
    UPDATE public.inventory
    SET quantity = quantity + p_quantity, updated_at = now()
    WHERE id = v_dest_inv_id;
  ELSE
    INSERT INTO public.inventory (
      company_id, warehouse_id, material_id, quantity, reserved_quantity, quarantined_quantity, damaged_qty, updated_at
    ) VALUES (
      p_company_id, p_to_warehouse_id, p_material_id, p_quantity, 0, 0, 0, now()
    );
  END IF;

  -- Record stock_transfer
  INSERT INTO public.stock_transfers (
    company_id, from_warehouse_id, to_warehouse_id, material_id, quantity, status, notes, created_by, created_at
  ) VALUES (
    p_company_id, p_from_warehouse_id, p_to_warehouse_id, p_material_id, p_quantity, 'completed', p_notes, auth.uid(), now()
  ) RETURNING id INTO v_transfer_id;

  -- Stock movement ledger (both sides)
  INSERT INTO public.inventory_adjustments (
    company_id, product_id, warehouse_id, old_quantity, new_quantity, delta, reason, adjusted_by
  )
  VALUES
    (p_company_id, NULL, p_from_warehouse_id,
     v_from.quantity, v_from.quantity - p_quantity, -p_quantity,
     COALESCE(p_notes, 'Inter-warehouse material transfer out'), auth.uid()),
    (p_company_id, NULL, p_to_warehouse_id,
     v_to_qty, v_to_qty + p_quantity, p_quantity,
     COALESCE(p_notes, 'Inter-warehouse material transfer in'), auth.uid());

  SELECT name INTO v_mat_name FROM public.materials WHERE id = p_material_id;

  INSERT INTO public.audit_logs (
    company_id, user_id, action, entity_type, entity_id, new_values, created_at
  ) VALUES (
    p_company_id,
    auth.uid(),
    'WAREHOUSE_STOCK_SUPPLY',
    'stock_transfers',
    v_transfer_id::text,
    jsonb_build_object(
      'from_warehouse_id', p_from_warehouse_id,
      'to_warehouse_id', p_to_warehouse_id,
      'material_id', p_material_id,
      'material_name', v_mat_name,
      'quantity', p_quantity,
      'notes', p_notes
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'transfer_id', v_transfer_id,
    'quantity', p_quantity,
    'material_name', v_mat_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock_between_warehouses(uuid, uuid, uuid, uuid, numeric, text) TO authenticated;

-- ============================================================================
-- 8. REPLACE resume_orders_when_stocked — use available, not raw quantity
-- ============================================================================
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
  v_reserved   numeric;
  v_quarantined numeric;
  v_damaged    numeric;
  v_available  numeric;
  v_ok         boolean := true;
  v_resumed    jsonb := '[]'::jsonb;
BEGIN
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

      -- Sum AVAILABLE stock (on-hand minus reserved, quarantined, damaged)
      SELECT
        COALESCE(SUM(quantity), 0),
        COALESCE(SUM(reserved_quantity), 0),
        COALESCE(SUM(quarantined_quantity), 0),
        COALESCE(SUM(damaged_qty), 0)
      INTO v_on_hand, v_reserved, v_quarantined, v_damaged
      FROM public.inventory
      WHERE company_id = p_company_id
        AND (material_id = v_component OR product_id = v_component);

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

GRANT EXECUTE ON FUNCTION public.resume_orders_when_stocked(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.resume_orders_when_stocked(uuid) FROM anon;

-- ============================================================================
-- 9. CREATE reserve_stock — atomic reservation for production
-- ============================================================================
CREATE OR REPLACE FUNCTION public.reserve_stock(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_material_id uuid,
  p_quantity numeric,
  p_production_order_id uuid DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inv     public.inventory%ROWTYPE;
  v_available numeric;
  v_has_role boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND company_id = p_company_id
      AND role IN ('production_manager', 'company_admin', 'plant_admin', 'warehouse_manager')
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Only Production Manager, Company Admin, Plant Admin, or Warehouse Manager can reserve stock';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Reservation quantity must be positive';
  END IF;

  -- Lock the inventory row
  SELECT * INTO v_inv
  FROM public.inventory
  WHERE company_id = p_company_id
    AND warehouse_id = p_warehouse_id
    AND material_id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory row for this material at the specified warehouse';
  END IF;

  v_available := GREATEST(0,
    v_inv.quantity - v_inv.reserved_quantity - v_inv.quarantined_quantity - v_inv.damaged_qty
  );

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock: available %, requested %', v_available, p_quantity;
  END IF;

  UPDATE public.inventory
  SET reserved_quantity = reserved_quantity + p_quantity,
      updated_at = now()
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (
    company_id, user_id, action, entity_type, entity_id, new_values, created_at
  ) VALUES (
    p_company_id,
    v_user_id,
    'STOCK_RESERVED',
    'inventory',
    v_inv.id::text,
    jsonb_build_object(
      'material_id', p_material_id,
      'warehouse_id', p_warehouse_id,
      'reserved_qty', p_quantity,
      'production_order_id', p_production_order_id,
      'notes', p_notes
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'inventory_id', v_inv.id,
    'reserved_quantity', v_inv.reserved_quantity + p_quantity,
    'available_before', v_available,
    'available_after', v_available - p_quantity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.reserve_stock(uuid, uuid, uuid, numeric, uuid, text) TO authenticated;

-- ============================================================================
-- 10. CREATE release_reservation — unreserve when production consumes or cancels
-- ============================================================================
CREATE OR REPLACE FUNCTION public.release_reservation(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_material_id uuid,
  p_quantity numeric,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inv     public.inventory%ROWTYPE;
  v_has_role boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND company_id = p_company_id
      AND role IN ('production_manager', 'company_admin', 'plant_admin', 'warehouse_manager', 'production_operator')
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Not authorized to release reservations';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Release quantity must be positive';
  END IF;

  SELECT * INTO v_inv
  FROM public.inventory
  WHERE company_id = p_company_id
    AND warehouse_id = p_warehouse_id
    AND material_id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory row for this material at the specified warehouse';
  END IF;

  IF v_inv.reserved_quantity < p_quantity THEN
    RAISE EXCEPTION 'Cannot release more than reserved: reserved %, release %', v_inv.reserved_quantity, p_quantity;
  END IF;

  UPDATE public.inventory
  SET reserved_quantity = reserved_quantity - p_quantity,
      updated_at = now()
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (
    company_id, user_id, action, entity_type, entity_id, new_values, created_at
  ) VALUES (
    p_company_id,
    v_user_id,
    'RESERVATION_RELEASED',
    'inventory',
    v_inv.id::text,
    jsonb_build_object(
      'material_id', p_material_id,
      'warehouse_id', p_warehouse_id,
      'released_qty', p_quantity,
      'notes', p_notes
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'inventory_id', v_inv.id,
    'reserved_quantity', v_inv.reserved_quantity - p_quantity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.release_reservation(uuid, uuid, uuid, numeric, text) TO authenticated;

-- ============================================================================
-- 11. CREATE mark_damaged — move stock from available to damaged
-- ============================================================================
CREATE OR REPLACE FUNCTION public.mark_damaged(
  p_company_id uuid,
  p_warehouse_id uuid,
  p_material_id uuid,
  p_quantity numeric,
  p_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_inv     public.inventory%ROWTYPE;
  v_available numeric;
  v_has_role boolean;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND company_id = p_company_id
      AND role IN ('warehouse_manager', 'quality_inspector', 'company_admin', 'plant_admin')
  ) INTO v_has_role;

  IF NOT v_has_role THEN
    RAISE EXCEPTION 'Only Warehouse Manager, Quality Inspector, Company Admin, or Plant Admin can mark stock as damaged';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Damage quantity must be positive';
  END IF;

  SELECT * INTO v_inv
  FROM public.inventory
  WHERE company_id = p_company_id
    AND warehouse_id = p_warehouse_id
    AND material_id = p_material_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No inventory row for this material at the specified warehouse';
  END IF;

  v_available := GREATEST(0,
    v_inv.quantity - v_inv.reserved_quantity - v_inv.quarantined_quantity - v_inv.damaged_qty
  );

  IF v_available < p_quantity THEN
    RAISE EXCEPTION 'Insufficient available stock to mark as damaged: available %, requested %', v_available, p_quantity;
  END IF;

  UPDATE public.inventory
  SET damaged_qty = damaged_qty + p_quantity,
      updated_at = now()
  WHERE id = v_inv.id;

  INSERT INTO public.audit_logs (
    company_id, user_id, action, entity_type, entity_id, new_values, created_at
  ) VALUES (
    p_company_id,
    v_user_id,
    'STOCK_DAMAGED',
    'inventory',
    v_inv.id::text,
    jsonb_build_object(
      'material_id', p_material_id,
      'warehouse_id', p_warehouse_id,
      'damaged_qty', p_quantity,
      'reason', p_reason
    ),
    now()
  );

  RETURN jsonb_build_object(
    'success', true,
    'inventory_id', v_inv.id,
    'damaged_qty', v_inv.damaged_qty + p_quantity
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_damaged(uuid, uuid, uuid, numeric, text) TO authenticated;
