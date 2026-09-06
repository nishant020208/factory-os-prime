-- ============================================================================
-- Fix: recreate create_advance_invoice() — invoices.sales_order_id FK points
-- to sales_orders (not customer_orders), so the advance invoice links via
-- customer_id only (same as the UI's Generate Final Invoice flow). Invoice
-- numbers are deterministic per order for idempotent retries.
-- ============================================================================
CREATE OR REPLACE FUNCTION public.create_advance_invoice()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_customer_plant uuid;
  v_inv_number text;
  v_advance numeric;
  v_inv_id uuid;
BEGIN
  IF NEW.status = 'advance_paid' AND OLD.status IS DISTINCT FROM 'advance_paid' THEN
    SELECT plant_id INTO v_customer_plant
    FROM public.customers WHERE id = NEW.customer_id;

    v_advance := COALESCE(NEW.advance_amount, 0);
    -- Deterministic per order: date + short hash of the order id.
    v_inv_number := 'INV-ADV-' || to_char(now(), 'YYYYMMDD') || '-' ||
      substr(replace(NEW.id::text, '-', ''), 1, 6);

    IF EXISTS (
      SELECT 1 FROM public.invoices WHERE invoice_number = v_inv_number
    ) THEN
      RETURN NEW;
    END IF;

    INSERT INTO public.invoices (
      company_id, plant_id, invoice_number, sales_order_id, customer_id,
      total_amount, tax_amount, status, issue_date, due_date
    ) VALUES (
      NEW.company_id, v_customer_plant, v_inv_number, NULL, NEW.customer_id,
      v_advance, 0, 'sent', now(),
      now() + interval '15 days'
    )
    RETURNING id INTO v_inv_id;

    -- Notify finance managers that the advance invoice is ready.
    INSERT INTO public.notifications (
      company_id, user_id, title, body, severity,
      related_entity_type, related_entity_id, to_role
    ) VALUES (
      NEW.company_id,
      NULL,
      '🧾 Advance invoice generated',
      'Advance invoice ' || v_inv_number || ' for order ' ||
        COALESCE(NEW.order_number, NEW.id::text) || ' (' || v_advance || ') is ready.',
      'info', 'invoice', v_inv_id, 'finance_manager'
    );
  END IF;
  RETURN NEW;
END;
$$;