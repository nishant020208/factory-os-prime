-- ============================================================
-- COMPREHENSIVE DEMO DATA: ALL MODULES
-- For ABC Manufacturing (company_id: 11111111-1111-1111-1111-111111111111)
-- 3 Customers: AeroSpace Dynamics (completed), VoltDrive Electric (completed), MediCore HealthTech (in-progress)
-- ============================================================

-- Use a DO block to safely handle tables that may or may not exist
DO $$ BEGIN

-- ============================================================
-- EMPLOYEES
-- ============================================================
INSERT INTO public.employees (id, company_id, employee_code, full_name, email, job_title, department, status, hire_date) VALUES
  ('aaaa0001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','EMP-001','Sarah Chen','sarah.chen@abcmfg.demo','Plant Manager','Operations','active', now() - interval '3 years'),
  ('aaaa0001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','EMP-002','James Rodriguez','james.r@abcmfg.demo','Production Manager','Production','active', now() - interval '2 years'),
  ('aaaa0001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','EMP-003','Lisa Wang','lisa.w@abcmfg.demo','Quality Inspector','Quality','active', now() - interval '18 months'),
  ('aaaa0001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','EMP-004','Mike Johnson','mike.j@abcmfg.demo','Maintenance Engineer','Maintenance','active', now() - interval '2 years'),
  ('aaaa0001-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','EMP-005','Priya Patel','priya.p@abcmfg.demo','Warehouse Manager','Warehouse','active', now() - interval '15 months'),
  ('aaaa0001-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','EMP-006','Tom Williams','tom.w@abcmfg.demo','Finance Manager','Finance','active', now() - interval '4 years'),
  ('aaaa0001-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','EMP-007','Anna Kim','anna.k@abcmfg.demo','HR Manager','Human Resources','active', now() - interval '3 years'),
  ('aaaa0001-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','EMP-008','David Park','david.p@abcmfg.demo','CNC Operator','Production','active', now() - interval '8 months'),
  ('aaaa0001-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','EMP-009','Rachel Green','rachel.g@abcmfg.demo','Procurement Specialist','Procurement','active', now() - interval '1 year'),
  ('aaaa0001-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','EMP-010','Carlos Ruiz','carlos.r@abcmfg.demo','Assembly Technician','Production','active', now() - interval '6 months')
ON CONFLICT DO NOTHING;

-- ============================================================
-- BOM (Bill of Materials)
-- ============================================================
INSERT INTO public.bom (id, company_id, product_id, version, status, notes) VALUES
  ('bbbb0001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.products WHERE sku='SKU-A1001' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'v2.1','active','Titanium Bracket assembly — revised for aerospace spec'),
  ('bbbb0001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.products WHERE sku='SKU-A1002' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'v1.3','active','Aluminum Housing — standard config'),
  ('bbbb0001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.products WHERE sku='SKU-A1004' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'v1.0','active','Servo Motor sub-assembly')
ON CONFLICT DO NOTHING;

-- ============================================================
-- BOM ITEMS
-- ============================================================
INSERT INTO public.bom_items (id, company_id, bom_id, product_id, quantity, unit_cost) VALUES
  ('cccc0001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
    'bbbb0001-0000-0000-0000-000000000001',
    (SELECT id FROM public.products WHERE sku='SKU-A1003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    4, 6.20),
  ('cccc0001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
    'bbbb0001-0000-0000-0000-000000000001',
    (SELECT id FROM public.products WHERE sku='SKU-A1005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    1, 88.00),
  ('cccc0001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',
    'bbbb0001-0000-0000-0000-000000000002',
    (SELECT id FROM public.products WHERE sku='SKU-A1003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    2, 6.20),
  ('cccc0001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',
    'bbbb0001-0000-0000-0000-000000000003',
    (SELECT id FROM public.products WHERE sku='SKU-A1005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    2, 88.00),
  ('cccc0001-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',
    'bbbb0001-0000-0000-0000-000000000003',
    (SELECT id FROM public.products WHERE sku='SKU-A1003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    6, 6.20)
ON CONFLICT DO NOTHING;

-- ============================================================
-- WORK ORDERS (tied to production orders for 3 customers)
-- ============================================================
INSERT INTO public.work_orders (id, company_id, production_order_id, wo_number, operation, quantity, status, start_time, end_time, machine_id) VALUES
  -- AeroSpace orders (completed)
  ('dddd0001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-001' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'WO-2026-001-A','CNC Machining',250,'completed', now()-interval '14 days', now()-interval '10 days',
    (SELECT id FROM public.machines WHERE code='MC-A1' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1)),
  ('dddd0001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-001' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'WO-2026-001-B','Quality Inspection',250,'completed', now()-interval '10 days', now()-interval '8 days',
    NULL),
  ('dddd0001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-002' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'WO-2026-002-A','Turning',100,'completed', now()-interval '9 days', now()-interval '5 days',
    (SELECT id FROM public.machines WHERE code='MC-B2' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1)),
  -- VoltDrive orders (completed)
  ('dddd0001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'WO-2026-003-A','Injection Molding',500,'completed', now()-interval '19 days', now()-interval '12 days',
    (SELECT id FROM public.machines WHERE code='MC-I3' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1)),
  ('dddd0001-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-004' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'WO-2026-004-A','Laser Cutting',200,'completed', now()-interval '11 days', now()-interval '5 days',
    (SELECT id FROM public.machines WHERE code='MC-L9' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1)),
  -- MediCore orders (in progress)
  ('dddd0001-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'WO-2026-005-A','Precision Assembly',150,'in_progress', now()-interval '2 days', NULL,
    (SELECT id FROM public.machines WHERE code='MC-R7' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1)),
  ('dddd0001-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-006' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'WO-2026-006-A','CNC Machining',300,'pending', NULL, NULL,
    (SELECT id FROM public.machines WHERE code='MC-A1' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1))
ON CONFLICT DO NOTHING;

-- ============================================================
-- SALES ORDERS (tied to 3 customers)
-- ============================================================
INSERT INTO public.sales_orders (id, company_id, so_number, customer_id, status, priority, total_amount, order_date, due_date, progress) VALUES
  -- AeroSpace: 2 completed orders
  ('eeeee001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','SO-2026-001',
    (SELECT id FROM public.customers WHERE name='AeroSpace Dynamics' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'completed','high',42500.00, now()-interval '15 days', now()-interval '5 days', 100),
  ('eeeee001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','SO-2026-002',
    (SELECT id FROM public.customers WHERE name='AeroSpace Dynamics' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'completed','normal',18750.00, now()-interval '10 days', now()-interval '3 days', 100),
  -- VoltDrive: 2 completed orders
  ('eeeee001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','SO-2026-003',
    (SELECT id FROM public.customers WHERE name='VoltDrive Electric' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'completed','critical',63200.00, now()-interval '20 days', now()-interval '2 days', 100),
  ('eeeee001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','SO-2026-004',
    (SELECT id FROM public.customers WHERE name='VoltDrive Electric' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'completed','normal',21000.00, now()-interval '12 days', now()-interval '1 day', 100),
  -- MediCore: 1 in-progress, 1 planned
  ('eeeee001-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','SO-2026-005',
    (SELECT id FROM public.customers WHERE name='MediCore HealthTech' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'in_progress','critical',35400.00, now()-interval '3 days', now()+interval '7 days', 45),
  ('eeeee001-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','SO-2026-006',
    (SELECT id FROM public.customers WHERE name='MediCore HealthTech' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'planned','high',52800.00, now(), now()+interval '14 days', 0)
ON CONFLICT DO NOTHING;

-- ============================================================
-- SALES ORDER ITEMS
-- ============================================================
INSERT INTO public.sales_order_items (id, company_id, sales_order_id, product_id, quantity, unit_price, total) VALUES
  -- SO-2026-001: AeroSpace — Titanium Brackets
  ('fffff001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111',
    'eeeee001-0000-0000-0000-000000000001',
    (SELECT id FROM public.products WHERE sku='SKU-A1001' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    250, 89.00, 22250.00),
  ('fffff001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111',
    'eeeee001-0000-0000-0000-000000000001',
    (SELECT id FROM public.products WHERE sku='SKU-A1003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    500, 15.50, 7750.00),
  -- SO-2026-002: AeroSpace — Servo Motors
  ('fffff001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111',
    'eeeee001-0000-0000-0000-000000000002',
    (SELECT id FROM public.products WHERE sku='SKU-A1004' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    100, 187.50, 18750.00),
  -- SO-2026-003: VoltDrive — Aluminum Housings
  ('fffff001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111',
    'eeeee001-0000-0000-0000-000000000003',
    (SELECT id FROM public.products WHERE sku='SKU-A1002' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    500, 84.40, 42200.00),
  ('fffff001-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111',
    'eeeee001-0000-0000-0000-000000000003',
    (SELECT id FROM public.products WHERE sku='SKU-A1005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    150, 140.00, 21000.00),
  -- SO-2026-004: VoltDrive — Control Boards
  ('fffff001-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111',
    'eeeee001-0000-0000-0000-000000000004',
    (SELECT id FROM public.products WHERE sku='SKU-A1005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    200, 105.00, 21000.00),
  -- SO-2026-005: MediCore — Precision Bearings
  ('fffff001-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111',
    'eeeee001-0000-0000-0000-000000000005',
    (SELECT id FROM public.products WHERE sku='SKU-A1003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    150, 236.00, 35400.00),
  -- SO-2026-006: MediCore — Full Assembly
  ('fffff001-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111',
    'eeeee001-0000-0000-0000-000000000006',
    (SELECT id FROM public.products WHERE sku='SKU-A1001' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    300, 176.00, 52800.00)
ON CONFLICT DO NOTHING;

-- ============================================================
-- INVOICES (tied to 3 customer orders)
-- ============================================================
INSERT INTO public.invoices (id, company_id, invoice_number, customer_id, sales_order_id, total_amount, tax_amount, status, issue_date, due_date, paid_date) VALUES
  -- Completed customer orders get paid invoices
  ('11111a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','INV-2026-001',
    (SELECT id FROM public.customers WHERE name='AeroSpace Dynamics' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'eeeee001-0000-0000-0000-000000000001',42500.00,3400.00,'paid', now()-interval '5 days', now()+interval '25 days', now()-interval '2 days'),
  ('11111a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','INV-2026-002',
    (SELECT id FROM public.customers WHERE name='AeroSpace Dynamics' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'eeeee001-0000-0000-0000-000000000002',18750.00,1500.00,'paid', now()-interval '3 days', now()+interval '27 days', now()-interval '1 day'),
  ('11111a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','INV-2026-003',
    (SELECT id FROM public.customers WHERE name='VoltDrive Electric' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'eeeee001-0000-0000-0000-000000000003',63200.00,5056.00,'paid', now()-interval '2 days', now()+interval '28 days', now()),
  ('11111a01-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','INV-2026-004',
    (SELECT id FROM public.customers WHERE name='VoltDrive Electric' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'eeeee001-0000-0000-0000-000000000004',21000.00,1680.00,'sent', now()-interval '1 day', now()+interval '29 days', NULL),
  -- MediCore: in-progress gets pending invoice
  ('11111a01-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','INV-2026-005',
    (SELECT id FROM public.customers WHERE name='MediCore HealthTech' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'eeeee001-0000-0000-0000-000000000005',35400.00,2832.00,'draft', now(), now()+interval '30 days', NULL),
  -- MediCore: planned gets draft invoice
  ('11111a01-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','INV-2026-006',
    (SELECT id FROM public.customers WHERE name='MediCore HealthTech' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'eeeee001-0000-0000-0000-000000000006',52800.00,4224.00,'draft', now(), now()+interval '45 days', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- PAYMENTS (tied to paid invoices)
-- ============================================================
INSERT INTO public.payments (id, company_id, payment_number, invoice_id, amount, method, reference, status, paid_at) VALUES
  ('22222a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','PAY-2026-001',
    '11111a01-0000-0000-0000-000000000001',45900.00,'bank_transfer','TXN-AERO-2026-001','completed', now()-interval '2 days'),
  ('22222a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','PAY-2026-002',
    '11111a01-0000-0000-0000-000000000002',20250.00,'bank_transfer','TXN-AERO-2026-002','completed', now()-interval '1 day'),
  ('22222a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','PAY-2026-003',
    '11111a01-0000-0000-0000-000000000003',68256.00,'wire','TXN-VOLT-2026-001','completed', now())
ON CONFLICT DO NOTHING;

-- ============================================================
-- SHIPMENTS (tied to 3 customer orders)
-- ============================================================
INSERT INTO public.shipments (id, company_id, shipment_number, sales_order_id, carrier, tracking_number, destination, status, shipped_date, delivered_date) VALUES
  -- Completed orders — delivered
  ('33333a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','SHP-2026-001',
    'eeeee001-0000-0000-0000-000000000001','FedEx','7749102836451','Detroit, MI → Chicago, IL','delivered', now()-interval '6 days', now()-interval '4 days'),
  ('33333a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','SHP-2026-002',
    'eeeee001-0000-0000-0000-000000000002','UPS','1Z999AA10123456784','Detroit, MI → Houston, TX','delivered', now()-interval '4 days', now()-interval '3 days'),
  ('33333a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','SHP-2026-003',
    'eeeee001-0000-0000-0000-000000000003','DHL','1234567890','Detroit, MI → Phoenix, AZ','delivered', now()-interval '3 days', now()-interval '1 day'),
  ('33333a01-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','SHP-2026-004',
    'eeeee001-0000-0000-0000-000000000004','FedEx','7749102899999','Detroit, MI → Seattle, WA','in_transit', now()-interval '1 day', NULL),
  -- MediCore: in-progress — pending shipment
  ('33333a01-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','SHP-2026-005',
    'eeeee001-0000-0000-0000-000000000005','UPS','PENDING','Detroit, MI → San Jose, CA','pending', NULL, NULL),
  -- MediCore: planned — not yet shipped
  ('33333a01-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','SHP-2026-006',
    'eeeee001-0000-0000-0000-000000000006','TBD','N/A','Detroit, MI → Austin, TX','pending', NULL, NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- QUALITY INSPECTIONS (tied to 3 customer production orders)
-- ============================================================
INSERT INTO public.quality_inspections (id, company_id, inspection_number, production_order_id, inspection_type, result, defects_found, quantity_checked, inspector, created_at) VALUES
  -- AeroSpace orders: incoming + final inspections (passed)
  ('44444a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','QI-2026-001',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-001' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'incoming','pass',0,250,'Lisa Wang', now()-interval '14 days'),
  ('44444a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','QI-2026-002',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-001' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'final','pass',2,250,'Lisa Wang', now()-interval '8 days'),
  ('44444a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','QI-2026-003',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-002' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'final','pass',0,100,'Lisa Wang', now()-interval '5 days'),
  -- VoltDrive: in-process + final (passed)
  ('44444a01-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','QI-2026-004',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'in_process','pass',1,250,'Lisa Wang', now()-interval '15 days'),
  ('44444a01-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','QI-2026-005',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'final','pass',3,500,'Lisa Wang', now()-interval '11 days'),
  ('44444a01-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','QI-2026-006',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-004' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'final','pass',0,200,'Lisa Wang', now()-interval '4 days'),
  -- MediCore: incoming inspection (in-progress)
  ('44444a01-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','QI-2026-007',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'incoming','pass',0,150,'Lisa Wang', now()-interval '3 days'),
  ('44444a01-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','QI-2026-008',
    (SELECT id FROM public.production_orders WHERE order_number='SO-2026-005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'in_process','fail',8,75,'Lisa Wang', now()-interval '1 day')
ON CONFLICT DO NOTHING;

-- ============================================================
-- INVENTORY (stock levels for all products in both warehouses)
-- ============================================================
-- Main Warehouse stock
INSERT INTO public.inventory (company_id, warehouse_id, product_id, quantity) VALUES
  ('11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.warehouses WHERE code='WH-MAIN' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    (SELECT id FROM public.products WHERE sku='SKU-A1001' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    420),
  ('11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.warehouses WHERE code='WH-MAIN' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    (SELECT id FROM public.products WHERE sku='SKU-A1002' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    1850),
  ('11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.warehouses WHERE code='WH-MAIN' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    (SELECT id FROM public.products WHERE sku='SKU-A1003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    3200),
  ('11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.warehouses WHERE code='WH-MAIN' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    (SELECT id FROM public.products WHERE sku='SKU-A1004' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    85),
  ('11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.warehouses WHERE code='WH-MAIN' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    (SELECT id FROM public.products WHERE sku='SKU-A1005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    310)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();

-- Raw Materials Warehouse stock
INSERT INTO public.inventory (company_id, warehouse_id, product_id, quantity) VALUES
  ('11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.warehouses WHERE code='WH-RAW' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    (SELECT id FROM public.products WHERE sku='SKU-A1003' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    5500),
  ('11111111-1111-1111-1111-111111111111',
    (SELECT id FROM public.warehouses WHERE code='WH-RAW' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    (SELECT id FROM public.products WHERE sku='SKU-A1005' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    200)
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();

-- ============================================================
-- ATTENDANCE (last 5 days for all employees)
-- ============================================================
INSERT INTO public.attendance (company_id, employee_id, date, check_in, check_out, hours_worked, status) VALUES
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000001', current_date - 4, (current_date - 4 + time '07:55'), (current_date - 4 + time '16:05'), 8.17, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000002', current_date - 4, (current_date - 4 + time '07:30'), (current_date - 4 + time '16:30'), 9.0, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000003', current_date - 4, (current_date - 4 + time '08:00'), (current_date - 4 + time '17:00'), 9.0, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000004', current_date - 4, (current_date - 4 + time '07:45'), (current_date - 4 + time '15:45'), 8.0, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000005', current_date - 4, (current_date - 4 + time '07:00'), (current_date - 4 + time '15:30'), 8.5, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000006', current_date - 4, (current_date - 4 + time '08:30'), (current_date - 4 + time '17:30'), 9.0, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000007', current_date - 4, (current_date - 4 + time '08:00'), (current_date - 4 + time '17:00'), 9.0, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000008', current_date - 4, (current_date - 4 + time '06:00'), (current_date - 4 + time '14:00'), 8.0, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000009', current_date - 4, (current_date - 4 + time '08:15'), (current_date - 4 + time '17:15'), 9.0, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000010', current_date - 4, (current_date - 4 + time '06:00'), (current_date - 4 + time '14:30'), 8.5, 'present'),
  -- Yesterday
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000001', current_date - 3, (current_date - 3 + time '07:58'), (current_date - 3 + time '16:10'), 8.2, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000002', current_date - 3, (current_date - 3 + time '07:25'), (current_date - 3 + time '16:45'), 9.33, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000003', current_date - 3, (current_date - 3 + time '08:05'), (current_date - 3 + time '17:05'), 9.0, 'present'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000008', current_date - 3, NULL, NULL, 0, 'absent'),
  ('11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000010', current_date - 3, (current_date - 3 + time '06:05'), (current_date - 3 + time '14:15'), 8.17, 'present')
ON CONFLICT DO NOTHING;

-- ============================================================
-- PAYROLL (current period for all employees)
-- ============================================================
INSERT INTO public.payroll (id, company_id, employee_id, period, base_salary, overtime_hours, overtime_rate, deductions, net_amount, status, paid_at) VALUES
  ('55555a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000001','2026-07',8500.00,8,45,1275.00,7715.00,'paid', now()-interval '1 day'),
  ('55555a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000002','2026-07',7800.00,12,42,1170.00,7134.00,'paid', now()-interval '1 day'),
  ('55555a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000003','2026-07',6500.00,4,38,975.00,5679.00,'paid', now()-interval '1 day'),
  ('55555a01-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000004','2026-07',7200.00,6,40,1080.00,6360.00,'paid', now()-interval '1 day'),
  ('55555a01-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000005','2026-07',6200.00,2,35,930.00,5340.00,'paid', now()-interval '1 day'),
  ('55555a01-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000006','2026-07',8000.00,0,0,1200.00,6800.00,'pending', NULL),
  ('55555a01-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000007','2026-07',7500.00,2,40,1125.00,6495.00,'paid', now()-interval '1 day'),
  ('55555a01-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000008','2026-07',5200.00,10,30,780.00,4720.00,'pending', NULL),
  ('55555a01-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000009','2026-07',6000.00,4,38,900.00,5352.00,'pending', NULL),
  ('55555a01-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','aaaa0001-0000-0000-0000-000000000010','2026-07',4800.00,14,28,720.00,4564.00,'pending', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- TASKS (tied to 3 customer orders)
-- ============================================================
INSERT INTO public.tasks (id, company_id, title, status, priority, due_date, entity) VALUES
  ('66666a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','Prepare AeroSpace SO-2026-001 shipment docs','completed','high', now()-interval '7 days','dispatch'),
  ('66666a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Verify VoltDrive SO-2026-003 quality report','completed','medium', now()-interval '4 days','quality'),
  ('66666a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Schedule MediCore SO-2026-005 assembly run','in_progress','critical', now()+interval '2 days','production'),
  ('66666a01-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Order materials for MediCore SO-2026-006','todo','high', now()+interval '5 days','procurement'),
  ('66666a01-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','Robotic Assembly R-7 maintenance check','in_progress','medium', now()+interval '1 day','maintenance'),
  ('66666a01-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Update CNC Mill Alpha-1 tool offsets','todo','low', now()+interval '3 days','maintenance'),
  ('66666a01-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Weekly cycle count for WH-MAIN','todo','medium', now()+interval '7 days','warehouse'),
  ('66666a01-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Process pending invoices for VoltDrive','in_progress','high', now(), 'finance')
ON CONFLICT DO NOTHING;

-- ============================================================
-- DOCUMENTS
-- ============================================================
INSERT INTO public.documents (id, company_id, title, category, file_type, version, status) VALUES
  ('77777a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','ISO 9001:2015 Quality Manual','compliance','pdf','v4.2','published'),
  ('77777a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','CNC Mill Operating Procedure','maintenance','pdf','v2.1','published'),
  ('77777a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','AeroSpace Dynamics Master Agreement','contracts','pdf','v1.0','published'),
  ('77777a01-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','VoltDrive Electric Supply Contract','contracts','pdf','v2.0','published'),
  ('77777a01-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','MediCore HealthTech Purchase Terms','contracts','pdf','v1.1','published'),
  ('77777a01-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Material Safety Data Sheet — Titanium Alloy','safety','pdf','v3.0','published'),
  ('77777a01-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Q3 2026 Financial Summary','finance','xlsx','v1.0','draft'),
  ('77777a01-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Employee Handbook 2026','hr','pdf','v2.0','published'),
  ('77777a01-0000-0000-0000-000000000009','11111111-1111-1111-1111-111111111111','Production Line Setup Guide','engineering','pdf','v1.3','published'),
  ('77777a01-0000-0000-0000-000000000010','11111111-1111-1111-1111-111111111111','Machine Maintenance Checklist','maintenance','pdf','v1.5','published')
ON CONFLICT DO NOTHING;

-- ============================================================
-- KNOWLEDGE ARTICLES
-- ============================================================
INSERT INTO public.knowledge_articles (id, company_id, title, category, content, views, status) VALUES
  ('88888a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','CNC Mill Alpha-1 Setup Guide','machines','Complete setup guide for 5-axis CNC Mill Alpha-1 including tool calibration, work coordinate setup, and first-article inspection procedures.',156,'published'),
  ('88888a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','Titanium Bracket TB-500 Assembly','products','Step-by-step assembly procedure for TB-500 titanium bracket including torque specs and quality checkpoints.',89,'published'),
  ('88888a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','Quality Inspection Standard — Aerospace','quality','Incoming and final inspection standards for aerospace-grade components per AS9100D requirements.',234,'published'),
  ('88888a01-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','Preventive Maintenance Schedule','maintenance','Monthly and quarterly PM schedules for all machines in Detroit Assembly Plant.',312,'published'),
  ('88888a01-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','New Employee Onboarding','hr','Complete onboarding checklist and training modules for new hires.',67,'published'),
  ('88888a01-0000-0000-0000-000000000006','11111111-1111-1111-1111-111111111111','Warehouse Safety Procedures','safety','Safety protocols for warehouse operations including forklift operation and material handling.',198,'published'),
  ('88888a01-0000-0000-0000-000000000007','11111111-1111-1111-1111-111111111111','Supplier Evaluation Criteria','procurement','Standard criteria and scoring methodology for supplier qualification and performance reviews.',45,'published'),
  ('88888a01-0000-0000-0000-000000000008','11111111-1111-1111-1111-111111111111','Emergency Shutdown Procedures','safety','Step-by-step emergency shutdown protocols for all production lines and machinery.',278,'published')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SUPPORT TICKETS (tied to 3 customers)
-- ============================================================
INSERT INTO public.support_tickets (id, company_id, ticket_number, subject, customer_id, status, priority, created_at, resolved_at) VALUES
  ('99999a01-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','TKT-2026-001',
    'AeroSpace — Dimensional tolerance inquiry on TB-500 batch',
    (SELECT id FROM public.customers WHERE name='AeroSpace Dynamics' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'resolved','medium', now()-interval '10 days', now()-interval '8 days'),
  ('99999a01-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','TKT-2026-002',
    'VoltDrive — Request for updated material certificates',
    (SELECT id FROM public.customers WHERE name='VoltDrive Electric' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'resolved','low', now()-interval '5 days', now()-interval '3 days'),
  ('99999a01-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','TKT-2026-003',
    'MediCore — In-process defect investigation for SO-2026-005',
    (SELECT id FROM public.customers WHERE name='MediCore HealthTech' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'open','critical', now()-interval '1 day', NULL),
  ('99999a01-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','TKT-2026-004',
    'MediCore — Updated shipping timeline for SO-2026-006',
    (SELECT id FROM public.customers WHERE name='MediCore HealthTech' AND company_id='11111111-1111-1111-1111-111111111111' LIMIT 1),
    'open','high', now(), NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- APPROVALS (purchase requests, budgets)
-- ============================================================
INSERT INTO public.approvals (id, company_id, entity, entity_id, status, notes, created_at, resolved_at) VALUES
  ('aaaaa001-0000-0000-0000-000000000001','11111111-1111-1111-1111-111111111111','purchase_requests', NULL, 'approved', 'PUR-2026-0105 for MediCore materials — approved by procurement', now()-interval '3 days', now()-interval '2 days'),
  ('aaaaa001-0000-0000-0000-000000000002','11111111-1111-1111-1111-111111111111','purchase_requests', NULL, 'pending', 'PUR-2026-0106 for $12,800 — awaiting finance approval', now(), NULL),
  ('aaaaa001-0000-0000-0000-000000000003','11111111-1111-1111-1111-111111111111','budgets', NULL, 'approved', 'Q3 maintenance budget — $45,000 approved', now()-interval '7 days', now()-interval '5 days'),
  ('aaaaa001-0000-0000-0000-000000000004','11111111-1111-1111-1111-111111111111','budgets', NULL, 'pending', 'Q3 training budget — $12,000 pending HR approval', now()-interval '2 days', NULL),
  ('aaaaa001-0000-0000-0000-000000000005','11111111-1111-1111-1111-111111111111','capa', NULL, 'in_progress', 'CAPA-2026-001: Ti Bracket dimensional drift — root cause tool wear', now()-interval '5 days', NULL)
ON CONFLICT DO NOTHING;

-- ============================================================
-- MORE AUDIT LOGS (comprehensive activity trail)
-- ============================================================
INSERT INTO public.audit_logs (company_id, action, entity, metadata) VALUES
  ('11111111-1111-1111-1111-111111111111','production_completed','production_orders','{"order":"SO-2026-001","customer":"AeroSpace Dynamics","units":250}'),
  ('11111111-1111-1111-1111-111111111111','production_completed','production_orders','{"order":"SO-2026-002","customer":"AeroSpace Dynamics","units":100}'),
  ('11111111-1111-1111-1111-111111111111','production_completed','production_orders','{"order":"SO-2026-003","customer":"VoltDrive Electric","units":500}'),
  ('11111111-1111-1111-1111-111111111111','production_completed','production_orders','{"order":"SO-2026-004","customer":"VoltDrive Electric","units":200}'),
  ('11111111-1111-1111-1111-111111111111','production_in_progress','production_orders','{"order":"SO-2026-005","customer":"MediCore HealthTech","progress":45}'),
  ('11111111-1111-1111-1111-111111111111','quality_inspection','quality_inspections','{"inspection":"QI-2026-008","result":"fail","defects":8,"customer":"MediCore"}'),
  ('11111111-1111-1111-1111-111111111111','shipment_delivered','shipments','{"shipment":"SHP-2026-001","customer":"AeroSpace Dynamics","carrier":"FedEx"}'),
  ('11111111-1111-1111-1111-111111111111','shipment_delivered','shipments','{"shipment":"SHP-2026-003","customer":"VoltDrive Electric","carrier":"DHL"}'),
  ('11111111-1111-1111-1111-111111111111','payment_received','payments','{"payment":"PAY-2026-001","amount":45900,"customer":"AeroSpace Dynamics"}'),
  ('11111111-1111-1111-1111-111111111111','payment_received','payments','{"payment":"PAY-2026-003","amount":68256,"customer":"VoltDrive Electric"}'),
  ('11111111-1111-1111-1111-111111111111','invoice_created','invoices','{"invoice":"INV-2026-005","customer":"MediCore HealthTech","amount":35400}'),
  ('11111111-1111-1111-1111-111111111111','invoice_created','invoices','{"invoice":"INV-2026-006","customer":"MediCore HealthTech","amount":52800}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- NOTIFICATIONS (comprehensive)
-- ============================================================
INSERT INTO public.notifications (company_id, title, body, severity) VALUES
  ('11111111-1111-1111-1111-111111111111','Production Completed','SO-2026-001 for AeroSpace Dynamics completed — 250 units of TB-500','success'),
  ('11111111-1111-1111-1111-111111111111','Production Completed','SO-2026-003 for VoltDrive Electric completed — 500 units of AH-220','success'),
  ('11111111-1111-1111-1111-111111111111','Production In Progress','SO-2026-005 for MediCore HealthTech at 45% — assembly in progress','info'),
  ('11111111-1111-1111-1111-111111111111','Quality Alert','QI-2026-008 for MediCore SO-2026-005 FAILED — 8 defects found in-process','warning'),
  ('11111111-1111-1111-1111-111111111111','Payment Received','PAY-2026-001 $45,900 from AeroSpace Dynamics','success'),
  ('11111111-1111-1111-1111-111111111111','Payment Received','PAY-2026-003 $68,256 from VoltDrive Electric','success'),
  ('11111111-1111-1111-1111-111111111111','Shipment Delivered','SHP-2026-001 delivered to Chicago, IL via FedEx','success'),
  ('11111111-1111-1111-1111-111111111111','Shipment In Transit','SHP-2026-004 to Seattle, WA via FedEx — estimated 2 days','info'),
  ('11111111-1111-1111-1111-111111111111','PO Pending Approval','PUR-2026-0106 for $12,800 needs finance approval','warning'),
  ('11111111-1111-1111-1111-111111111111','Machine Alert','Robotic Assembly R-7 still in maintenance — check ETA','warning'),
  ('11111111-1111-1111-1111-111111111111','Invoice Drafted','INV-2026-005 for MediCore HealthTech $35,400 ready for review','info'),
  ('11111111-1111-1111-1111-111111111111','Attendance Alert','David Park absent yesterday — follow up with HR','warning'),
  ('11111111-1111-1111-1111-111111111111','Payroll Pending','3 employees pending payroll processing for July 2026','info'),
  ('11111111-1111-1111-1111-111111111111','Support Ticket Open','TKT-2026-003 from MediCore — critical defect investigation','warning'),
  ('11111111-1111-1111-1111-111111111111','CAPA Active','CAPA-2026-001 for Ti Bracket dimensional drift — root cause identified','info')
ON CONFLICT DO NOTHING;

-- ============================================================
-- SALES_ORDER_ITEMS FK FIX (some tables may not have this FK)
-- ============================================================

EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Some demo data skipped: %', SQLERRM;
END $$;
