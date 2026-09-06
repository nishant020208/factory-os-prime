-- ============================================================================
-- Migration: Advance payment → invoice + plant-scoped invoices
-- ============================================================================
-- 1. invoices.plant_id: every invoice knows which plant it belongs to so a
--    plant-whitelisted Finance Manager sees only their plant's invoices.
--    Backfilled from the customer's plant (customers.plant_id).
-- 2. Auto-invoice: when a customer order's advance payment is confirmed
--    (status → advance_paid), create the advance invoice row immediately so
--    the Finance Manager's Invoices tab reflects the payment in real time.
-- 3. RLS: plant-scoped finance managers (whitelist row carries plant_id) may
--    read/update only invoices of their plant; company-level finance managers
--    and company admins keep full visibility.
-- ============================================================================

-- ── 1. plant_id column + backfill ──────────────────────────────────────────
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS plant_id uuid
  REFERENCES public.plants(id) ON DELETE SET NULL;

UPDATE public.invoices inv
SET plant_id = c.plant_id
FROM public.customers c
WHERE inv.customer_id = c.id
  AND inv.plant_id IS NULL
  AND c.plant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_invoices_plant ON public.invoices(plant_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order ON public.invoices(sales_order_id);

-- ── 2. Auto-create the advance invoice when payment is confirmed ──────────
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
    -- Deterministic per order: date + short hash of the order id, so retries
    -- never double-create (idempotent by invoice_number).
    v_inv_number := 'INV-ADV-' || to_char(now(), 'YYYYMMDD') || '-' ||
      substr(replace(NEW.id::text, '-', ''), 1, 6);

    -- Idempotency guard: skip when this order's advance invoice already exists.
    IF EXISTS (
      SELECT 1 FROM public.invoices WHERE invoice_number = v_inv_number
    ) THEN
      RETURN NEW;
    END IF;

    -- NOTE: invoices.sales_order_id references sales_orders (not
    -- customer_orders), so it stays NULL here — the invoice is linked via
    -- customer_id, same as the UI's "Generate Final Invoice" flow.
    INSERT INTO public.invoices (
      company_id, plant_id, invoice_number, sales_order_id, customer_id,
      total_amount, tax_amount, status, issue_date, due_date
    ) VALUES (
      NEW.company_id, v_customer_plant, v_inv_number, NULL, NEW.customer_id,
      v_advance, 0, 'sent', now(),
      now() + interval '15 days'
    )
    RETURNING id INTO v_inv_id;

    -- Notify finance managers that the advance invoice is ready. The
    -- notifications table has no plant_id column; notif_select_targeted RLS
    -- delivers to every user holding the role, so target the role directly.
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

DROP TRIGGER IF EXISTS trg_create_advance_invoice ON public.customer_orders;
CREATE TRIGGER trg_create_advance_invoice
AFTER UPDATE OF status ON public.customer_orders
FOR EACH ROW
EXECUTE FUNCTION public.create_advance_invoice();

-- ── 3. RLS: plant-scoped finance manager visibility ────────────────────────
-- Root, company admin, and company-level finance managers (whitelist row has
-- no plant) keep full visibility. A finance manager whitelisted for a specific
-- plant (user_roles.plant_id set) sees only that plant's invoices.
DROP POLICY IF EXISTS invoices_all ON public.invoices;
CREATE POLICY invoices_all ON public.invoices
FOR ALL TO authenticated
USING (
  public.is_root_admin(auth.uid())
  OR (
    company_id = public.current_company_id()
    AND public.current_user_plant_id() IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'finance_manager'::public.app_role
        AND ur.plant_id IS NOT NULL
    )
  )
  OR (
    company_id = public.current_company_id()
    AND plant_id = public.current_user_plant_id()
  )
  OR (
    company_id = public.current_company_id()
    AND plant_id IN (
      SELECT ur.plant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'finance_manager'::public.app_role
        AND ur.plant_id IS NOT NULL
    )
  )
)
WITH CHECK (
  public.is_root_admin(auth.uid())
  OR (
    company_id = public.current_company_id()
    AND public.current_user_plant_id() IS NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'finance_manager'::public.app_role
        AND ur.plant_id IS NOT NULL
    )
  )
  OR (
    company_id = public.current_company_id()
    AND plant_id = public.current_user_plant_id()
  )
  OR (
    company_id = public.current_company_id()
    AND plant_id IN (
      SELECT ur.plant_id FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'finance_manager'::public.app_role
        AND ur.plant_id IS NOT NULL
    )
  )
);