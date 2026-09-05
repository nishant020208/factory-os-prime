-- ============================================================================
-- Migration: Multi-Warehouse Management, PO Delivery Warehouse & Quality Gate
-- ============================================================================

-- 1. Warehouses table enhancement & 3rd Warehouse Seed for Chicago Main Plant
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE public.warehouses ADD COLUMN IF NOT EXISTS address text;

-- Seed Staging & Inspection Bay for Chicago Main Plant
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
  name = EXCLUDED.name,
  code = EXCLUDED.code,
  status = EXCLUDED.status;

-- 2. Purchase Orders: Add delivery_warehouse_id column
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS delivery_warehouse_id uuid REFERENCES public.warehouses(id);

-- Backfill existing POs with default Main Warehouse
UPDATE public.purchase_orders
SET delivery_warehouse_id = '0d3633c7-a9e3-4cbf-ae76-7173954629fc'
WHERE delivery_warehouse_id IS NULL AND company_id = '11111111-1111-1111-1111-111111111111';

-- 3. Goods Receipts: Add inspection columns
ALTER TABLE public.goods_receipts
ADD COLUMN IF NOT EXISTS inspection_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS inspector_id uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS inspected_at timestamptz;

-- 4. Inventory: Add status and quarantined_quantity columns
ALTER TABLE public.inventory
ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'available',
ADD COLUMN IF NOT EXISTS quarantined_quantity numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS reserved_quantity numeric NOT NULL DEFAULT 0;

-- 5. Incoming Material Inspections Table
CREATE TABLE IF NOT EXISTS public.incoming_material_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id),
  plant_id uuid REFERENCES public.plants(id),
  goods_receipt_id uuid REFERENCES public.goods_receipts(id),
  purchase_order_id uuid REFERENCES public.purchase_orders(id),
  material_id uuid NOT NULL REFERENCES public.materials(id),
  warehouse_id uuid REFERENCES public.warehouses(id),
  quantity numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
  result text, -- 'approved', 'rejected'
  inspector_id uuid REFERENCES auth.users(id),
  inspection_notes text,
  rejection_reason text,
  inspected_at timestamptz,
  created_at timestamptz DEFAULT now()
);

GRANT ALL ON public.incoming_material_inspections TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.incoming_material_inspections TO authenticated;

ALTER TABLE public.incoming_material_inspections ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies for incoming_material_inspections
DROP POLICY IF EXISTS incoming_insp_select ON public.incoming_material_inspections;
CREATE POLICY incoming_insp_select ON public.incoming_material_inspections
FOR SELECT TO authenticated
USING (
  company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid())
);

DROP POLICY IF EXISTS incoming_insp_insert ON public.incoming_material_inspections;
CREATE POLICY incoming_insp_insert ON public.incoming_material_inspections
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'company_admin'::public.app_role,
        'plant_admin'::public.app_role,
        'warehouse_manager'::public.app_role,
        'quality_inspector'::public.app_role
      )
  )
);

DROP POLICY IF EXISTS incoming_insp_update ON public.incoming_material_inspections;
CREATE POLICY incoming_insp_update ON public.incoming_material_inspections
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'quality_inspector'::public.app_role,
        'company_admin'::public.app_role,
        'plant_admin'::public.app_role
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role IN (
        'quality_inspector'::public.app_role,
        'company_admin'::public.app_role,
        'plant_admin'::public.app_role
      )
  )
);

-- 7. Secure RPC to process Incoming Material Inspection Approval / Rejection
CREATE OR REPLACE FUNCTION public.process_incoming_inspection(
  p_inspection_id uuid,
  p_decision text, -- 'approved' or 'rejected'
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
BEGIN
  v_user_id := auth.uid();
  SELECT email INTO v_user_email FROM public.profiles WHERE id = v_user_id;

  -- Verify caller is quality inspector or admin
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

  -- Fetch PO & Material details for notifications and logs
  SELECT po_number INTO v_po_num FROM public.purchase_orders WHERE id = v_insp.purchase_order_id;
  SELECT name INTO v_mat_name FROM public.materials WHERE id = v_insp.material_id;

  -- Update Inspection record
  UPDATE public.incoming_material_inspections
  SET
    status = p_decision,
    result = p_decision,
    inspector_id = v_user_id,
    inspection_notes = p_notes,
    rejection_reason = p_rejection_reason,
    inspected_at = now()
  WHERE id = p_inspection_id;

  -- Update Goods Receipt status
  IF v_insp.goods_receipt_id IS NOT NULL THEN
    UPDATE public.goods_receipts
    SET
      inspection_status = p_decision,
      inspector_id = v_user_id,
      inspected_at = now()
    WHERE id = v_insp.goods_receipt_id;
  END IF;

  IF p_decision = 'approved' THEN
    -- Stock becomes available and usable in the target warehouse
    SELECT id INTO v_inv_id FROM public.inventory
    WHERE company_id = v_insp.company_id
      AND warehouse_id = v_insp.warehouse_id
      AND material_id = v_insp.material_id
    LIMIT 1;

    IF v_inv_id IS NOT NULL THEN
      UPDATE public.inventory
      SET
        quantity = quantity + v_insp.quantity,
        quarantined_quantity = GREATEST(0, quarantined_quantity - v_insp.quantity),
        status = 'available',
        updated_at = now()
      WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.inventory (
        company_id, warehouse_id, material_id, quantity, quarantined_quantity, status, updated_at
      ) VALUES (
        v_insp.company_id, v_insp.warehouse_id, v_insp.material_id, v_insp.quantity, 0, 'available', now()
      );
    END IF;

    -- Resume any waiting production orders
    PERFORM public.resume_orders_when_stocked(v_insp.company_id, v_insp.material_id);

  ELSIF p_decision = 'rejected' THEN
    -- Stock is quarantined/rejected and NOT added to usable inventory
    SELECT id INTO v_inv_id FROM public.inventory
    WHERE company_id = v_insp.company_id
      AND warehouse_id = v_insp.warehouse_id
      AND material_id = v_insp.material_id
    LIMIT 1;

    IF v_inv_id IS NOT NULL THEN
      UPDATE public.inventory
      SET
        quarantined_quantity = quarantined_quantity + v_insp.quantity,
        updated_at = now()
      WHERE id = v_inv_id;
    ELSE
      INSERT INTO public.inventory (
        company_id, warehouse_id, material_id, quantity, quarantined_quantity, status, updated_at
      ) VALUES (
        v_insp.company_id, v_insp.warehouse_id, v_insp.material_id, 0, v_insp.quantity, 'quarantined', now()
      );
    END IF;
  END IF;

  -- Write Audit Log
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

-- 8. Enhanced Transfer Stock Function (Supply Stock between warehouses)
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
  v_src_qty numeric;
  v_dest_inv_id uuid;
  v_transfer_id uuid;
  v_mat_name text;
BEGIN
  IF p_from_warehouse_id = p_to_warehouse_id THEN
    RAISE EXCEPTION 'Source and destination warehouses cannot be the same';
  END IF;

  IF p_quantity <= 0 THEN
    RAISE EXCEPTION 'Transfer quantity must be positive';
  END IF;

  -- Check source available quantity
  SELECT quantity INTO v_src_qty FROM public.inventory
  WHERE company_id = p_company_id
    AND warehouse_id = p_from_warehouse_id
    AND material_id = p_material_id;

  IF v_src_qty IS NULL OR v_src_qty < p_quantity THEN
    RAISE EXCEPTION 'Insufficient stock in source warehouse. Available: %, Requested: %', COALESCE(v_src_qty, 0), p_quantity;
  END IF;

  -- Decrement source
  UPDATE public.inventory
  SET quantity = quantity - p_quantity, updated_at = now()
  WHERE company_id = p_company_id
    AND warehouse_id = p_from_warehouse_id
    AND material_id = p_material_id;

  -- Increment or insert destination
  SELECT id INTO v_dest_inv_id FROM public.inventory
  WHERE company_id = p_company_id
    AND warehouse_id = p_to_warehouse_id
    AND material_id = p_material_id;

  IF v_dest_inv_id IS NOT NULL THEN
    UPDATE public.inventory
    SET quantity = quantity + p_quantity, status = 'available', updated_at = now()
    WHERE id = v_dest_inv_id;
  ELSE
    INSERT INTO public.inventory (
      company_id, warehouse_id, material_id, quantity, status, updated_at
    ) VALUES (
      p_company_id, p_to_warehouse_id, p_material_id, p_quantity, 'available', now()
    );
  END IF;

  -- Record stock_transfer
  INSERT INTO public.stock_transfers (
    company_id, from_warehouse_id, to_warehouse_id, material_id, quantity, status, notes, created_by, created_at
  ) VALUES (
    p_company_id, p_from_warehouse_id, p_to_warehouse_id, p_material_id, p_quantity, 'completed', p_notes, auth.uid(), now()
  ) RETURNING id INTO v_transfer_id;

  SELECT name INTO v_mat_name FROM public.materials WHERE id = p_material_id;

  -- Audit log
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
