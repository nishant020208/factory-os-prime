-- =============================================================
-- FACTORYOS AI — COMPREHENSIVE DEMO DATA MIGRATION
-- Company: ABC Manufacturing Pvt Ltd (company_id: 11111111-...)
-- 3 Demo Customers with full lifecycle
-- =============================================================

-- Company & Plant already seeded in initial migration.
-- We add departments, inventory, employee data, and full customer lifecycle.

-- ========================= DEPARTMENTS =========================
INSERT INTO public.departments (company_id, plant_id, name, code) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Production','DEPT-PROD'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Quality Control','DEPT-QC'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Maintenance','DEPT-MAINT'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Warehouse','DEPT-WH'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Procurement','DEPT-PROC'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Finance','DEPT-FIN'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','HR','DEPT-HR'),
('11111111-1111-1111-1111-111111111111',NULL,'Sales','DEPT-SALES'),
('11111111-1111-1111-1111-111111111111',NULL,'Engineering','DEPT-ENG');

-- ========================= INVENTORY =========================
-- Populate inventory with realistic stock levels
INSERT INTO public.inventory (company_id, warehouse_id, product_id, quantity)
SELECT '11111111-1111-1111-1111-111111111111', w.id, p.id,
  CASE p.sku
    WHEN 'SKU-A1001' THEN 850
    WHEN 'SKU-A1002' THEN 2200
    WHEN 'SKU-A1003' THEN 900  -- below reorder
    WHEN 'SKU-A1004' THEN 65
    WHEN 'SKU-A1005' THEN 340
  END
FROM public.warehouses w, public.products p
WHERE w.company_id = '11111111-1111-1111-1111-111111111111'
  AND p.company_id = '11111111-1111-1111-1111-111111111111'
  AND w.code = 'WH-MAIN';

-- ========================= 3 DEMO CUSTOMERS WITH FULL LIFECYCLE =========================

-- Clear old customers and re-create with full demo data
DELETE FROM public.customers WHERE company_id = '11111111-1111-1111-1111-111111111111';

-- Customer 1: Aeronova Systems (COMPLETED ORDER)
INSERT INTO public.customers (id, company_id, name, contact_email, contact_phone, segment, status)
VALUES (
  'c0000001-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  'Aeronova Systems',
  'procurement@aeronova.com',
  '+1-313-555-0101',
  'Aerospace',
  'active'
);

-- Customer 2: Volt Motors Inc (COMPLETED ORDER)
INSERT INTO public.customers (id, company_id, name, contact_email, contact_phone, segment, status)
VALUES (
  'c0000002-0000-0000-0000-000000000002',
  '11111111-1111-1111-1111-111111111111',
  'Volt Motors Inc.',
  'supply@voltmotors.com',
  '+1-734-555-0202',
  'Automotive',
  'active'
);

-- Customer 3: MediTek Devices (IN PROGRESS ORDER)
INSERT INTO public.customers (id, company_id, name, contact_email, contact_phone, segment, status)
VALUES (
  'c0000003-0000-0000-0000-000000000003',
  '11111111-1111-1111-1111-111111111111',
  'MediTek Devices',
  'buyers@meditek.com',
  '+1-248-555-0303',
  'Medical',
  'active'
);

-- ========================= PRODUCTION ORDERS (Customer-linked) =========================
DELETE FROM public.production_orders WHERE company_id = '11111111-1111-1111-1111-111111111111';

-- Customer 1: Aeronova - COMPLETED
INSERT INTO public.production_orders (company_id, plant_id, order_number, product_id, quantity, status, priority, progress, start_date, due_date, created_at) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PROD-2026-0001',
  (SELECT id FROM products WHERE sku='SKU-A1001' AND company_id='11111111-1111-1111-1111-111111111111'),
  200, 'completed', 'high', 100, now()-interval '30 days', now()-interval '10 days', now()-interval '30 days'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PROD-2026-0002',
  (SELECT id FROM products WHERE sku='SKU-A1004' AND company_id='11111111-1111-1111-1111-111111111111'),
  50, 'completed', 'high', 100, now()-interval '28 days', now()-interval '8 days', now()-interval '28 days');

-- Customer 2: Volt Motors - COMPLETED
INSERT INTO public.production_orders (company_id, plant_id, order_number, product_id, quantity, status, priority, progress, start_date, due_date, created_at) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PROD-2026-0003',
  (SELECT id FROM products WHERE sku='SKU-A1002' AND company_id='11111111-1111-1111-1111-111111111111'),
  1500, 'completed', 'medium', 100, now()-interval '25 days', now()-interval '5 days', now()-interval '25 days'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PROD-2026-0004',
  (SELECT id FROM products WHERE sku='SKU-A1003' AND company_id='11111111-1111-1111-1111-111111111111'),
  3000, 'completed', 'medium', 100, now()-interval '22 days', now()-interval '3 days', now()-interval '22 days');

-- Customer 3: MediTek - IN PROGRESS
INSERT INTO public.production_orders (company_id, plant_id, order_number, product_id, quantity, status, priority, progress, start_date, due_date, created_at) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PROD-2026-0005',
  (SELECT id FROM products WHERE sku='SKU-A1005' AND company_id='11111111-1111-1111-1111-111111111111'),
  400, 'in_progress', 'critical', 45, now()-interval '5 days', now()+interval '10 days', now()-interval '5 days'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PROD-2026-0006',
  (SELECT id FROM products WHERE sku='SKU-A1001' AND company_id='11111111-1111-1111-1111-111111111111'),
  100, 'in_progress', 'high', 20, now()-interval '3 days', now()+interval '12 days', now()-interval '3 days');

-- ========================= PURCHASE ORDERS =========================
DELETE FROM public.purchase_orders WHERE company_id = '11111111-1111-1111-1111-111111111111';

INSERT INTO public.purchase_orders (company_id, po_number, supplier_id, status, total_amount, expected_date, created_at) VALUES
-- Materials for Customer 1 (Aeronova) - RECEIVED
('11111111-1111-1111-1111-111111111111','PUR-2026-0001',
  (SELECT id FROM suppliers WHERE name='Kyoto Precision Ltd' AND company_id='11111111-1111-1111-1111-111111111111'),
  'received', 48250.00, now()-interval '15 days', now()-interval '35 days'),
('11111111-1111-1111-1111-111111111111','PUR-2026-0002',
  (SELECT id FROM suppliers WHERE name='Nordic Steel AB' AND company_id='11111111-1111-1111-1111-111111111111'),
  'received', 32100.00, now()-interval '12 days', now()-interval '32 days'),
-- Materials for Customer 2 (Volt) - RECEIVED
('11111111-1111-1111-1111-111111111111','PUR-2026-0003',
  (SELECT id FROM suppliers WHERE name='Bavarian Alloys GmbH' AND company_id='11111111-1111-1111-1111-111111111111'),
  'received', 67800.00, now()-interval '8 days', now()-interval '28 days'),
-- Materials for Customer 3 (MediTek) - APPROVED / PENDING
('11111111-1111-1111-1111-111111111111','PUR-2026-0004',
  (SELECT id FROM suppliers WHERE name='Kyoto Precision Ltd' AND company_id='11111111-1111-1111-1111-111111111111'),
  'approved', 29400.00, now()+interval '5 days', now()-interval '3 days'),
('11111111-1111-1111-1111-111111111111','PUR-2026-0005',
  (SELECT id FROM suppliers WHERE name='Nordic Steel AB' AND company_id='11111111-1111-1111-1111-111111111111'),
  'pending', 15600.00, now()+interval '10 days', now()-interval '1 day');

-- ========================= AUDIT LOGS =========================
INSERT INTO public.audit_logs (company_id, action, entity, entity_id, metadata, created_at) VALUES
('11111111-1111-1111-1111-111111111111','production_completed','production_orders', NULL,
  '{"order_number":"PROD-2026-0001","customer":"Aeronova Systems","product":"Titanium Bracket TB-500","qty":200}',
  now()-interval '10 days'),
('11111111-1111-1111-1111-111111111111','production_completed','production_orders', NULL,
  '{"order_number":"PROD-2026-0003","customer":"Volt Motors Inc.","product":"Aluminum Housing AH-220","qty":1500}',
  now()-interval '5 days'),
('11111111-1111-1111-1111-111111111111','po_received','purchase_orders', NULL,
  '{"po_number":"PUR-2026-0001","supplier":"Kyoto Precision Ltd","amount":48250}',
  now()-interval '15 days'),
('11111111-1111-1111-1111-111111111111','low_inventory','inventory', NULL,
  '{"sku":"SKU-A1003","qty":900,"reorder_level":1200}',
  now()-interval '2 days'),
('11111111-1111-1111-1111-111111111111','machine_status_change','machines', NULL,
  '{"name":"Robotic Assembly R-7","status":"maintenance"}',
  now()-interval '4 days'),
('11111111-1111-1111-1111-111111111111','company_settings_changed','companies', NULL,
  '{"field":"currency","value":"USD"}',
  now()-interval '60 days');

-- ========================= NOTIFICATIONS =========================
INSERT INTO public.notifications (company_id, title, body, severity, created_at) VALUES
('11111111-1111-1111-1111-111111111111','Production completed','Order PROD-2026-0001 completed — 200x Titanium Bracket TB-500 for Aeronova Systems','success', now()-interval '10 days'),
('11111111-1111-1111-1111-111111111111','Production completed','Order PROD-2026-0003 completed — 1500x Aluminum Housing AH-220 for Volt Motors Inc.','success', now()-interval '5 days'),
('11111111-1111-1111-1111-111111111111','Low stock alert','SKU-A1003 (Precision Bearing PB-88) is below reorder level — 900 remaining vs 1200 threshold','warning', now()-interval '2 days'),
('11111111-1111-1111-1111-111111111111','Machine maintenance','Robotic Assembly R-7 scheduled for maintenance — 0% utilization','warning', now()-interval '4 days'),
('11111111-1111-1111-1111-111111111111','New production order','PROD-2026-0005 for MediTek Devices — 400x Control Board CB-X1 — CRITICAL priority','info', now()-interval '5 days'),
('11111111-1111-1111-1111-111111111111','Purchase order approved','PUR-2026-0004 approved — $29,400 from Kyoto Precision for MediTek materials','success', now()-interval '3 days');
