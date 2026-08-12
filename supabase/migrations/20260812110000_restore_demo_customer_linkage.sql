-- =============================================================================
-- RESTORE DEMO CUSTOMER LINKAGE
-- -----------------------------------------------------------------------------
-- Earlier test-data cleanup deleted the demo customer row + SO-DEMO orders,
-- which left the demo login (customer@abcmfg.demo) with no linked `customers`
-- row. Without it the customer portal renders empty AND RLS insert policies
-- (customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()))
-- reject customer actions like posting a support ticket.
-- This restores the linkage idempotently (same shape as 20260806230000).
-- =============================================================================

DO $$
DECLARE
  _uid uuid := '2accac04-8137-4728-bbd0-bb14ec13d81f'; -- customer@abcmfg.demo
  _company uuid := '11111111-1111-1111-1111-111111111111';
  _cust uuid;
BEGIN
  -- 1. Link (or create) the customers row for the demo portal login.
  SELECT id INTO _cust FROM public.customers
   WHERE email = 'customer@abcmfg.demo' OR user_id = _uid
   ORDER BY created_at LIMIT 1;

  IF _cust IS NULL THEN
    INSERT INTO public.customers
      (company_id, user_id, name, business_name, email, contact_email, contact_person,
       phone, status, is_active)
    VALUES
      (_company, _uid, 'ABC Manufacturing (Demo Customer)', 'ABC Manufacturing (Demo Customer)',
       'customer@abcmfg.demo', 'customer@abcmfg.demo', 'Demo Buyer',
       '+1 555-0100', 'active', true)
    RETURNING id INTO _cust;
  ELSE
    UPDATE public.customers SET user_id = _uid, email = 'customer@abcmfg.demo',
           contact_email = 'customer@abcmfg.demo'
     WHERE id = _cust;
  END IF;

  -- 2. Give the demo customer a few sales orders (own-account, isolated).
  IF NOT EXISTS (SELECT 1 FROM public.sales_orders WHERE customer_id = _cust AND so_number = 'SO-DEMO-001') THEN
    INSERT INTO public.sales_orders
      (company_id, customer_id, so_number, status, priority, total_amount, order_date, due_date, progress)
    VALUES
      (_company, _cust, 'SO-DEMO-001', 'in_production', 'high', 125000.00, now() - interval '12 days', now() + interval '10 days', 45),
      (_company, _cust, 'SO-DEMO-002', 'approved', 'medium', 48000.00, now() - interval '5 days', now() + interval '21 days', 10),
      (_company, _cust, 'SO-DEMO-003', 'delivered', 'normal', 9600.00, now() - interval '40 days', now() - interval '6 days', 100);
  END IF;

  -- 3. One customer_documents row scoped to the demo customer.
  IF NOT EXISTS (SELECT 1 FROM public.customer_documents WHERE customer_id = _cust) THEN
    INSERT INTO public.customer_documents
      (company_id, customer_id, title, file_url, file_type, created_at)
    VALUES
      (_company, _cust, 'Quality Certificate — SO-DEMO-003',
       'https://example.invalid/certs/so-demo-003.pdf', 'pdf', now() - interval '5 days');
  END IF;
END $$;
