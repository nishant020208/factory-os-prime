-- ============================================================================
-- Migration: QC Warehouse Connectivity, Inbound/Outbound QC Updates & Transfers
-- ============================================================================

-- 1. Ensure all warehouses of Artisan Furniture Works are connected to Main Plant
UPDATE public.warehouses
SET plant_id = '22222222-2222-2222-2222-222222222222'
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND (plant_id IS NULL OR plant_id = '22222222-2222-2222-2222-222222222222');

-- Ensure Staging & Inspection Bay exists for Chicago/Detroit Main Plant
INSERT INTO public.warehouses (id, company_id, plant_id, name, code, status)
VALUES (
  'c5e88719-74d3-4903-8278-f7169d2d0001',
  '11111111-1111-1111-1111-111111111111',
  '22222222-2222-2222-2222-222222222222',
  'Staging & Inspection Bay',
  'WH-STAGE',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  plant_id = EXCLUDED.plant_id,
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  status = EXCLUDED.status;

-- 2. Synchronize Profiles & Whitelist for quality@abcmfg.demo & warehouse@abcmfg.demo
UPDATE public.profiles
SET
  company_id = '11111111-1111-1111-1111-111111111111',
  plant_id = '22222222-2222-2222-2222-222222222222'
WHERE email IN ('quality@abcmfg.demo', 'warehouse@abcmfg.demo');

UPDATE public.whitelist
SET
  company_id = '11111111-1111-1111-1111-111111111111',
  plant_id = '22222222-2222-2222-2222-222222222222'
WHERE email IN ('quality@abcmfg.demo', 'warehouse@abcmfg.demo');

UPDATE public.user_roles
SET
  company_id = '11111111-1111-1111-1111-111111111111',
  plant_id = '22222222-2222-2222-2222-222222222222'
WHERE user_id IN (
  SELECT id FROM public.profiles WHERE email IN ('quality@abcmfg.demo', 'warehouse@abcmfg.demo')
);

-- 3. Enhance transfer_stock to allow Quality Inspector role and log QC transfers
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
  v_from_name text;
  v_to_name   text;
  v_prod_sku  text;
BEGIN
  -- ── Authorization: allow warehouse_manager, quality_inspector, company_admin, plant_admin ──
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_user_id
      AND company_id = p_company_id
      AND role IN ('warehouse_manager', 'quality_inspector', 'company_admin', 'plant_admin')
  ) THEN
    RAISE EXCEPTION 'Permission denied: only Warehouse Manager, Quality Inspector or Admins can create transfers';
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

  -- ── Read + lock the source row ──
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

  -- Read + lock destination row
  SELECT quantity INTO v_to_qty
  FROM public.inventory
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_to_warehouse_id
  FOR UPDATE;
  v_to_qty := COALESCE(v_to_qty, 0);

  -- Execute transfer: decrement source
  UPDATE public.inventory
  SET quantity = quantity - p_quantity,
      updated_at = now()
  WHERE company_id = p_company_id
    AND product_id = p_product_id
    AND warehouse_id = p_from_warehouse_id;

  -- Increment or insert destination
  IF EXISTS (
    SELECT 1 FROM public.inventory
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND warehouse_id = p_to_warehouse_id
  ) THEN
    UPDATE public.inventory
    SET quantity = quantity + p_quantity,
        updated_at = now()
    WHERE company_id = p_company_id
      AND product_id = p_product_id
      AND warehouse_id = p_to_warehouse_id;
  ELSE
    INSERT INTO public.inventory (
      company_id, warehouse_id, product_id, material_id, quantity, status
    ) VALUES (
      p_company_id, p_to_warehouse_id, p_product_id, v_material, p_quantity, 'available'
    );
  END IF;

  -- Create stock transfer log
  INSERT INTO public.stock_transfers (
    company_id, from_warehouse_id, to_warehouse_id, product_id,
    quantity, status, notes, created_by
  ) VALUES (
    p_company_id, p_from_warehouse_id, p_to_warehouse_id, p_product_id,
    p_quantity, 'completed', p_notes, v_user_id
  )
  RETURNING * INTO v_transfer;

  -- Create inventory adjustments for audit
  INSERT INTO public.inventory_adjustments (
    company_id, warehouse_id, product_id, material_id,
    previous_quantity, new_quantity, adjusted_quantity,
    reason, adjusted_by
  ) VALUES
    (p_company_id, p_from_warehouse_id, p_product_id, v_material,
     v_from_qty, v_from_qty - p_quantity, -p_quantity,
     COALESCE(p_notes, 'Stock transfer out'), v_user_id),
    (p_company_id, p_to_warehouse_id, p_product_id, v_material,
     v_to_qty, v_to_qty + p_quantity, p_quantity,
     COALESCE(p_notes, 'Stock transfer in'), v_user_id);

  -- Fetch details for notifications
  SELECT name INTO v_from_name FROM public.warehouses WHERE id = p_from_warehouse_id;
  SELECT name INTO v_to_name FROM public.warehouses WHERE id = p_to_warehouse_id;
  SELECT sku INTO v_prod_sku FROM public.products WHERE id = p_product_id;

  -- Notify Quality Inspector if transfer involves inspection / staging / quarantine bay
  IF (v_from_name ILIKE '%stage%' OR v_from_name ILIKE '%inspect%' OR v_from_name ILIKE '%quarantine%'
      OR v_to_name ILIKE '%stage%' OR v_to_name ILIKE '%inspect%' OR v_to_name ILIKE '%quarantine%'
      OR p_notes ILIKE '%qc%' OR p_notes ILIKE '%quality%') THEN
    INSERT INTO public.notifications (
      company_id, user_id, title, body, severity,
      related_entity_type, related_entity_id, to_role
    ) VALUES (
      p_company_id, NULL,
      '🔬 QC Stock Transfer',
      format('%s qty %s transferred from %s to %s. Notes: %s',
        COALESCE(v_prod_sku, 'Item'), p_quantity, COALESCE(v_from_name, 'Source'),
        COALESCE(v_to_name, 'Destination'), COALESCE(p_notes, 'QC Movement')),
      'info',
      'stock_transfers',
      v_transfer.id,
      'quality_inspector'
    );
  END IF;

  RETURN jsonb_build_object(
    'id', v_transfer.id,
    'quantity', p_quantity,
    'status', 'completed',
    'from_warehouse', v_from_name,
    'to_warehouse', v_to_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.transfer_stock(uuid, uuid, uuid, uuid, numeric, text) TO authenticated;

-- 4. Outbound Dispatch QC Trigger on Shipments
CREATE OR REPLACE FUNCTION public.trg_dispatch_qc_inspector_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_so_number text;
  v_carrier text;
BEGIN
  SELECT so_number INTO v_so_number FROM public.sales_orders WHERE id = NEW.sales_order_id;
  v_carrier := COALESCE(NEW.carrier, 'Logistics');

  -- When a shipment is scheduled, ready, or dispatched, send a QC update to Quality Inspector
  IF (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.status <> OLD.status)) THEN
    INSERT INTO public.notifications (
      company_id, user_id, title, body, severity,
      related_entity_type, related_entity_id, to_role
    ) VALUES (
      NEW.company_id,
      NULL,
      '🚚 Outbound Dispatch QC Update',
      format('Shipment %s (Order %s) status is now "%s" via %s. Pre-dispatch verification logged.',
        COALESCE(NEW.shipment_number, 'Shipment'),
        COALESCE(v_so_number, '—'),
        NEW.status,
        v_carrier
      ),
      'info',
      'shipments',
      NEW.id,
      'quality_inspector'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_shipment_qc_update ON public.shipments;
CREATE TRIGGER trg_shipment_qc_update
AFTER INSERT OR UPDATE ON public.shipments
FOR EACH ROW
EXECUTE FUNCTION public.trg_dispatch_qc_inspector_update();
