-- ============================================================================
-- Fix: process_incoming_inspection wrote to non-existent audit_logs columns
-- (entity_type, new_values). The real table has entity, entity_id (uuid),
-- metadata. This broke the whole approve/reject path for incoming QC with
-- "column entity_type of relation audit_logs does not exist". Recreate with
-- correct columns. All stock/resume logic is preserved from 20260906000001.
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
  v_inv_id uuid;
  v_po_num text;
  v_mat_name text;
  v_has_role boolean;
BEGIN
  v_user_id := auth.uid();

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
    company_id, user_id, action, entity, entity_id, metadata, created_at
  ) VALUES (
    v_insp.company_id,
    v_user_id,
    'INCOMING_INSPECTION_' || upper(p_decision),
    'incoming_material_inspections',
    p_inspection_id,
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
REVOKE EXECUTE ON FUNCTION public.process_incoming_inspection(uuid, text, text, text) FROM anon;