-- ============================================================================
-- Atomic inter-warehouse stock transfer
--
-- The core guarantee: a transfer ALWAYS either fully completes (source
-- decremented AND destination incremented together) or fully fails (neither
-- happens). This is enforced as a single SECURITY DEFINER transaction, never
-- as two separate client-side writes that could partially fail.
--
-- The stock it reads/writes is the SAME `inventory` table used everywhere
-- else (Inventory tab, Stock Movement, production checks). Every completed
-- transfer also writes:
--   - a `stock_transfers` record (the transfer itself),
--   - two `inventory_adjustments` rows (one per side) so it shows up in the
--     existing Stock Movement ledger as a normal movement,
--   - an explicit `audit_logs` row with the real actor id and the before→after
--     diff at BOTH locations.
-- ============================================================================

ALTER TABLE public.stock_transfers ADD COLUMN IF NOT EXISTS notes text;

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
  v_from_qty  numeric;
  v_to_qty    numeric;
  v_material  uuid;
  v_transfer  public.stock_transfers;
  v_result    jsonb;
BEGIN
  -- ── Authorization: only internal roles of THIS company may move stock ──
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

  -- ── Validation ──
  IF p_from_warehouse_id = p_to_warehouse_id THEN
    RAISE EXCEPTION 'Source and destination must be different locations';
  END IF;
  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RAISE EXCEPTION 'Quantity must be greater than zero';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouses WHERE id = p_from_warehouse_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Source warehouse not found in this company';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.warehouses WHERE id = p_to_warehouse_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Destination warehouse not found in this company';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.products WHERE id = p_product_id AND company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Product not found in this company';
  END IF;

  -- ── Read + lock the source row (serializes concurrent transfers) ──
  SELECT quantity, material_id INTO v_from_qty, v_material
  FROM public.inventory
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_from_warehouse_id
  FOR UPDATE;

  IF v_from_qty IS NULL THEN
    RAISE EXCEPTION 'No stock of this product at the source location';
  END IF;
  IF v_from_qty < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock at source: available %, requested %', v_from_qty, p_quantity;
  END IF;

  -- Read + lock the destination row (may not exist yet)
  SELECT quantity INTO v_to_qty
  FROM public.inventory
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_to_warehouse_id
  FOR UPDATE;
  v_to_qty := COALESCE(v_to_qty, 0);

  -- ── Atomic decrement/increment ──
  UPDATE public.inventory
  SET quantity = quantity - p_quantity, updated_at = now()
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_from_warehouse_id;

  INSERT INTO public.inventory (company_id, product_id, material_id, warehouse_id, quantity, updated_at)
  VALUES (p_company_id, p_product_id, v_material, p_to_warehouse_id, p_quantity, now())
  ON CONFLICT (warehouse_id, product_id)
  DO UPDATE SET quantity = public.inventory.quantity + EXCLUDED.quantity, updated_at = now();

  -- ── Transfer record ──
  INSERT INTO public.stock_transfers (
    company_id, from_warehouse_id, to_warehouse_id, material_id, product_id,
    quantity, status, notes, created_by
  )
  VALUES (
    p_company_id, p_from_warehouse_id, p_to_warehouse_id, v_material, p_product_id,
    p_quantity, 'completed', p_notes, v_user_id
  )
  RETURNING * INTO v_transfer;

  -- ── Stock movement ledger (both sides) — shows up in Stock Movement ──
  INSERT INTO public.inventory_adjustments (
    company_id, product_id, warehouse_id, old_quantity, new_quantity, delta, reason, adjusted_by
  )
  VALUES
    (p_company_id, p_product_id, p_from_warehouse_id,
     v_from_qty, v_from_qty - p_quantity, -p_quantity,
     COALESCE(p_notes, 'Inter-warehouse transfer out'), v_user_id),
    (p_company_id, p_product_id, p_to_warehouse_id,
     v_to_qty, v_to_qty + p_quantity, p_quantity,
     COALESCE(p_notes, 'Inter-warehouse transfer in'), v_user_id);

  -- ── Explicit audit row with the before→after diff at both locations ──
  INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_id, metadata)
  VALUES (p_company_id, v_user_id, 'stock_transferred', 'stock_transfers', v_transfer.id,
    jsonb_build_object(
      'from_warehouse_id', p_from_warehouse_id,
      'to_warehouse_id', p_to_warehouse_id,
      'product_id', p_product_id,
      'quantity', p_quantity,
      'notes', p_notes,
      'from_old_qty', v_from_qty,
      'from_new_qty', v_from_qty - p_quantity,
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