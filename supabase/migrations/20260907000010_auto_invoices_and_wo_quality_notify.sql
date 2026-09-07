-- ============================================================================
-- Migration: Auto-invoicing (SO advance + final, PO purchase) & WO→QC notify
-- ============================================================================
-- Real orders live in sales_orders, but the earlier advance-invoice trigger was
-- wired to the empty customer_orders table, so no invoice ever auto-generated in
-- the real flow. This migration rewires it to sales_orders and adds the two
-- remaining automatic invoices:
--
--   1. SO side  — sales_orders.status → 'advance_paid'  creates the ADVANCE
--                 invoice; sales_orders.status → 'dispatch_ready' creates the
--                 FINAL invoice (order total minus any advance already invoiced).
--                 Each auto-invoice also gets its qr_codes row (server-side, so
--                 the Finance Invoices tab shows a ready QR with no client step).
--   2. PO side  — when every incoming_material_inspection of a PO is approved
--                 (the Quality gate), a draft Purchase Invoice row is created in
--                 supplier_invoices (origin 'auto') with the real PO amount, and
--                 Finance + the supplier are notified.
--   3. supplier_invoices.origin column ('auto' vs 'supplier') so the supplier's
--      Raise-Invoice step reuses the auto row instead of duplicating it.
--   4. Work order completion → targeted notification to Production Manager and
--      Quality Inspector ("batch ready for finished-goods inspection").
-- All idempotent and additive — no data is deleted or rewritten.
-- ============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. sales_orders → advance invoice (when advance payment is confirmed)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_so_advance_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plant uuid;
  v_advance numeric;
  v_inv_number text;
  v_inv_id uuid;
BEGIN
  IF NEW.status = 'advance_paid' AND OLD.status IS DISTINCT FROM 'advance_paid' THEN
    v_plant := NEW.plant_id;
    SELECT plant_id INTO v_plant
    FROM public.customers WHERE id = NEW.customer_id;

    v_advance := ROUND(
      COALESCE(NEW.total_amount, 0) *
      COALESCE(NEW.advance_payment_percent, 0) / 100.0,
      2
    );

    v_inv_number := 'INV-ADV-' || to_char(now(), 'YYYYMMDD') || '-' ||
      substr(replace(NEW.id::text, '-', ''), 1, 6);

    IF v_advance <= 0 OR EXISTS (
      SELECT 1 FROM public.invoices WHERE invoice_number = v_inv_number
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.invoices (
      company_id, plant_id, invoice_number, sales_order_id, customer_id,
      total_amount, tax_amount, status, issue_date, due_date
    ) VALUES (
      NEW.company_id, v_plant, v_inv_number, NEW.id, NEW.customer_id,
      v_advance, 0, 'sent', now(), now() + interval '15 days'
    )
    RETURNING id INTO v_inv_id;

    -- Server-side QR so the Finance Invoices tab has a ready scan link.
    INSERT INTO public.qr_codes (
      company_id, entity_type, entity_id, type, status, qr_data,
      label, sub_label
    ) VALUES (
      NEW.company_id, 'invoice', v_inv_id, 'invoice', 'active', v_inv_id::text,
      v_inv_number, 'Advance invoice'
    );

    INSERT INTO public.notifications (
      company_id, user_id, title, body, severity,
      related_entity_type, related_entity_id, to_role
    ) VALUES (
      NEW.company_id, NULL,
      '🧾 Advance invoice generated',
      'Advance invoice ' || v_inv_number || ' for order ' ||
        COALESCE(NEW.so_number, NEW.id::text) || ' (' || v_advance || ') is ready.',
      'info', 'invoice', v_inv_id, 'finance_manager'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_so_advance_invoice ON public.sales_orders;
CREATE TRIGGER trg_so_advance_invoice
AFTER UPDATE OF status ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.create_so_advance_invoice();

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. sales_orders → final invoice (when the order is released for dispatch)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_so_final_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plant uuid;
  v_advance_paid numeric;
  v_final numeric;
  v_inv_number text;
  v_inv_id uuid;
BEGIN
  IF NEW.status = 'dispatch_ready' AND OLD.status IS DISTINCT FROM 'dispatch_ready' THEN
    v_plant := NEW.plant_id;
    SELECT plant_id INTO v_plant
    FROM public.customers WHERE id = NEW.customer_id;

    SELECT COALESCE(SUM(total_amount), 0) INTO v_advance_paid
    FROM public.invoices
    WHERE sales_order_id = NEW.id AND invoice_number LIKE 'INV-ADV-%';

    v_final := GREATEST(0, ROUND(COALESCE(NEW.total_amount, 0) - v_advance_paid, 2));

    v_inv_number := 'INV-FIN-' || to_char(now(), 'YYYYMMDD') || '-' ||
      substr(replace(NEW.id::text, '-', ''), 1, 6);

    IF v_final <= 0 OR EXISTS (
      SELECT 1 FROM public.invoices WHERE invoice_number = v_inv_number
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.invoices (
      company_id, plant_id, invoice_number, sales_order_id, customer_id,
      total_amount, tax_amount, status, issue_date, due_date
    ) VALUES (
      NEW.company_id, v_plant, v_inv_number, NEW.id, NEW.customer_id,
      v_final, 0, 'sent', now(), now() + interval '15 days'
    )
    RETURNING id INTO v_inv_id;

    INSERT INTO public.qr_codes (
      company_id, entity_type, entity_id, type, status, qr_data,
      label, sub_label
    ) VALUES (
      NEW.company_id, 'invoice', v_inv_id, 'invoice', 'active', v_inv_id::text,
      v_inv_number, 'Final invoice'
    );

    INSERT INTO public.notifications (
      company_id, user_id, title, body, severity,
      related_entity_type, related_entity_id, to_role
    ) VALUES (
      NEW.company_id, NULL,
      '🧾 Final invoice generated',
      'Final invoice ' || v_inv_number || ' for order ' ||
        COALESCE(NEW.so_number, NEW.id::text) || ' (' || v_final || ') is ready.',
      'info', 'invoice', v_inv_id, 'finance_manager'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_so_final_invoice ON public.sales_orders;
CREATE TRIGGER trg_so_final_invoice
AFTER UPDATE OF status ON public.sales_orders
FOR EACH ROW
EXECUTE FUNCTION public.create_so_final_invoice();

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. supplier_invoices.origin — distinguish auto purchase invoices from the
--    supplier's own submissions so one PO never gets two conflicting records.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.supplier_invoices
  ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'supplier';

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. PO side: auto Purchase Invoice once the Quality gate approves a PO's
--    incoming material inspection. Fires on each inspection approval; only
--    creates the invoice when every line of the PO has been decided (all
--    approved) and no invoice exists for that PO yet.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_purchase_invoice_on_qc_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv_id uuid;
BEGIN
  IF NEW.status <> 'approved' THEN
    RETURN NEW;
  END IF;

  -- Only when every inspection line of this PO has been decided (all approved).
  IF EXISTS (
    SELECT 1 FROM public.incoming_material_inspections imi
    WHERE imi.purchase_order_id = NEW.purchase_order_id
      AND imi.status IN ('pending', 'rejected', 'quarantined')
  ) THEN
    RETURN NEW;
  END IF;

  -- Insert the invoice only when none exists yet for this PO. Deterministic
  -- number per PO, so re-runs never duplicate.
  INSERT INTO public.supplier_invoices (
    company_id, supplier_id, po_id, invoice_number, gst_amount,
    total_amount, status, origin
  )
  SELECT
    po.company_id, po.supplier_id, po.id,
    'PINV-' || to_char(now(), 'YYYYMMDD') || '-' || substr(replace(po.id::text, '-', ''), 1, 6),
    0,
    COALESCE(
      (SELECT SUM(poi.quantity * poi.unit_price)
         FROM public.purchase_order_items poi
        WHERE poi.purchase_order_id = po.id),
      COALESCE(po.total_amount, 0)
    ),
    'pending', 'auto'
  FROM public.purchase_orders po
  WHERE po.id = NEW.purchase_order_id
    AND NOT EXISTS (
      SELECT 1 FROM public.supplier_invoices si WHERE si.po_id = po.id
    )
  RETURNING id INTO v_inv_id;

  IF v_inv_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Finance Manager: purchase invoice ready to process.
  INSERT INTO public.notifications (
    company_id, user_id, title, body, severity,
    related_entity_type, related_entity_id, to_role
  )
  SELECT
    company_id, NULL,
    '🧾 Purchase invoice auto-generated',
    'Purchase invoice ' || invoice_number || ' for PO ' ||
      COALESCE(po_number, po_id::text) || ' (' || total_amount || ') awaits payment.',
    'info', 'supplier_invoices', v_inv_id, 'finance_manager'
  FROM public.supplier_invoices si, public.purchase_orders po
  WHERE si.id = v_inv_id AND po.id = si.po_id;

  -- Supplier: their invoice for this PO is already recorded — no re-entry.
  INSERT INTO public.notifications (
    company_id, user_id, title, body, severity,
    related_entity_type, related_entity_id
  )
  SELECT
    si.company_id, s.user_id,
    '🧾 Purchase invoice recorded for PO ' || COALESCE(po.po_number, ''),
    'Invoice ' || si.invoice_number || ' (' || si.total_amount ||
      ') was auto-created when your delivery cleared quality inspection. ' ||
      'No need to raise it again — check your Invoices tab.',
    'info', 'supplier_invoices', si.id
  FROM public.supplier_invoices si
  JOIN public.purchase_orders po ON po.id = si.po_id
  LEFT JOIN public.suppliers s ON s.id = si.supplier_id
  WHERE si.id = v_inv_id AND s.user_id IS NOT NULL;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_purchase_invoice_on_qc_approval ON public.incoming_material_inspections;
CREATE TRIGGER trg_purchase_invoice_on_qc_approval
AFTER UPDATE OF status ON public.incoming_material_inspections
FOR EACH ROW
EXECUTE FUNCTION public.trg_purchase_invoice_on_qc_approval();

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Work order completion → "batch ready for finished-goods inspection"
--    notifications to Production Manager + Quality Inspector (role-targeted).
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.trg_wo_complete_notify_quality()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.notifications (
      company_id, user_id, title, body, severity,
      related_entity_type, related_entity_id, to_role
    ) VALUES (
      NEW.company_id, NULL,
      '✅ Work Order Complete',
      'Work Order ' || COALESCE(NEW.wo_number, NEW.id::text) ||
        ' (' || COALESCE(NEW.operation, 'operation') || ', qty ' ||
        COALESCE(NEW.quantity, 0) || ') completed.',
      'success', 'work_orders', NEW.id, 'production_manager'
    );

    INSERT INTO public.notifications (
      company_id, user_id, title, body, severity,
      related_entity_type, related_entity_id, to_role
    ) VALUES (
      NEW.company_id, NULL,
      '🔍 Batch Ready for Inspection',
      'Work Order ' || COALESCE(NEW.wo_number, NEW.id::text) ||
        ' is 100% complete and awaiting finished-goods inspection.',
      'info', 'work_orders', NEW.id, 'quality_inspector'
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_wo_complete_notify_quality ON public.work_orders;
CREATE TRIGGER trg_wo_complete_notify_quality
AFTER UPDATE OF status ON public.work_orders
FOR EACH ROW
EXECUTE FUNCTION public.trg_wo_complete_notify_quality();
