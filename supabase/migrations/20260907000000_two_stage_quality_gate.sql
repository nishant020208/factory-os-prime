-- ============================================================================
-- Migration: Two-Stage Quality Gate (Incoming QC + Final QC)
-- ============================================================================
-- The user-facing flow this completes:
--
--   Stage 1 — Incoming QC (raw materials):
--     PO arrives → Warehouse confirms Goods Receipt → incoming_material_inspections
--     rows are created (pending) by goods-receipt.tsx → the Quality Inspector
--     approves/rejects them on the Quality page's Incoming Materials tab.
--     Approval credits usable stock; rejection quarantines.
--     THIS MIGRATION: auto-assigns every pending incoming inspection to the
--     company's Quality Inspector(s) via a targeted notification, so the QC
--     role owns the gate instead of hearing about it by accident.
--
--   Stage 2 — Final QC (finished product, before SO release to customer):
--     Work order reaches 100% → Final Inspection (final-inspection.tsx) records
--     a quality_inspections row → on PASS the linked sales order moves to
--     'dispatch_ready' so Dispatch can hand it to the customer; on FAIL the SO
--     moves to 'quality_failed' and an NCR/CAPA is already created by the app.
--     THIS MIGRATION: adds the DB trigger that keeps sales_orders in sync with
--     the inspection verdict, plus a customer-facing notification on pass.
--
-- Nothing here deletes or rewrites existing data. Idempotent: safe to re-run.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Stage 1 — notify the Quality Inspector when incoming QC is requested
--    Trigger lives on incoming_material_inspections (INSERT with status
--    'pending', created by the goods-receipt confirmation).
-- ─────────────────────────────────────────────────────────────────────────────
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

  -- One targeted notification to the quality_inspector role of this company.
  -- notif_select_targeted RLS delivers it to every user holding that role.
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

DROP TRIGGER IF EXISTS trg_incoming_qc_assign ON public.incoming_material_inspections;
CREATE TRIGGER trg_incoming_qc_assign
AFTER INSERT ON public.incoming_material_inspections
FOR EACH ROW
EXECUTE FUNCTION public.trg_incoming_qc_assign_inspector();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Stage 2 — final inspection verdict drives the sales order status
--    quality_inspections.customer_order_id already exists (migration
--    20260902000000). final-inspection.tsx passes production_order_id; the
--    production order carries sales_order_id — resolve the SO through it when
--    customer_order_id is not set directly.
-- ─────────────────────────────────────────────────────────────────────────────
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
  -- Only act on a fresh final-inspection verdict (insert or result change),
  -- and only for pass / fail outcomes.
  IF TG_OP = 'UPDATE' AND NEW.result = OLD.result THEN
    RETURN NEW;
  END IF;
  IF NEW.result NOT IN ('pass', 'fail') THEN
    RETURN NEW;
  END IF;

  v_inspection_type := COALESCE(NEW.inspection_type, '');
  IF v_inspection_type NOT IN ('final', 'final_inspection') THEN
    RETURN NEW; -- incoming/in-process inspections never gate the SO
  END IF;

  -- Resolve the sales order: direct link first, else via the production order.
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
    -- Only advance orders still inside production — never regress shipped/completed.
    UPDATE public.sales_orders
    SET status = 'dispatch_ready', progress = GREATEST(COALESCE(progress, 0), 70)
    WHERE id = v_so_id
      AND status IN ('in_production', 'material_reserved', 'approved', 'quality_failed');

    -- Tell the customer their order cleared final QC.
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
    -- Fail: hold the order in quality_failed unless it already moved on.
    UPDATE public.sales_orders
    SET status = 'quality_failed'
    WHERE id = v_so_id
      AND status IN ('in_production', 'material_reserved', 'approved', 'dispatch_ready');

    -- Production Manager must rework; QC lead sees it too.
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

DROP TRIGGER IF EXISTS trg_final_qc_so_gate ON public.quality_inspections;
CREATE TRIGGER trg_final_qc_so_gate
AFTER INSERT OR UPDATE OF result ON public.quality_inspections
FOR EACH ROW
EXECUTE FUNCTION public.trg_final_qc_sales_order_gate();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Grant the Quality Inspector read access to incoming inspections with the
--    warehouse → plant scoping they already use in the UI (defensive: policy
--    exists from migration 20260827000000; re-assert the SELECT path here so a
--    fresh environment cannot miss it).
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'incoming_material_inspections' AND policyname = 'imi_select_quality'
  ) THEN
    CREATE POLICY imi_select_quality ON public.incoming_material_inspections
    FOR SELECT TO authenticated
    USING (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid() AND ur.role = 'quality_inspector'
      )
    );
  END IF;
END $$;
