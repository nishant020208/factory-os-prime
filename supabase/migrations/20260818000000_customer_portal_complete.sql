-- =====================================================================
-- FACTORYOS AI — CUSTOMER PORTAL COMPLETE (2026-08-18)
--
--  1. ISOLATION: in_company_ops()/in_company() now exclude customer_portal
--     (the same fix applied to supplier_portal earlier). The Customer is an
--     EXTERNAL role and must never see inventory/materials/production/
--     procurement/HR/audit data.
--  2. Products: the customer's New Order form needs the ACTIVE product
--     catalog (name + admin-set price) — granted via a dedicated policy.
--  3. Documents: customers may read docs explicitly shared with them
--     (visibility='customer') in addition to public + their own uploads.
--  4. QR codes: customers may SELECT only QRs tied to their OWN orders /
--     invoices / shipments; qr_insert no longer allows external roles;
--     a new ops-only UPDATE policy lets warehouse mark QRs used.
--  5. GRN fix (leftover from the Supplier build): warehouse_manager can
--     now update purchase_orders (mark received) — previously only
--     procurement_manager/company_admin could.
--  6. record_customer_payment() — SECURITY DEFINER RPC so the customer can
--     pay an invoice (a REAL write) without opening payments INSERT to the
--     table, and Finance is notified.
--  7. DEMO DATA: invoices, payments, shipment, quality certificate and
--     the four customer QR types (advance, invoice, shipment, quality,
--     warranty) for the demo customer (customer@abcmfg.demo).
-- =====================================================================

-- ─────────────── 0. HELPER: is_customer_portal() ───────────────
CREATE OR REPLACE FUNCTION public.is_customer_portal()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'customer_portal'::public.app_role
  );
$function$;

-- ─────────────── 1. INTERNAL HELPERS — exclude BOTH external portals ───────────────
CREATE OR REPLACE FUNCTION public.in_company_ops(_cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    _cid IS NOT NULL
    AND _cid = public.current_company_id()
    AND NOT public.is_supplier_portal()
    AND NOT public.is_customer_portal()
  );
$function$;

CREATE OR REPLACE FUNCTION public.in_company(_cid uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT (
    public.is_root_admin(auth.uid())
    OR (
      _cid IS NOT NULL
      AND _cid = public.current_company_id()
      AND NOT public.is_supplier_portal()
      AND NOT public.is_customer_portal()
    )
  );
$function$;

-- companies — external portals cannot read the buyer record either
DROP POLICY IF EXISTS companies_select_scoped ON public.companies;
CREATE POLICY companies_select_scoped ON public.companies
  FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (id = current_company_id() AND NOT is_supplier_portal() AND NOT is_customer_portal())
  );

-- materials — closed to external portals (customer order form uses PRODUCTS)
DROP POLICY IF EXISTS mat_select_company ON public.materials;
CREATE POLICY mat_select_company ON public.materials
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND NOT is_supplier_portal()
    AND NOT is_customer_portal()
  );

-- packing — closed to external portals
DROP POLICY IF EXISTS pck_select_company ON public.packing;
CREATE POLICY pck_select_company ON public.packing
  FOR SELECT TO authenticated
  USING (
    company_id = (SELECT profiles.company_id FROM public.profiles WHERE profiles.id = auth.uid())
    AND NOT is_supplier_portal()
    AND NOT is_customer_portal()
  );

-- ─────────────── 2. PRODUCTS — customer reads the active catalog (price is read-only) ───────────────
DROP POLICY IF EXISTS products_select_customer ON public.products;
CREATE POLICY products_select_customer ON public.products
  FOR SELECT TO authenticated
  USING (
    is_customer_portal()
    AND company_id = current_company_id()
    AND status = 'active'
  );

-- ─────────────── 3. DOCUMENTS — include explicitly-shared 'customer' visibility ───────────────
DROP POLICY IF EXISTS documents_select_iso ON public.documents;
CREATE POLICY documents_select_iso ON public.documents
  FOR SELECT TO authenticated
  USING (
    (
      is_customer_portal()
      AND (uploaded_by = auth.uid() OR visibility IN ('public', 'customer'))
    )
    OR ((NOT is_customer_portal()) AND in_company_ops(company_id))
    OR (is_auditor() AND in_company_ops(company_id))
  );

-- ─────────────── 4. QR CODES ───────────────
-- Select: ops see company QRs; a customer sees ONLY QRs tied to their own
-- orders / invoices / shipments; a supplier sees only own inbound QRs.
DROP POLICY IF EXISTS qr_select_ops ON public.qr_codes;
CREATE POLICY qr_select_ops ON public.qr_codes
  FOR SELECT TO authenticated
  USING (
    company_id = current_company_id()
    AND (
      (NOT is_supplier_portal() AND NOT is_customer_portal())
      OR (
        is_supplier_portal()
        AND type = 'inbound_shipment'
        AND entity_id IN (
          SELECT id FROM public.purchase_orders
          WHERE supplier_id = current_supplier_id()
            AND company_id = current_supplier_company()
        )
      )
      OR (
        is_customer_portal()
        AND (
          entity_id IN (
            SELECT id FROM public.sales_orders
            WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
          )
          OR entity_id IN (
            SELECT id FROM public.invoices
            WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
          )
          OR entity_id IN (
            SELECT id FROM public.shipments
            WHERE customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid())
          )
        )
      )
    )
  );

-- Insert: no external portals (no customer/supplier QR creation via API)
DROP POLICY IF EXISTS qr_insert ON public.qr_codes;
CREATE POLICY qr_insert ON public.qr_codes
  FOR INSERT TO authenticated
  WITH CHECK (
    (is_root_admin() OR (company_id = current_company_id()))
    AND NOT is_auditor()
    AND NOT is_supplier_portal()
    AND NOT is_customer_portal()
  );

-- Update: ops roles only (mark used / re-activate)
DROP POLICY IF EXISTS qr_update_ops ON public.qr_codes;
CREATE POLICY qr_update_ops ON public.qr_codes
  FOR UPDATE TO authenticated
  USING (
    company_id = current_company_id()
    AND NOT is_auditor()
    AND NOT is_supplier_portal()
    AND NOT is_customer_portal()
  )
  WITH CHECK (
    company_id = current_company_id()
    AND NOT is_auditor()
    AND NOT is_supplier_portal()
    AND NOT is_customer_portal()
  );

-- ─────────────── 5. PURCHASE ORDERS — warehouse_manager may mark received (GRN) ───────────────
DROP POLICY IF EXISTS po_update_supplier_own ON public.purchase_orders;
CREATE POLICY po_update_supplier_own ON public.purchase_orders
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('procurement_manager','company_admin','warehouse_manager')
      )
    )
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
      AND status IN ('sent','pending','modification_requested','accepted','in_progress')
    )
  )
  WITH CHECK (
    is_root_admin(auth.uid())
    OR (
      company_id = current_company_id()
      AND EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role IN ('procurement_manager','company_admin','warehouse_manager')
      )
    )
    OR (
      is_supplier_portal()
      AND supplier_id = current_supplier_id()
      AND company_id = current_supplier_company()
    )
  );

-- ─────────────── 6. record_customer_payment() RPC ───────────────
-- The customer pays an invoice: inserts the payment row, marks the invoice
-- paid, and notifies Finance. SECURITY DEFINER — the table stays closed to
-- customers; only this audited path can write.
CREATE OR REPLACE FUNCTION public.record_customer_payment(
  p_invoice_id uuid,
  p_amount numeric,
  p_method text DEFAULT 'bank_transfer',
  p_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_customer_id uuid;
  v_invoice     public.invoices%ROWTYPE;
  v_payment_no  text;
BEGIN
  SELECT id INTO v_customer_id
  FROM public.customers
  WHERE user_id = auth.uid()
  LIMIT 1;
  IF v_customer_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'No customer linked to this account');
  END IF;

  SELECT * INTO v_invoice
  FROM public.invoices
  WHERE id = p_invoice_id AND customer_id = v_customer_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'Invoice not found for this customer');
  END IF;

  v_payment_no := 'PAY-' || upper(substr(md5(random()::text), 1, 8));

  INSERT INTO public.payments (
    company_id, payment_number, invoice_id, customer_id, amount, method, status, paid_at, reference
  ) VALUES (
    v_invoice.company_id, v_payment_no, p_invoice_id, v_customer_id,
    p_amount, COALESCE(p_method, 'bank_transfer'), 'paid', now(), p_reference
  );

  UPDATE public.invoices
  SET status = 'paid', paid_date = COALESCE(paid_date, now())
  WHERE id = p_invoice_id;

  INSERT INTO public.notifications (
    company_id, to_role, to_user, title, body, severity, related_entity_type, related_entity_id
  ) VALUES (
    v_invoice.company_id, 'finance_manager', NULL,
    '💰 Payment Received',
    format('Payment of $%s received for invoice %s (customer payment).', p_amount, v_invoice.invoice_number),
    'success', 'invoices', p_invoice_id
  );

  RETURN jsonb_build_object('ok', true, 'invoice', v_invoice.invoice_number, 'payment', v_payment_no);
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'error', SQLERRM);
END;
$function$;

GRANT EXECUTE ON FUNCTION public.record_customer_payment(uuid, numeric, text, text) TO authenticated;

-- ─────────────── 7. DEMO DATA — demo customer (customer@abcmfg.demo) ───────────────
-- Invoices for the demo customer's real orders
INSERT INTO public.invoices (
  company_id, invoice_number, sales_order_id, customer_id, total_amount, tax_amount,
  status, issue_date, due_date, paid_date
)
SELECT
  '11111111-1111-1111-1111-111111111111',
  i.inv,
  so.id,
  so.customer_id,
  i.total,
  i.tax,
  i.status,
  now() - i.issue_ago,
  now() + i.due_in,
  CASE WHEN i.status = 'paid' THEN now() - i.paid_ago ELSE NULL END
FROM (VALUES
  ('INV-DEMO-001', 'SO-DEMO-003', 9600.00,   0.00, 'paid',   interval '20 days', interval '2 days', interval '9 days'),
  ('INV-DEMO-002', 'SO-DEMO-002', 48000.00,  0.00, 'sent',  interval '5 days',  interval '9 days', NULL),
  ('INV-DEMO-003', 'SO-DEMO-001', 125000.00, 0.00, 'sent',  interval '3 days',  interval '11 days', NULL)
) AS i(inv, so_num, total, tax, status, issue_ago, due_in, paid_ago)
JOIN public.sales_orders so ON so.so_number = i.so_num
ON CONFLICT DO NOTHING;

-- Payments for the demo customer
INSERT INTO public.payments (
  company_id, payment_number, invoice_id, customer_id, amount, method, status, paid_at, reference
)
SELECT
  '11111111-1111-1111-1111-111111111111',
  p.payment_no,
  inv.id,
  inv.customer_id,
  p.amount,
  p.method,
  'paid',
  now() - p.ago,
  p.ref
FROM (VALUES
  ('PAY-DEMO-001', 'INV-DEMO-001', 9600.00,  'bank_transfer', interval '9 days',  'TXN-DEMO-001'),
  ('PAY-DEMO-002', 'INV-DEMO-002', 14400.00, 'upi',            interval '2 days',  'TXN-DEMO-002')
) AS p(payment_no, inv_no, amount, method, ago, ref)
JOIN public.invoices inv ON inv.invoice_number = p.inv_no
ON CONFLICT DO NOTHING;

-- Shipment for the delivered order
INSERT INTO public.shipments (
  company_id, shipment_number, sales_order_id, customer_id, carrier, tracking_number,
  status, shipped_date, delivered_date
)
SELECT
  '11111111-1111-1111-1111-111111111111',
  'SHP-DEMO-001', so.id, so.customer_id,
  'Artisan Express', 'TRK-DEMO-003',
  'delivered', now() - interval '8 days', now() - interval '4 days'
FROM public.sales_orders so
WHERE so.so_number = 'SO-DEMO-003'
ON CONFLICT DO NOTHING;

-- Quality certificate for the delivered order
INSERT INTO public.quality_certificates (
  company_id, certificate_number, customer_order_id, issued_by
)
SELECT '11111111-1111-1111-1111-111111111111', 'QC-DEMO-001', NULL, NULL
WHERE NOT EXISTS (SELECT 1 FROM public.quality_certificates WHERE certificate_number = 'QC-DEMO-001');

-- Customer QR codes (explicit tokens so documents pages can reference them)
INSERT INTO public.qr_codes (
  company_id, entity_type, entity_id, type, status, qr_data, token, label, sub_label
)
SELECT
  '11111111-1111-1111-1111-111111111111',
  q.entity_type,
  q.entity_id,
  q.type,
  'active',
  q.entity_id,
  q.token::uuid,
  q.label,
  q.sub_label
FROM (VALUES
  ('customer_order',   (SELECT id FROM public.sales_orders WHERE so_number = 'SO-DEMO-002'), 'advance_payment',
   '11111111-2222-3333-4444-555555555501', 'SO-DEMO-002', 'Advance 30% of order total'),
  ('invoice',          (SELECT id FROM public.invoices WHERE invoice_number = 'INV-DEMO-001'), 'invoice',
   '11111111-2222-3333-4444-555555555502', 'INV-DEMO-001', 'Invoice QR'),
  ('invoice',          (SELECT id FROM public.invoices WHERE invoice_number = 'INV-DEMO-002'), 'invoice',
   '11111111-2222-3333-4444-555555555503', 'INV-DEMO-002', 'Invoice QR'),
  ('shipment',         (SELECT id FROM public.shipments WHERE shipment_number = 'SHP-DEMO-001'), 'shipment',
   '11111111-2222-3333-4444-555555555504', 'SHP-DEMO-001', 'Shipment tracking QR'),
  ('quality_certificate', (SELECT id FROM public.quality_certificates WHERE certificate_number = 'QC-DEMO-001'), 'quality_certificate',
   '11111111-2222-3333-4444-555555555505', 'QC-DEMO-001', 'Quality certificate QR'),
  ('sales_order',      (SELECT id FROM public.sales_orders WHERE so_number = 'SO-DEMO-003'), 'warranty',
   '11111111-2222-3333-4444-555555555506', 'SO-DEMO-003', 'Warranty certificate QR')
) AS q(entity_type, entity_id, type, token, label, sub_label)
WHERE q.entity_id IS NOT NULL
ON CONFLICT (token) DO NOTHING;

-- Confirm
SELECT count(*) AS customer_qrs FROM public.qr_codes WHERE company_id = '11111111-1111-1111-1111-111111111111' AND token::text LIKE '11111111-2222%';
