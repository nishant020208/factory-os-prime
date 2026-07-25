
-- =====================================================
-- Phase 1: schema + 3-customer demo lifecycle
-- =====================================================

-- === NEW TABLES ===============================================
CREATE TABLE IF NOT EXISTS public.bom (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  product_id uuid NOT NULL,
  version text NOT NULL DEFAULT 'v1',
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom TO authenticated;
GRANT ALL ON public.bom TO service_role;
ALTER TABLE public.bom ENABLE ROW LEVEL SECURITY;
CREATE POLICY bom_all ON public.bom FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  bom_id uuid NOT NULL REFERENCES public.bom(id) ON DELETE CASCADE,
  component_product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit text DEFAULT 'pcs',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_items TO authenticated;
GRANT ALL ON public.bom_items TO service_role;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY bom_items_all ON public.bom_items FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.sales_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  so_number text NOT NULL,
  customer_id uuid NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  priority text DEFAULT 'medium',
  total_amount numeric NOT NULL DEFAULT 0,
  currency text DEFAULT 'USD',
  order_date timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz,
  progress numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_orders TO authenticated;
GRANT ALL ON public.sales_orders TO service_role;
ALTER TABLE public.sales_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_orders_all ON public.sales_orders FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.sales_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  sales_order_id uuid NOT NULL REFERENCES public.sales_orders(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sales_order_items TO authenticated;
GRANT ALL ON public.sales_order_items TO service_role;
ALTER TABLE public.sales_order_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY sales_order_items_all ON public.sales_order_items FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.work_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  wo_number text NOT NULL,
  production_order_id uuid,
  machine_id uuid,
  operator_id uuid,
  operation text,
  status text NOT NULL DEFAULT 'pending',
  quantity numeric DEFAULT 0,
  start_time timestamptz,
  end_time timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.work_orders TO authenticated;
GRANT ALL ON public.work_orders TO service_role;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY work_orders_all ON public.work_orders FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.quality_inspections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  inspection_number text NOT NULL,
  inspection_type text NOT NULL DEFAULT 'in_process',
  production_order_id uuid,
  product_id uuid,
  inspector_id uuid,
  result text NOT NULL DEFAULT 'pending',
  defects_found integer DEFAULT 0,
  quantity_checked numeric DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_inspections TO authenticated;
GRANT ALL ON public.quality_inspections TO service_role;
ALTER TABLE public.quality_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY quality_inspections_all ON public.quality_inspections FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.shipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  shipment_number text NOT NULL,
  sales_order_id uuid,
  customer_id uuid,
  carrier text,
  tracking_number text,
  status text NOT NULL DEFAULT 'pending',
  shipped_date timestamptz,
  delivered_date timestamptz,
  destination text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shipments TO authenticated;
GRANT ALL ON public.shipments TO service_role;
ALTER TABLE public.shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY shipments_all ON public.shipments FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  invoice_number text NOT NULL,
  sales_order_id uuid,
  customer_id uuid,
  total_amount numeric NOT NULL DEFAULT 0,
  tax_amount numeric DEFAULT 0,
  currency text DEFAULT 'USD',
  status text NOT NULL DEFAULT 'draft',
  issue_date timestamptz NOT NULL DEFAULT now(),
  due_date timestamptz,
  paid_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;
GRANT ALL ON public.invoices TO service_role;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY invoices_all ON public.invoices FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  payment_number text NOT NULL,
  invoice_id uuid,
  customer_id uuid,
  amount numeric NOT NULL DEFAULT 0,
  method text DEFAULT 'bank_transfer',
  status text NOT NULL DEFAULT 'completed',
  paid_at timestamptz NOT NULL DEFAULT now(),
  reference text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payments TO authenticated;
GRANT ALL ON public.payments TO service_role;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY payments_all ON public.payments FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  ticket_number text NOT NULL,
  customer_id uuid,
  subject text NOT NULL,
  description text,
  priority text DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  assignee_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.support_tickets TO authenticated;
GRANT ALL ON public.support_tickets TO service_role;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY support_tickets_all ON public.support_tickets FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  category text DEFAULT 'general',
  tags text[],
  file_url text,
  file_type text,
  uploaded_by uuid,
  visibility text DEFAULT 'company',
  version text DEFAULT 'v1',
  status text DEFAULT 'published',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY documents_all ON public.documents FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.employees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  plant_id uuid,
  department_id uuid,
  employee_code text NOT NULL,
  full_name text NOT NULL,
  email text,
  phone text,
  job_title text,
  department text,
  status text NOT NULL DEFAULT 'active',
  hire_date date DEFAULT CURRENT_DATE,
  salary numeric DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
CREATE POLICY employees_all ON public.employees FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  check_in timestamptz,
  check_out timestamptz,
  hours_worked numeric DEFAULT 0,
  status text NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY attendance_all ON public.attendance FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.payroll (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  period text NOT NULL,
  gross_amount numeric NOT NULL DEFAULT 0,
  deductions numeric DEFAULT 0,
  net_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll TO authenticated;
GRANT ALL ON public.payroll TO service_role;
ALTER TABLE public.payroll ENABLE ROW LEVEL SECURITY;
CREATE POLICY payroll_all ON public.payroll FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  assignee_id uuid,
  status text NOT NULL DEFAULT 'todo',
  priority text DEFAULT 'medium',
  due_date timestamptz,
  entity text,
  entity_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks TO authenticated;
GRANT ALL ON public.tasks TO service_role;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY tasks_all ON public.tasks FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  entity text NOT NULL,
  entity_id uuid,
  requester_id uuid,
  approver_id uuid,
  status text NOT NULL DEFAULT 'pending',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO authenticated;
GRANT ALL ON public.approvals TO service_role;
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY approvals_all ON public.approvals FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

CREATE TABLE IF NOT EXISTS public.knowledge_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  title text NOT NULL,
  body text,
  category text DEFAULT 'general',
  tags text[],
  author_id uuid,
  status text DEFAULT 'published',
  views integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.knowledge_articles TO authenticated;
GRANT ALL ON public.knowledge_articles TO service_role;
ALTER TABLE public.knowledge_articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY knowledge_articles_all ON public.knowledge_articles FOR ALL TO authenticated
  USING (is_root_admin(auth.uid()) OR company_id = current_company_id())
  WITH CHECK (is_root_admin(auth.uid()) OR company_id = current_company_id());

-- === WIPE existing transactional demo data for ABC ============
DO $$
DECLARE abc uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  DELETE FROM public.notifications WHERE company_id = abc;
  DELETE FROM public.audit_logs WHERE company_id = abc;
  DELETE FROM public.purchase_orders WHERE company_id = abc;
  DELETE FROM public.production_orders WHERE company_id = abc;
  DELETE FROM public.inventory WHERE company_id = abc;
  DELETE FROM public.customers WHERE company_id = abc;
END $$;

-- === SEED 3 customers + full lifecycle ========================
DO $$
DECLARE
  abc         uuid := '11111111-1111-1111-1111-111111111111';
  plant       uuid := '22222222-2222-2222-2222-222222222222';
  wh_main     uuid := '0d3633c7-a9e3-4cbf-ae76-7173954629fc';
  wh_raw      uuid := 'b3720fd9-b505-4cbe-8030-f25c92a83080';
  p1 uuid := '46969c19-53c5-484e-9cc9-80af6ff9aa2d'; -- TB-500
  p2 uuid := 'f6cf46b3-f715-49bd-9be9-e148ba862947'; -- AH-220
  p3 uuid := '0dc43199-deb2-4755-8e28-f1cd3bb78ed2'; -- PB-88
  p4 uuid := '039bd699-6e8d-416d-94d5-fe75fff68101'; -- SM-3000
  p5 uuid := '96929e94-5a99-438c-882c-252ddc6fa469'; -- CB-X1
  sup1 uuid := '84d3d9b5-f76b-423e-87d7-927804465c0b';
  sup2 uuid := 'a1f71274-585e-4b29-acd9-4ee6bba53f8d';
  sup3 uuid := 'e559d9b3-f898-4875-960d-9c6a64e6e707';
  m1 uuid := 'e92b6c55-7243-4bcd-83fe-b35a42ac7632';
  m2 uuid := '41d5ecdc-a579-4826-80f8-8afa3a902a06';
  m3 uuid := 'c371407b-1aaf-4b94-a622-b7334302e1ff';
  m4 uuid := '405fb0ca-9e7e-461b-946f-d9caa1809bc2';
  admin_id uuid := 'd28df7e5-1fe5-45ad-b03a-8801ab5c99c1';
  prod_id  uuid := 'b2e3cbd8-8624-46d3-a6c3-f9c94f1be604';
  fin_id   uuid := '0eace4ab-8fec-4c2d-bf1a-ab5030f6c9cb';
  eng_id   uuid := '4c77ba3b-be8f-45cb-804b-4bfecc1e965b';

  c1 uuid; c2 uuid; c3 uuid;
  so1 uuid; so2 uuid; so3 uuid;
  po1 uuid; po2 uuid; po3 uuid;
  po1_prod uuid; po2_prod uuid; po3_prod uuid;
  inv1 uuid; inv2 uuid;
  ship1 uuid; ship2 uuid;
  b1 uuid; b2 uuid; b3 uuid;
  emp1 uuid; emp2 uuid; emp3 uuid; emp4 uuid; emp5 uuid;
BEGIN
  -- Customers
  INSERT INTO public.customers (id, company_id, name, contact_email, contact_phone, segment, status)
  VALUES (gen_random_uuid(), abc, 'Kirloskar Pumps Pvt Ltd',    'procurement@kirloskarpumps.in', '+91 20 6608 4000', 'Industrial',   'active') RETURNING id INTO c1;
  INSERT INTO public.customers (id, company_id, name, contact_email, contact_phone, segment, status)
  VALUES (gen_random_uuid(), abc, 'Bajaj Auto Components',      'buyer@bajajauto.co.in',       '+91 20 2747 2851', 'Automotive',   'active') RETURNING id INTO c2;
  INSERT INTO public.customers (id, company_id, name, contact_email, contact_phone, segment, status)
  VALUES (gen_random_uuid(), abc, 'Tata Steel Precision Div.',  'orders@tatasteel.com',        '+91 22 6665 8282', 'Steel & Alloy','active') RETURNING id INTO c3;

  -- Inventory starting stock
  INSERT INTO public.inventory (company_id, warehouse_id, product_id, quantity) VALUES
    (abc, wh_main, p1, 320), (abc, wh_main, p2, 180), (abc, wh_main, p3, 540),
    (abc, wh_main, p4, 62),  (abc, wh_main, p5, 8),
    (abc, wh_raw,  p1, 90),  (abc, wh_raw,  p2, 40),  (abc, wh_raw,  p3, 210);

  -- BOMs
  INSERT INTO public.bom (id, company_id, product_id, version, status, notes)
    VALUES (gen_random_uuid(), abc, p4, 'v2.1', 'active', 'Servo Motor SM-3000 assembly BOM') RETURNING id INTO b1;
  INSERT INTO public.bom_items (company_id, bom_id, component_product_id, quantity, unit) VALUES
    (abc, b1, p2, 1, 'pcs'), (abc, b1, p3, 4, 'pcs'), (abc, b1, p5, 1, 'pcs');
  INSERT INTO public.bom (id, company_id, product_id, version, status, notes)
    VALUES (gen_random_uuid(), abc, p1, 'v1.4', 'active', 'Titanium Bracket TB-500 fabrication BOM') RETURNING id INTO b2;
  INSERT INTO public.bom_items (company_id, bom_id, component_product_id, quantity, unit) VALUES
    (abc, b2, p3, 2, 'pcs');
  INSERT INTO public.bom (id, company_id, product_id, version, status, notes)
    VALUES (gen_random_uuid(), abc, p5, 'v3.0', 'active', 'Control Board CB-X1 assembly BOM') RETURNING id INTO b3;
  INSERT INTO public.bom_items (company_id, bom_id, component_product_id, quantity, unit) VALUES
    (abc, b3, p3, 3, 'pcs');

  -- ========== Customer 1: Kirloskar - COMPLETED ==========
  INSERT INTO public.sales_orders (id, company_id, so_number, customer_id, status, priority, total_amount, order_date, due_date, progress)
    VALUES (gen_random_uuid(), abc, 'SO-2026-1001', c1, 'delivered', 'high', 184500, now() - interval '38 days', now() - interval '8 days', 100)
    RETURNING id INTO so1;
  INSERT INTO public.sales_order_items (company_id, sales_order_id, product_id, quantity, unit_price, line_total) VALUES
    (abc, so1, p1, 120, 850,  102000),
    (abc, so1, p2, 60,  1200, 72000),
    (abc, so1, p3, 50,  210,  10500);

  INSERT INTO public.production_orders (id, company_id, plant_id, order_number, product_id, quantity, status, priority, start_date, due_date, progress)
    VALUES (gen_random_uuid(), abc, plant, 'PO-2026-1001', p1, 120, 'completed', 'high', now() - interval '32 days', now() - interval '14 days', 100)
    RETURNING id INTO po1_prod;

  INSERT INTO public.purchase_orders (id, company_id, po_number, supplier_id, status, total_amount, expected_date)
    VALUES (gen_random_uuid(), abc, 'PUR-2026-1001', sup1, 'received', 28400, now() - interval '28 days') RETURNING id INTO po1;

  INSERT INTO public.work_orders (company_id, wo_number, production_order_id, machine_id, operator_id, operation, status, quantity, start_time, end_time) VALUES
    (abc, 'WO-1001-A', po1_prod, m1, prod_id, 'CNC Milling',  'completed', 120, now() - interval '32 days', now() - interval '25 days'),
    (abc, 'WO-1001-B', po1_prod, m4, prod_id, 'Laser Cutting','completed', 120, now() - interval '25 days', now() - interval '20 days'),
    (abc, 'WO-1001-C', po1_prod, m3, prod_id, 'Assembly',     'completed', 120, now() - interval '20 days', now() - interval '15 days');

  INSERT INTO public.quality_inspections (company_id, inspection_number, inspection_type, production_order_id, product_id, inspector_id, result, defects_found, quantity_checked) VALUES
    (abc, 'QC-1001-IN',  'incoming',   po1_prod, p1, eng_id, 'pass', 0, 120),
    (abc, 'QC-1001-IP',  'in_process', po1_prod, p1, eng_id, 'pass', 2, 120),
    (abc, 'QC-1001-FIN', 'final',      po1_prod, p1, eng_id, 'pass', 1, 120);

  INSERT INTO public.shipments (id, company_id, shipment_number, sales_order_id, customer_id, carrier, tracking_number, status, shipped_date, delivered_date, destination)
    VALUES (gen_random_uuid(), abc, 'SHIP-2026-1001', so1, c1, 'DHL Freight', 'DHL-882-441-993', 'delivered', now() - interval '10 days', now() - interval '8 days', 'Pune, Maharashtra, India')
    RETURNING id INTO ship1;

  INSERT INTO public.invoices (id, company_id, invoice_number, sales_order_id, customer_id, total_amount, tax_amount, status, issue_date, due_date, paid_date)
    VALUES (gen_random_uuid(), abc, 'INV-2026-1001', so1, c1, 184500, 33210, 'paid', now() - interval '8 days', now() - interval '0 days', now() - interval '1 days')
    RETURNING id INTO inv1;
  INSERT INTO public.payments (company_id, payment_number, invoice_id, customer_id, amount, method, status, paid_at, reference) VALUES
    (abc, 'PAY-2026-1001', inv1, c1, 184500, 'bank_transfer', 'completed', now() - interval '1 days', 'NEFT-KP-9931');

  INSERT INTO public.support_tickets (company_id, ticket_number, customer_id, subject, description, priority, status, assignee_id, resolved_at) VALUES
    (abc, 'TKT-1001', c1, 'Shipment delivery confirmation', 'Customer requested delivery timeline confirmation for SHIP-2026-1001.', 'low', 'resolved', admin_id, now() - interval '7 days');

  -- ========== Customer 2: Bajaj - COMPLETED ==========
  INSERT INTO public.sales_orders (id, company_id, so_number, customer_id, status, priority, total_amount, order_date, due_date, progress)
    VALUES (gen_random_uuid(), abc, 'SO-2026-1002', c2, 'delivered', 'medium', 96300, now() - interval '30 days', now() - interval '4 days', 100)
    RETURNING id INTO so2;
  INSERT INTO public.sales_order_items (company_id, sales_order_id, product_id, quantity, unit_price, line_total) VALUES
    (abc, so2, p2, 40, 1200, 48000),
    (abc, so2, p3, 90, 210,  18900),
    (abc, so2, p5, 12, 2450, 29400);

  INSERT INTO public.production_orders (id, company_id, plant_id, order_number, product_id, quantity, status, priority, start_date, due_date, progress)
    VALUES (gen_random_uuid(), abc, plant, 'PO-2026-1002', p2, 40, 'completed', 'medium', now() - interval '26 days', now() - interval '10 days', 100)
    RETURNING id INTO po2_prod;

  INSERT INTO public.purchase_orders (id, company_id, po_number, supplier_id, status, total_amount, expected_date)
    VALUES (gen_random_uuid(), abc, 'PUR-2026-1002', sup2, 'received', 14200, now() - interval '22 days') RETURNING id INTO po2;

  INSERT INTO public.work_orders (company_id, wo_number, production_order_id, machine_id, operator_id, operation, status, quantity, start_time, end_time) VALUES
    (abc, 'WO-1002-A', po2_prod, m2, prod_id, 'CNC Lathe',   'completed', 40, now() - interval '26 days', now() - interval '20 days'),
    (abc, 'WO-1002-B', po2_prod, m3, prod_id, 'Assembly',    'completed', 40, now() - interval '20 days', now() - interval '15 days');

  INSERT INTO public.quality_inspections (company_id, inspection_number, inspection_type, production_order_id, product_id, inspector_id, result, defects_found, quantity_checked) VALUES
    (abc, 'QC-1002-IP',  'in_process', po2_prod, p2, eng_id, 'pass', 1, 40),
    (abc, 'QC-1002-FIN', 'final',      po2_prod, p2, eng_id, 'pass', 0, 40);

  INSERT INTO public.shipments (id, company_id, shipment_number, sales_order_id, customer_id, carrier, tracking_number, status, shipped_date, delivered_date, destination)
    VALUES (gen_random_uuid(), abc, 'SHIP-2026-1002', so2, c2, 'BlueDart', 'BD-771-224-006', 'delivered', now() - interval '6 days', now() - interval '4 days', 'Aurangabad, Maharashtra, India')
    RETURNING id INTO ship2;

  INSERT INTO public.invoices (id, company_id, invoice_number, sales_order_id, customer_id, total_amount, tax_amount, status, issue_date, due_date, paid_date)
    VALUES (gen_random_uuid(), abc, 'INV-2026-1002', so2, c2, 96300, 17334, 'paid', now() - interval '4 days', now() + interval '26 days', now() - interval '0 days')
    RETURNING id INTO inv2;
  INSERT INTO public.payments (company_id, payment_number, invoice_id, customer_id, amount, method, status, paid_at, reference) VALUES
    (abc, 'PAY-2026-1002', inv2, c2, 96300, 'bank_transfer', 'completed', now() - interval '0 days', 'NEFT-BJ-2210');

  -- ========== Customer 3: Tata - IN PRODUCTION ==========
  INSERT INTO public.sales_orders (id, company_id, so_number, customer_id, status, priority, total_amount, order_date, due_date, progress)
    VALUES (gen_random_uuid(), abc, 'SO-2026-1003', c3, 'in_production', 'high', 342000, now() - interval '12 days', now() + interval '18 days', 55)
    RETURNING id INTO so3;
  INSERT INTO public.sales_order_items (company_id, sales_order_id, product_id, quantity, unit_price, line_total) VALUES
    (abc, so3, p4, 60,  4200, 252000),
    (abc, so3, p1, 80,  850,  68000),
    (abc, so3, p5, 9,   2450, 22050);

  INSERT INTO public.production_orders (id, company_id, plant_id, order_number, product_id, quantity, status, priority, start_date, due_date, progress)
    VALUES (gen_random_uuid(), abc, plant, 'PO-2026-1003', p4, 60, 'in_progress', 'high', now() - interval '8 days', now() + interval '12 days', 55)
    RETURNING id INTO po3_prod;

  INSERT INTO public.purchase_orders (id, company_id, po_number, supplier_id, status, total_amount, expected_date) VALUES
    (gen_random_uuid(), abc, 'PUR-2026-1003', sup3, 'in_transit', 48600, now() + interval '3 days'),
    (gen_random_uuid(), abc, 'PUR-2026-1004', sup1, 'draft',      21200, now() + interval '9 days');

  INSERT INTO public.work_orders (company_id, wo_number, production_order_id, machine_id, operator_id, operation, status, quantity, start_time, end_time) VALUES
    (abc, 'WO-1003-A', po3_prod, m1, prod_id, 'CNC Milling', 'completed',  60, now() - interval '8 days', now() - interval '4 days'),
    (abc, 'WO-1003-B', po3_prod, m2, prod_id, 'CNC Lathe',   'in_progress',60, now() - interval '4 days', NULL),
    (abc, 'WO-1003-C', po3_prod, m3, prod_id, 'Assembly',    'pending',    60, NULL, NULL),
    (abc, 'WO-1003-D', po3_prod, m4, prod_id, 'Laser Cutting','pending',   60, NULL, NULL);

  INSERT INTO public.quality_inspections (company_id, inspection_number, inspection_type, production_order_id, product_id, inspector_id, result, defects_found, quantity_checked) VALUES
    (abc, 'QC-1003-IN', 'incoming',   po3_prod, p4, eng_id, 'pass',    0, 60),
    (abc, 'QC-1003-IP', 'in_process', po3_prod, p4, eng_id, 'pending', 0, 33);

  INSERT INTO public.shipments (company_id, shipment_number, sales_order_id, customer_id, carrier, status, destination) VALUES
    (abc, 'SHIP-2026-1003', so3, c3, 'Gati Ltd', 'pending', 'Jamshedpur, Jharkhand, India');

  INSERT INTO public.support_tickets (company_id, ticket_number, customer_id, subject, description, priority, status, assignee_id) VALUES
    (abc, 'TKT-1002', c3, 'Production milestone update request', 'Customer requests weekly production progress dashboard access.', 'medium', 'in_progress', admin_id),
    (abc, 'TKT-1003', c3, 'Quality inspection certificate copy',  'Requesting copies of QC certificates once available.', 'low', 'open', admin_id);

  -- Employees
  INSERT INTO public.employees (id, company_id, plant_id, employee_code, full_name, email, phone, job_title, department, status, hire_date, salary) VALUES
    (gen_random_uuid(), abc, plant, 'EMP-1001', 'Rajesh Sharma',   'rajesh@abcmfg.demo',   '+91 98220 11001', 'Plant Manager',       'Operations',   'active', '2019-04-15', 145000),
    (gen_random_uuid(), abc, plant, 'EMP-1002', 'Priya Iyer',      'priya@abcmfg.demo',    '+91 98220 11002', 'Production Manager',  'Production',   'active', '2020-08-01', 118000),
    (gen_random_uuid(), abc, plant, 'EMP-1003', 'Michael Chen',    'michael@abcmfg.demo',  '+91 98220 11003', 'Quality Lead',        'Quality',      'active', '2021-01-20', 96000),
    (gen_random_uuid(), abc, plant, 'EMP-1004', 'Ananya Deshmukh', 'ananya@abcmfg.demo',   '+91 98220 11004', 'Warehouse Supervisor','Warehouse',    'active', '2020-11-11', 82000),
    (gen_random_uuid(), abc, plant, 'EMP-1005', 'Vikram Singh',    'vikram@abcmfg.demo',   '+91 98220 11005', 'Maintenance Engineer','Maintenance',  'active', '2022-03-05', 88000),
    (gen_random_uuid(), abc, plant, 'EMP-1006', 'Sneha Patel',     'sneha@abcmfg.demo',    '+91 98220 11006', 'CNC Operator',        'Production',   'active', '2022-07-19', 62000),
    (gen_random_uuid(), abc, plant, 'EMP-1007', 'Arjun Nair',      'arjun@abcmfg.demo',    '+91 98220 11007', 'Procurement Officer', 'Procurement',  'active', '2021-09-30', 78000),
    (gen_random_uuid(), abc, plant, 'EMP-1008', 'Meera Kulkarni',  'meera@abcmfg.demo',    '+91 98220 11008', 'HR Business Partner', 'HR',           'active', '2019-12-01', 105000);

  -- Attendance for today
  INSERT INTO public.attendance (company_id, employee_id, date, check_in, check_out, hours_worked, status)
    SELECT abc, e.id, CURRENT_DATE, now() - interval '8 hours', now() - interval '30 minutes', 7.5, 'present'
    FROM public.employees e WHERE e.company_id = abc;

  -- Payroll current month
  INSERT INTO public.payroll (company_id, employee_id, period, gross_amount, deductions, net_amount, status, paid_at)
    SELECT abc, e.id, to_char(CURRENT_DATE, 'YYYY-MM'), e.salary, e.salary * 0.18, e.salary * 0.82, 'paid', now() - interval '2 days'
    FROM public.employees e WHERE e.company_id = abc;

  -- Tasks
  INSERT INTO public.tasks (company_id, title, description, assignee_id, status, priority, due_date, entity, entity_id) VALUES
    (abc, 'Finalize QC-1003-FIN inspection',        'Complete final QC on Tata Steel order once assembly done.', eng_id,   'todo',        'high',   now() + interval '10 days', 'quality_inspections', NULL),
    (abc, 'Approve PUR-2026-1004 draft PO',         'Review draft PO with Nordic Steel for follow-on materials.',  admin_id, 'in_progress', 'high',   now() + interval '2 days',  'purchase_orders', po1),
    (abc, 'Send monthly production report to CEO',  'Compile output, OEE, and quality metrics.',                   prod_id,  'todo',        'medium', now() + interval '5 days',  'reports', NULL),
    (abc, 'Preventive maintenance on Robotic R-7',  'Scheduled PM cycle; robot currently in maintenance status.',  eng_id,   'in_progress', 'medium', now() + interval '3 days',  'machines', m3),
    (abc, 'Reconcile INV-2026-1002 payment',        'Match payment to invoice and close ledger entry.',            fin_id,   'done',        'low',    now() - interval '1 days',  'invoices', inv2);

  -- Approvals
  INSERT INTO public.approvals (company_id, entity, entity_id, requester_id, approver_id, status, notes) VALUES
    (abc, 'purchase_orders',    po1,     prod_id, admin_id, 'pending',  'PUR-2026-1004 needs CFO approval before submission.'),
    (abc, 'sales_orders',       so3,     admin_id,fin_id,   'approved', 'Credit terms approved for Tata Steel.'),
    (abc, 'production_orders',  po3_prod,prod_id, admin_id, 'approved', 'Production plan approved.');

  -- Documents
  INSERT INTO public.documents (company_id, title, description, category, tags, file_type, uploaded_by) VALUES
    (abc, 'SOP - CNC Milling Setup',         'Standard operating procedure for Alpha-1 mill.', 'sop',          ARRAY['sop','production','cnc'],   'pdf', admin_id),
    (abc, 'Machine Manual - Robotic R-7',    'Full OEM manual for Robotic Assembly R-7.',      'manual',       ARRAY['machine','manual','robot'], 'pdf', eng_id),
    (abc, 'Quality Standards ISO 9001',      'Company quality manual aligned to ISO 9001.',    'iso',          ARRAY['iso','quality','compliance'], 'pdf', eng_id),
    (abc, 'HR Leave Policy 2026',            'Updated leave policy and holidays.',             'hr_policy',    ARRAY['hr','policy'],              'pdf', admin_id),
    (abc, 'Kirloskar Order Delivery Note',   'Delivery note for SHIP-2026-1001.',              'shipping',     ARRAY['customer','kirloskar'],     'pdf', admin_id);

  -- Knowledge Center
  INSERT INTO public.knowledge_articles (company_id, title, body, category, tags, author_id, views) VALUES
    (abc, 'How to create a Bill of Materials',    'Step-by-step guide to creating a BOM with components and quantities.', 'production', ARRAY['bom','how-to'],           prod_id, 128),
    (abc, 'Warehouse Cycle Count Procedure',      'Weekly cycle count workflow and reconciliation.',                       'warehouse',  ARRAY['warehouse','sop'],        admin_id, 87),
    (abc, 'Machine breakdown - first response',   'What to do in the first 15 minutes of a machine breakdown.',            'maintenance',ARRAY['maintenance','emergency'],eng_id, 214),
    (abc, 'Approving a Purchase Order',           'Procurement approval workflow and thresholds.',                         'procurement',ARRAY['procurement','approval'], fin_id, 96),
    (abc, 'Quality inspection best practices',    'Guidelines for incoming, in-process, and final inspection.',            'quality',    ARRAY['quality','iso'],          eng_id, 154);

  -- Notifications
  INSERT INTO public.notifications (company_id, user_id, title, body, severity) VALUES
    (abc, NULL, 'Payment received',       'Kirloskar Pumps paid INV-2026-1001 ($184,500).',     'success'),
    (abc, NULL, 'Payment received',       'Bajaj Auto Components paid INV-2026-1002 ($96,300).', 'success'),
    (abc, NULL, 'Production milestone',   'PO-2026-1003 (Tata Steel) reached 55% completion.',   'info'),
    (abc, NULL, 'Low stock warning',      'SKU-A1005 Control Board CB-X1 near reorder level.',   'warning'),
    (abc, NULL, 'Machine in maintenance', 'Robotic Assembly R-7 scheduled for PM cycle.',        'warning'),
    (abc, NULL, 'Shipment delivered',     'SHIP-2026-1002 delivered to Bajaj Auto Components.',  'success'),
    (abc, NULL, 'New support ticket',     'TKT-1003 raised by Tata Steel Precision Div.',        'info');

  -- Audit trail
  INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_id, metadata) VALUES
    (abc, admin_id, 'customer_created',    'customers',        c1,       jsonb_build_object('name','Kirloskar Pumps Pvt Ltd')),
    (abc, admin_id, 'customer_created',    'customers',        c2,       jsonb_build_object('name','Bajaj Auto Components')),
    (abc, admin_id, 'customer_created',    'customers',        c3,       jsonb_build_object('name','Tata Steel Precision Div.')),
    (abc, admin_id, 'sales_order_created', 'sales_orders',     so1,      jsonb_build_object('so_number','SO-2026-1001','amount',184500)),
    (abc, admin_id, 'sales_order_created', 'sales_orders',     so2,      jsonb_build_object('so_number','SO-2026-1002','amount',96300)),
    (abc, admin_id, 'sales_order_created', 'sales_orders',     so3,      jsonb_build_object('so_number','SO-2026-1003','amount',342000)),
    (abc, fin_id,   'invoice_paid',        'invoices',         inv1,     jsonb_build_object('invoice','INV-2026-1001','amount',184500)),
    (abc, fin_id,   'invoice_paid',        'invoices',         inv2,     jsonb_build_object('invoice','INV-2026-1002','amount',96300)),
    (abc, prod_id,  'production_started',  'production_orders',po3_prod, jsonb_build_object('order_number','PO-2026-1003'));
END $$;

-- === Realtime for new tables (best-effort) ====================
DO $$ BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname='supabase_realtime';
  IF FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.sales_orders';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.work_orders';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.shipments';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.payments';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.quality_inspections';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.tasks';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.approvals';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
