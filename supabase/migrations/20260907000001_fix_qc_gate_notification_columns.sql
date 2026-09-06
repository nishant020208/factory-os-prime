-- Repair migration: 20260907000000 used a `message` column that does not exist
-- on notifications (the live schema uses `body` + `severity`). Re-apply both
-- trigger functions with the correct columns. Idempotent.
CREATE OR REPLACE FUNCTION public.trg_incoming_qc_assign_inspector()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_material text;
  v_warehouse text;
  v_po text;
BEGIN
  IF NEW.status <> 'pending' THEN
    RETURN NEW;
  END IF;

  SELECT name INTO v_material FROM public.materials WHERE id = NEW.material_id;
  SELECT name INTO v_warehouse FROM public.warehouses WHERE id = NEW.warehouse_id;
  SELECT po_number INTO v_po FROM public.purchase_orders WHERE id = NEW.purchase_order_id;

  INSERT INTO public.notifications (
    company_id, user_id, title, body, severity,
    related_entity_type, related_entity_id, to_role
  ) VALUES (
    NEW.company_id,
    NULL,
    '🔬 Incoming QC Required',
    format(
      '%s qty %s into %s (PO %s) is awaiting incoming quality inspection.',
      COALESCE(v_material, 'Material'),
      NEW.quantity,
      COALESCE(v_warehouse, 'warehouse'),
      COALESCE(v_po, '—')
    ),
    'warning',
    'incoming_material_inspections',
    NEW.id,
    'quality_inspector'
  );

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_final_qc_sales_order_gate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_so_id uuid;
  v_so_number text;
  v_customer_user uuid;
  v_inspection_type text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.result = OLD.result THEN
    RETURN NEW;
  END IF;
  IF NEW.result NOT IN ('pass', 'fail') THEN
    RETURN NEW;
  END IF;

  v_inspection_type := COALESCE(NEW.inspection_type, '');
  IF v_inspection_type NOT IN ('final', 'final_inspection') THEN
    RETURN NEW;
  END IF;

  v_so_id := NEW.customer_order_id;
  IF v_so_id IS NULL AND NEW.production_order_id IS NOT NULL THEN
    SELECT sales_order_id INTO v_so_id
    FROM public.production_orders
    WHERE id = NEW.production_order_id;
  END IF;
  IF v_so_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT so_number INTO v_so_number FROM public.sales_orders WHERE id = v_so_id;
  SELECT user_id INTO v_customer_user
  FROM public.customers WHERE id = (SELECT customer_id FROM public.sales_orders WHERE id = v_so_id);

  IF NEW.result = 'pass' THEN
    UPDATE public.sales_orders
    SET status = 'dispatch_ready', progress = GREATEST(COALESCE(progress, 0), 70)
    WHERE id = v_so_id
      AND status IN ('in_production', 'material_reserved', 'approved', 'quality_failed');

    IF v_customer_user IS NOT NULL THEN
      INSERT INTO public.notifications (
        company_id, user_id, title, body, severity,
        related_entity_type, related_entity_id, to_user
      ) VALUES (
        NEW.company_id,
        NULL,
        '✅ Quality Cleared — Ready to Ship',
        format('Your order %s passed final quality inspection and is being prepared for dispatch.', COALESCE(v_so_number, '')),
        'success',
        'sales_orders',
        v_so_id,
        v_customer_user
      );
    END IF;
  ELSE
    UPDATE public.sales_orders
    SET status = 'quality_failed'
    WHERE id = v_so_id
      AND status IN ('in_production', 'material_reserved', 'approved', 'dispatch_ready');

    INSERT INTO public.notifications (
      company_id, user_id, title, body, severity,
      related_entity_type, related_entity_id, to_role
    ) VALUES
      ( NEW.company_id, NULL,
        '❌ Final QC Failed — Order Held',
        format('Order %s failed final quality inspection. Dispatch is blocked until rework passes.', COALESCE(v_so_number, '')),
        'error', 'sales_orders', v_so_id, 'production_manager' ),
      ( NEW.company_id, NULL,
        '❌ Final QC Failed',
        format('Inspection %s recorded a fail against order %s.', COALESCE(NEW.inspection_number, ''), COALESCE(v_so_number, '')),
        'error', 'quality_inspections', NEW.id, 'quality_inspector' );
  END IF;

  RETURN NEW;
END;
$$;
