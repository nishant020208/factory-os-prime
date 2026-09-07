-- ============================================================================
-- Follow-up: rewrite trg_purchase_invoice_on_qc_approval as a single-statement
-- INSERT..SELECT (robust against rowtype/edge regressions) and re-attach the
-- trigger. Idempotent; only affects the auto purchase-invoice path.
-- ============================================================================
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
    si.company_id, NULL,
    '🧾 Purchase invoice auto-generated',
    'Purchase invoice ' || si.invoice_number || ' for PO ' ||
      COALESCE(po.po_number, po.id::text) || ' (' || si.total_amount || ') awaits payment.',
    'info', 'supplier_invoices', si.id, 'finance_manager'
  FROM public.supplier_invoices si
  JOIN public.purchase_orders po ON po.id = si.po_id
  WHERE si.id = v_inv_id;

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
