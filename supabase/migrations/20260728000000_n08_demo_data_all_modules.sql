-- =============================================================
-- FACTORYOS AI — N-08 COMPREHENSIVE DEMO DATA SEEDER
-- Seeds every table with N-08-prefixed sample data so no tab
-- appears empty when signing in as any role for the first time.
-- Uses ON CONFLICT DO NOTHING so it's safe to run multiple times.
-- Company: ABC Manufacturing (11111111-1111-1111-1111-111111111111)
-- =============================================================
-- This migration must run AFTER all previous migrations.
-- Migration order: 20260728000000

DO $$
DECLARE
  _company uuid := '11111111-1111-1111-1111-111111111111';
  _root_user uuid;
  _plant1 uuid;
  _plant2 uuid;
  _wh_main uuid;
  _wh_raw uuid;
  _wh_fg uuid;
  _dept_prod uuid;
  _dept_qual uuid;
  _dept_wh uuid;
  _dept_maint uuid;
  _dept_fin uuid;
  _dept_hr uuid;
  _dept_proc uuid;
  _prod_a1 uuid;
  _prod_b2 uuid;
  _prod_m3 uuid;
  _prod_a3 uuid;
  _prod_a4 uuid;
  _prod_a5 uuid;
  _prod_a6 uuid;
  _prod_r7 uuid;
  _prod_w8 uuid;
  _prod_l9 uuid;
  _prod_g10 uuid;
  _prod_d11 uuid;
  _mat_ss uuid;
  _mat_al uuid;
  _mat_ti uuid;
  _mat_br uuid;
  _mat_cs uuid;
  _mat_cu uuid;
  _mat_ny uuid;
  _mat_dl uuid;

BEGIN

-- =============================================================
-- ROOT SUPER ADMIN (check if exists, avoid duplicate insert)
-- =============================================================
SELECT id INTO _root_user FROM auth.users WHERE email = 'root@factoryos.demo' LIMIT 1;

-- =============================================================
-- PLANTS (N-08)
-- =============================================================
IF NOT EXISTS (SELECT 1 FROM public.plants WHERE company_id = _company AND code = 'N-08-PLT-001') THEN
    INSERT INTO public.plants (company_id, name, code, status)
    VALUES (_company, 'N-08 Detroit Assembly Plant', 'N-08-PLT-001', 'active');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.plants WHERE company_id = _company AND code = 'N-08-PLT-002') THEN
    INSERT INTO public.plants (company_id, name, code, status)
    VALUES (_company, 'N-08 Chicago Machining Center', 'N-08-PLT-002', 'active');
  END IF;

SELECT id INTO _plant1 FROM public.plants WHERE company_id = _company AND code = 'N-08-PLT-001' LIMIT 1;
SELECT id INTO _plant2 FROM public.plants WHERE company_id = _company AND code = 'N-08-PLT-002' LIMIT 1;

-- =============================================================
-- DEPARTMENTS (N-08)
-- =============================================================
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-PROD') THEN
    INSERT INTO public.departments (company_id, name, code, plant_id)
    VALUES (_company, 'N-08 Production', 'N-08-DEPT-PROD', _plant1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-QUAL') THEN
    INSERT INTO public.departments (company_id, name, code, plant_id)
    VALUES (_company, 'N-08 Quality', 'N-08-DEPT-QUAL', _plant1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-WH') THEN
    INSERT INTO public.departments (company_id, name, code, plant_id)
    VALUES (_company, 'N-08 Warehouse', 'N-08-DEPT-WH', _plant1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-MAINT') THEN
    INSERT INTO public.departments (company_id, name, code, plant_id)
    VALUES (_company, 'N-08 Maintenance', 'N-08-DEPT-MAINT', _plant1);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-FIN') THEN
    INSERT INTO public.departments (company_id, name, code)
    VALUES (_company, 'N-08 Finance', 'N-08-DEPT-FIN');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-HR') THEN
    INSERT INTO public.departments (company_id, name, code)
    VALUES (_company, 'N-08 HR', 'N-08-DEPT-HR');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-PROC') THEN
    INSERT INTO public.departments (company_id, name, code)
    VALUES (_company, 'N-08 Procurement', 'N-08-DEPT-PROC');
  END IF;

SELECT id INTO _dept_prod FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-PROD' LIMIT 1;
SELECT id INTO _dept_qual FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-QUAL' LIMIT 1;
SELECT id INTO _dept_wh FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-WH' LIMIT 1;
SELECT id INTO _dept_maint FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-MAINT' LIMIT 1;
SELECT id INTO _dept_fin FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-FIN' LIMIT 1;
SELECT id INTO _dept_hr FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-HR' LIMIT 1;
SELECT id INTO _dept_proc FROM public.departments WHERE company_id = _company AND code = 'N-08-DEPT-PROC' LIMIT 1;

-- =============================================================
-- WAREHOUSES (N-08)
-- =============================================================
INSERT INTO public.warehouses (company_id, name, code, plant_id) VALUES
  (_company, 'N-08 Main Warehouse', 'N-08-WH-MAIN', _plant1),
  (_company, 'N-08 Raw Materials WH', 'N-08-WH-RAW', _plant1),
  (_company, 'N-08 Finished Goods WH', 'N-08-WH-FG', _plant1)
ON CONFLICT DO NOTHING;

SELECT id INTO _wh_main FROM public.warehouses WHERE company_id = _company AND code = 'N-08-WH-MAIN' LIMIT 1;
SELECT id INTO _wh_raw FROM public.warehouses WHERE company_id = _company AND code = 'N-08-WH-RAW' LIMIT 1;
SELECT id INTO _wh_fg FROM public.warehouses WHERE company_id = _company AND code = 'N-08-WH-FG' LIMIT 1;

-- =============================================================
-- MACHINES (N-08)
-- =============================================================
IF NOT EXISTS (SELECT 1 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-A1') THEN
    INSERT INTO public.machines (company_id, name, code, type, status, utilization, last_maintenance) VALUES
      (_company, 'N-08 CNC Mill Alpha-1', 'N-08-MC-A1', '5-axis CNC', 'operational', 87.5, now() - interval '5 days'),
      (_company, 'N-08 CNC Lathe Beta-2', 'N-08-MC-B2', 'Turning Center', 'operational', 82.3, now() - interval '3 days'),
      (_company, 'N-08 Injection Molder IM-3', 'N-08-MC-I3', 'Molding', 'operational', 92.1, now() - interval '7 days'),
      (_company, 'N-08 Press Brake PB-5', 'N-08-MC-P5', 'Press Brake', 'operational', 78.9, now() - interval '10 days'),
      (_company, 'N-08 EDM Machine ED-6', 'N-08-MC-E6', 'EDM', 'maintenance', 0, now() - interval '2 days'),
      (_company, 'N-08 Robotic Assembly R-7', 'N-08-MC-R7', '6-axis Robot', 'operational', 95.2, now() - interval '1 day'),
      (_company, 'N-08 Welding Robot WR-8', 'N-08-MC-W8', 'Welding Robot', 'operational', 88.7, now() - interval '4 days'),
      (_company, 'N-08 Fiber Laser FL-9', 'N-08-MC-L9', 'Fiber Laser', 'operational', 91.4, now() - interval '6 days'),
      (_company, 'N-08 Grinding Machine GR-10', 'N-08-MC-G10', 'Grinder', 'operational', 76.5, now() - interval '8 days'),
      (_company, 'N-08 Deburring Cell DB-11', 'N-08-MC-D11', 'Deburring', 'down', 0, now() - interval '12 days');
  END IF;

SELECT id INTO _prod_a1 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-A1' LIMIT 1;
SELECT id INTO _prod_b2 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-B2' LIMIT 1;
SELECT id INTO _prod_m3 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-I3' LIMIT 1;
SELECT id INTO _prod_a3 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-E6' LIMIT 1;
SELECT id INTO _prod_a4 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-P5' LIMIT 1;
SELECT id INTO _prod_a5 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-R7' LIMIT 1;
SELECT id INTO _prod_r7 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-R7' LIMIT 1;
SELECT id INTO _prod_w8 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-W8' LIMIT 1;
SELECT id INTO _prod_l9 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-L9' LIMIT 1;
SELECT id INTO _prod_g10 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-G10' LIMIT 1;
SELECT id INTO _prod_d11 FROM public.machines WHERE company_id = _company AND code = 'N-08-MC-D11' LIMIT 1;

-- =============================================================
-- PRODUCTS (N-08)
-- =============================================================
INSERT INTO public.products (company_id, sku, name, unit, unit_cost, status) VALUES
  (_company, 'N-08-SKU-001', 'N-08 Titanium Bracket TB-500', 'pcs', 42.50, 'active'),
  (_company, 'N-08-SKU-002', 'N-08 Aluminum Housing AH-220', 'pcs', 38.20, 'active'),
  (_company, 'N-08-SKU-003', 'N-08 Precision Bearing PB-300', 'pcs', 6.20, 'active'),
  (_company, 'N-08-SKU-004', 'N-08 Servo Motor SM-400', 'pcs', 210.00, 'active'),
  (_company, 'N-08-SKU-005', 'N-08 Control Board CB-X1', 'pcs', 88.00, 'active'),
  (_company, 'N-08-SKU-006', 'N-08 Stainless Steel Sheet SS-2mm', 'kg', 4.50, 'active'),
  (_company, 'N-08-SKU-007', 'N-08 Copper Wire CW-1.5mm', 'm', 0.85, 'active'),
  (_company, 'N-08-SKU-008', 'N-08 Hydraulic Valve HV-200', 'pcs', 145.00, 'active'),
  (_company, 'N-08-SKU-009', 'N-08 Sensor Array SA-X1', 'pcs', 67.00, 'active'),
  (_company, 'N-08-SKU-010', 'N-08 Gear Assembly GA-100', 'pcs', 33.00, 'active')
ON CONFLICT DO NOTHING;

-- =============================================================
-- MATERIALS (N-08) — new table for Customer Order lifecycle
-- =============================================================
INSERT INTO public.materials (company_id, name, unit, unit_cost, department_id, is_active) VALUES
  (_company, 'N-08 Stainless Steel 304', 'kg', 12.50, _dept_prod, true),
  (_company, 'N-08 Aluminum 6061', 'kg', 8.75, _dept_prod, true),
  (_company, 'N-08 Titanium Grade 5', 'kg', 45.00, _dept_prod, true),
  (_company, 'N-08 Brass C360', 'kg', 15.20, _dept_prod, true),
  (_company, 'N-08 Carbon Steel A36', 'kg', 6.80, _dept_prod, true),
  (_company, 'N-08 Copper C110', 'kg', 22.40, _dept_proc, true),
  (_company, 'N-08 Nylon PA6', 'kg', 4.50, _dept_prod, true),
  (_company, 'N-08 Delrin Acetal', 'kg', 7.90, _dept_prod, true)
ON CONFLICT DO NOTHING;

SELECT id INTO _mat_ss FROM public.materials WHERE company_id = _company AND name = 'N-08 Stainless Steel 304' LIMIT 1;
SELECT id INTO _mat_al FROM public.materials WHERE company_id = _company AND name = 'N-08 Aluminum 6061' LIMIT 1;
SELECT id INTO _mat_ti FROM public.materials WHERE company_id = _company AND name = 'N-08 Titanium Grade 5' LIMIT 1;
SELECT id INTO _mat_br FROM public.materials WHERE company_id = _company AND name = 'N-08 Brass C360' LIMIT 1;
SELECT id INTO _mat_cs FROM public.materials WHERE company_id = _company AND name = 'N-08 Carbon Steel A36' LIMIT 1;
SELECT id INTO _mat_cu FROM public.materials WHERE company_id = _company AND name = 'N-08 Copper C110' LIMIT 1;
SELECT id INTO _mat_ny FROM public.materials WHERE company_id = _company AND name = 'N-08 Nylon PA6' LIMIT 1;
SELECT id INTO _mat_dl FROM public.materials WHERE company_id = _company AND name = 'N-08 Delrin Acetal' LIMIT 1;

-- =============================================================
-- INVENTORY (N-08) — stock levels
-- =============================================================
INSERT INTO public.inventory (company_id, warehouse_id, product_id, quantity) 
SELECT _company, _wh_main, p.id, 
  CASE p.sku
    WHEN 'N-08-SKU-001' THEN 420
    WHEN 'N-08-SKU-002' THEN 1850
    WHEN 'N-08-SKU-003' THEN 3200
    WHEN 'N-08-SKU-004' THEN 85
    WHEN 'N-08-SKU-005' THEN 310
    WHEN 'N-08-SKU-006' THEN 2500
    WHEN 'N-08-SKU-007' THEN 8000
    WHEN 'N-08-SKU-008' THEN 42
    WHEN 'N-08-SKU-009' THEN 110
    WHEN 'N-08-SKU-010' THEN 650
    ELSE 100
  END
FROM public.products p WHERE p.company_id = _company AND p.sku LIKE 'N-08-%'
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();

-- Raw Materials warehouse stock
INSERT INTO public.inventory (company_id, warehouse_id, product_id, quantity)
SELECT _company, _wh_raw, p.id, 
  CASE p.sku
    WHEN 'N-08-SKU-003' THEN 5500
    WHEN 'N-08-SKU-005' THEN 200
    WHEN 'N-08-SKU-006' THEN 6000
    WHEN 'N-08-SKU-007' THEN 15000
    ELSE 500
  END
FROM public.products p WHERE p.company_id = _company AND p.sku IN ('N-08-SKU-003','N-08-SKU-005','N-08-SKU-006','N-08-SKU-007')
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();

-- Finished Goods warehouse stock
INSERT INTO public.inventory (company_id, warehouse_id, product_id, quantity)
SELECT _company, _wh_fg, p.id, 
  CASE p.sku
    WHEN 'N-08-SKU-001' THEN 180
    WHEN 'N-08-SKU-002' THEN 520
    WHEN 'N-08-SKU-008' THEN 12
    WHEN 'N-08-SKU-010' THEN 210
    ELSE 50
  END
FROM public.products p WHERE p.company_id = _company AND p.sku IN ('N-08-SKU-001','N-08-SKU-002','N-08-SKU-008','N-08-SKU-010')
ON CONFLICT (warehouse_id, product_id) DO UPDATE SET quantity = EXCLUDED.quantity, updated_at = now();

-- =============================================================
-- CUSTOMERS (N-08) — 3 demo customers with various lifecycle stages
-- =============================================================
-- Check if customers already exist for this company
IF NOT EXISTS (SELECT 1 FROM public.customers WHERE company_id = _company AND business_name = 'N-08 AeroSpace Dynamics') THEN
    INSERT INTO public.customers (company_id, user_id, name, business_name, contact_person, email, phone, gst_number, billing_address, shipping_address, credit_limit, is_active)
    VALUES (_company, NULL, 'N-08 AeroSpace Dynamics', 'N-08 AeroSpace Dynamics', 'John Miller', 'aerospace@n08-demo.com', '+1 313-555-0101', 'N-08-GST-001', '1200 Aerospace Blvd, Chicago, IL', '1200 Aerospace Blvd, Chicago, IL', 100000.00, true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE company_id = _company AND business_name = 'N-08 VoltDrive Electric') THEN
    INSERT INTO public.customers (company_id, user_id, name, business_name, contact_person, email, phone, gst_number, billing_address, shipping_address, credit_limit, is_active)
    VALUES (_company, NULL, 'N-08 VoltDrive Electric', 'N-08 VoltDrive Electric', 'Sarah Chen', 'voltdrive@n08-demo.com', '+1 480-555-0202', 'N-08-GST-002', '850 Innovation Dr, Phoenix, AZ', '850 Innovation Dr, Phoenix, AZ', 150000.00, true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customers WHERE company_id = _company AND business_name = 'N-08 MediCore HealthTech') THEN
    INSERT INTO public.customers (company_id, user_id, name, business_name, contact_person, email, phone, gst_number, billing_address, shipping_address, credit_limit, is_active)
    VALUES (_company, NULL, 'N-08 MediCore HealthTech', 'N-08 MediCore HealthTech', 'Dr. Lisa Wong', 'medicore@n08-demo.com', '+1 408-555-0303', 'N-08-GST-003', '300 Medical Plaza, San Jose, CA', '300 Medical Plaza, San Jose, CA', 200000.00, true);
  END IF;

-- =============================================================
-- CUSTOMER REQUESTS (N-08) — pending + approved samples
-- =============================================================
IF NOT EXISTS (SELECT 1 FROM public.customer_requests WHERE company_id = _company AND email = 'newbuyer@n08-demo.com') THEN
  INSERT INTO public.customer_requests (company_id, business_name, contact_person, email, phone, gst_number, address, status)
  VALUES (_company, 'N-08 New Buyer Corp', 'Mike Ross', 'newbuyer@n08-demo.com', '+1 212-555-0404', 'N-08-GST-004', '500 Fifth Ave, New York, NY', 'pending');
END IF;
IF NOT EXISTS (SELECT 1 FROM public.customer_requests WHERE company_id = _company AND email = 'rejectedbuyer@n08-demo.com') THEN
  INSERT INTO public.customer_requests (company_id, business_name, contact_person, email, phone, status, rejection_reason)
  VALUES (_company, 'N-08 Rejected Inc', 'Bad Actor', 'rejectedbuyer@n08-demo.com', '+1 555-0505', 'rejected', 'Incomplete documentation — GST verification failed');
END IF;

-- =============================================================
-- CUSTOMER ORDERS (N-08) — full lifecycle variety
-- =============================================================
-- Get customer IDs
DECLARE
  _cust_aero uuid;
  _cust_volt uuid;
  _cust_medi uuid;
  _prod_ti uuid;
  _prod_al uuid;
  _prod_pb uuid;
  _prod_sm uuid;
  _prod_cb uuid;
  _prod_hv uuid;
  _prod_sa uuid;
BEGIN
  SELECT id INTO _cust_aero FROM public.customers WHERE company_id = _company AND business_name = 'N-08 AeroSpace Dynamics' LIMIT 1;
  SELECT id INTO _cust_volt FROM public.customers WHERE company_id = _company AND business_name = 'N-08 VoltDrive Electric' LIMIT 1;
  SELECT id INTO _cust_medi FROM public.customers WHERE company_id = _company AND business_name = 'N-08 MediCore HealthTech' LIMIT 1;
  SELECT id INTO _prod_ti FROM public.products WHERE company_id = _company AND sku = 'N-08-SKU-001' LIMIT 1;
  SELECT id INTO _prod_al FROM public.products WHERE company_id = _company AND sku = 'N-08-SKU-002' LIMIT 1;
  SELECT id INTO _prod_pb FROM public.products WHERE company_id = _company AND sku = 'N-08-SKU-003' LIMIT 1;
  SELECT id INTO _prod_sm FROM public.products WHERE company_id = _company AND sku = 'N-08-SKU-004' LIMIT 1;
  SELECT id INTO _prod_cb FROM public.products WHERE company_id = _company AND sku = 'N-08-SKU-005' LIMIT 1;
  SELECT id INTO _prod_hv FROM public.products WHERE company_id = _company AND sku = 'N-08-SKU-008' LIMIT 1;
  SELECT id INTO _prod_sa FROM public.products WHERE company_id = _company AND sku = 'N-08-SKU-009' LIMIT 1;

  -- AeroSpace: 1 completed, 1 delivered, 1 pending_approval
  IF NOT EXISTS (SELECT 1 FROM public.customer_orders WHERE company_id = _company AND order_number = 'N-08-ORD-001') THEN
    INSERT INTO public.customer_orders (order_number, company_id, customer_id, product, material_id, quantity, delivery_date, priority, status, order_total, advance_payment_percent, advance_amount, advance_payment_status, balance_due, approved_at, created_at, updated_at)
    VALUES ('N-08-ORD-001', _company, _cust_aero, 'CNC Machined Bracket Set', _mat_ti, 250, now() + interval '15 days', 'high', 'completed', 42500.00, 20.00, 8500.00, 'paid', 34000.00, now() - interval '10 days', now() - interval '20 days', now() - interval '2 days');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_orders WHERE company_id = _company AND order_number = 'N-08-ORD-002') THEN
    INSERT INTO public.customer_orders (order_number, company_id, customer_id, product, material_id, quantity, delivery_date, priority, status, order_total, advance_payment_percent, advance_amount, advance_payment_status, balance_due, approved_at, created_at, updated_at)
    VALUES ('N-08-ORD-002', _company, _cust_aero, 'Servo Motor Assembly', _mat_cs, 100, now() + interval '20 days', 'normal', 'delivered', 18750.00, 20.00, 3750.00, 'paid', 15000.00, now() - interval '8 days', now() - interval '15 days', now() - interval '1 day');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_orders WHERE company_id = _company AND order_number = 'N-08-ORD-003') THEN
    INSERT INTO public.customer_orders (order_number, company_id, customer_id, product, material_id, quantity, delivery_date, priority, status, order_total, advance_payment_percent, advance_amount, advance_payment_status, balance_due, created_at)
    VALUES ('N-08-ORD-003', _company, _cust_aero, 'Hydraulic Valve Kit', _mat_br, 50, now() + interval '45 days', 'low', 'pending_approval', 16000.00, 20.00, 3200.00, 'unpaid', 12800.00, now() - interval '1 day');
  END IF;

  -- VoltDrive: 1 in_production, 1 awaiting advance payment
  IF NOT EXISTS (SELECT 1 FROM public.customer_orders WHERE company_id = _company AND order_number = 'N-08-ORD-004') THEN
    INSERT INTO public.customer_orders (order_number, company_id, customer_id, product, material_id, quantity, delivery_date, priority, status, order_total, advance_payment_percent, advance_amount, advance_payment_status, balance_due, approved_by, approved_at, created_at, updated_at)
    VALUES ('N-08-ORD-004', _company, _cust_volt, 'Aluminum Housing AH-220', _mat_al, 500, now() + interval '10 days', 'urgent', 'in_production', 42200.00, 25.00, 10550.00, 'paid', 31650.00, _root_user, now() - interval '5 days', now() - interval '14 days', now() - interval '1 day');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_orders WHERE company_id = _company AND order_number = 'N-08-ORD-005') THEN
    INSERT INTO public.customer_orders (order_number, company_id, customer_id, product, material_id, quantity, delivery_date, priority, status, order_total, advance_payment_percent, advance_amount, advance_payment_status, balance_due, approved_by, approved_at, created_at, updated_at)
    VALUES ('N-08-ORD-005', _company, _cust_volt, 'Control Board CB-X1 Batch', _mat_cs, 200, now() + interval '18 days', 'high', 'awaiting_advance_payment', 39000.00, 20.00, 7800.00, 'unpaid', 31200.00, _root_user, now() - interval '3 days', now() - interval '7 days', now() - interval '1 day');
  END IF;

  -- MediCore: 1 in production (paused for maintenance), 1 changes_requested
  IF NOT EXISTS (SELECT 1 FROM public.customer_orders WHERE company_id = _company AND order_number = 'N-08-ORD-006') THEN
    INSERT INTO public.customer_orders (order_number, company_id, customer_id, product, material_id, quantity, delivery_date, priority, status, order_total, advance_payment_percent, advance_amount, advance_payment_status, balance_due, approved_by, approved_at, created_at, updated_at)
    VALUES ('N-08-ORD-006', _company, _cust_medi, 'Precision Sensor Array', _mat_al, 150, now() + interval '7 days', 'urgent', 'advance_paid', 23250.00, 30.00, 6975.00, 'paid', 16275.00, _root_user, now() - interval '2 days', now() - interval '5 days', now() - interval '12 hours');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.customer_orders WHERE company_id = _company AND order_number = 'N-08-ORD-007') THEN
    INSERT INTO public.customer_orders (order_number, company_id, customer_id, product, material_id, quantity, delivery_date, priority, status, order_total, created_at)
    VALUES ('N-08-ORD-007', _company, _cust_medi, 'Gear Assembly GA-100', _mat_ny, 300, now() + interval '14 days', 'high', 'changes_requested', 23550.00, now() - interval '3 days');
  END IF;

  -- =============================================================
  -- SALES ORDERS (N-08) — old table, keep in sync
  -- =============================================================
  INSERT INTO public.sales_orders (company_id, so_number, customer_id, status, priority, total_amount, order_date, due_date)
  SELECT _company, co.order_number, co.customer_id,
    CASE co.status
      WHEN 'completed' THEN 'completed'
      WHEN 'delivered' THEN 'completed'
      WHEN 'in_production' THEN 'in_progress'
      WHEN 'advance_paid' THEN 'in_progress'
      WHEN 'awaiting_advance_payment' THEN 'confirmed'
      WHEN 'pending_approval' THEN 'pending'
      WHEN 'changes_requested' THEN 'revision'
      ELSE 'pending'
    END,
    co.priority, co.order_total, co.created_at::date, co.delivery_date
  FROM public.customer_orders co
  WHERE co.company_id = _company AND co.order_number LIKE 'N-08-%'
  AND NOT EXISTS (SELECT 1 FROM public.sales_orders so WHERE so.company_id = _company AND so.so_number = co.order_number)
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- PRODUCTION ORDERS (N-08) — old table
  -- =============================================================
  INSERT INTO public.production_orders (company_id, order_number, product_id, quantity, status, priority, start_date, due_date, sales_order_id)
  SELECT _company,
    'N-08-PO-' || substr(co.order_number, -3),
    (SELECT p.id FROM public.products p WHERE p.company_id = _company AND p.sku = 'N-08-SKU-001' LIMIT 1),
    co.quantity,
    CASE co.status
      WHEN 'completed' THEN 'completed'
      WHEN 'delivered' THEN 'completed'
      WHEN 'in_production' THEN 'in_progress'
      WHEN 'advance_paid' THEN 'planned'
      ELSE 'draft'
    END,
    co.priority,
    now() - interval '10 days',
    co.delivery_date,
    so.id
  FROM public.customer_orders co
  JOIN public.sales_orders so ON so.company_id = _company AND so.so_number = co.order_number
  WHERE co.company_id = _company AND co.order_number IN ('N-08-ORD-001','N-08-ORD-004','N-08-ORD-006')
  AND NOT EXISTS (SELECT 1 FROM public.production_orders po WHERE po.company_id = _company AND po.order_number = 'N-08-PO-' || substr(co.order_number, -3))
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- PRODUCTION PLANNING (N-08) — new table
  -- =============================================================
  INSERT INTO public.production_planning (customer_order_id, company_id, order_number, status, priority, material_id, quantity, start_date, due_date)
  SELECT co.id, _company, co.order_number,
    CASE co.status
      WHEN 'in_production' THEN 'in_progress'
      WHEN 'advance_paid' THEN 'planned'
      WHEN 'completed' THEN 'completed'
      ELSE 'planned'
    END,
    co.priority, co.material_id, co.quantity, now() - interval '5 days', co.delivery_date
  FROM public.customer_orders co
  WHERE co.company_id = _company AND co.order_number IN ('N-08-ORD-001','N-08-ORD-004','N-08-ORD-006')
  AND NOT EXISTS (SELECT 1 FROM public.production_planning pp WHERE pp.company_id = _company AND pp.order_number = co.order_number)
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- WORK ORDERS (N-08) — old table
  -- =============================================================
  INSERT INTO public.work_orders (company_id, production_order_id, wo_number, operation, quantity, status, start_time, end_time, machine_id)
  SELECT _company,
    (SELECT id FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-001' LIMIT 1),
    'N-08-WO-001', 'CNC Machining', 250, 'completed',
    now() - interval '14 days', now() - interval '10 days', _prod_a1
  WHERE EXISTS (SELECT 1 FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-001')
  AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-001');

  INSERT INTO public.work_orders (company_id, production_order_id, wo_number, operation, quantity, status, start_time, end_time, machine_id)
  SELECT _company,
    (SELECT id FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-001' LIMIT 1),
    'N-08-WO-002', 'Quality Inspection', 250, 'completed',
    now() - interval '10 days', now() - interval '8 days', NULL
  WHERE EXISTS (SELECT 1 FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-001')
  AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-002');

  INSERT INTO public.work_orders (company_id, production_order_id, wo_number, operation, quantity, status, start_time, end_time, machine_id)
  SELECT _company,
    (SELECT id FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-004' LIMIT 1),
    'N-08-WO-003', 'Assembly', 500, 'in_progress',
    now() - interval '3 days', NULL, _prod_r7
  WHERE EXISTS (SELECT 1 FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-004')
  AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-003');

  INSERT INTO public.work_orders (company_id, production_order_id, wo_number, operation, quantity, status, machine_id)
  SELECT _company,
    (SELECT id FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-006' LIMIT 1),
    'N-08-WO-004', 'Precision Assembly', 150, 'pending', _prod_r7
  WHERE EXISTS (SELECT 1 FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-006')
  AND NOT EXISTS (SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-004');

  -- =============================================================
  -- QUALITY INSPECTIONS (N-08)
  -- =============================================================
  INSERT INTO public.quality_inspections (company_id, inspection_number, production_order_id, inspection_type, result, defects_found, quantity_checked, created_at)
  SELECT _company, 'N-08-QI-001',
    (SELECT id FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-001' LIMIT 1),
    'incoming', 'pass', 0, 250, now() - interval '12 days'
  WHERE EXISTS (SELECT 1 FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-001')
  AND NOT EXISTS (SELECT 1 FROM public.quality_inspections WHERE company_id = _company AND inspection_number = 'N-08-QI-001');

  INSERT INTO public.quality_inspections (company_id, inspection_number, production_order_id, inspection_type, result, defects_found, quantity_checked, created_at)
  SELECT _company, 'N-08-QI-002',
    (SELECT id FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-001' LIMIT 1),
    'final', 'pass', 2, 250, now() - interval '7 days'
  WHERE EXISTS (SELECT 1 FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-001')
  AND NOT EXISTS (SELECT 1 FROM public.quality_inspections WHERE company_id = _company AND inspection_number = 'N-08-QI-002');

  INSERT INTO public.quality_inspections (company_id, inspection_number, production_order_id, inspection_type, result, defects_found, quantity_checked, created_at)
  SELECT _company, 'N-08-QI-003',
    (SELECT id FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-004' LIMIT 1),
    'in_process', 'pass', 1, 250, now() - interval '2 days'
  WHERE EXISTS (SELECT 1 FROM public.production_orders WHERE company_id = _company AND order_number = 'N-08-PO-004')
  AND NOT EXISTS (SELECT 1 FROM public.quality_inspections WHERE company_id = _company AND inspection_number = 'N-08-QI-003');

  -- =============================================================
  -- FINISHED GOODS (N-08) — new table
  -- =============================================================
  INSERT INTO public.finished_goods (company_id, work_order_id, product, quantity, notes, created_at)
  SELECT _company,
    (SELECT id FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-001' LIMIT 1),
    'N-08 Titanium Bracket TB-500', 248, 'Inspected and approved — 2 defects scrapped', now() - interval '6 days'
  WHERE EXISTS (SELECT 1 FROM public.work_orders WHERE company_id = _company AND wo_number = 'N-08-WO-001')
  AND NOT EXISTS (SELECT 1 FROM public.finished_goods WHERE company_id = _company AND product = 'N-08 Titanium Bracket TB-500');

  -- =============================================================
  -- PACKING (N-08) — new table
  -- =============================================================
  INSERT INTO public.packing (company_id, finished_goods_id, package_number, quantity, notes, created_at)
  SELECT _company, fg.id, 'N-08-PKG-001', 248, '4 crates, 62 units each', now() - interval '5 days'
  FROM public.finished_goods fg
  WHERE fg.company_id = _company AND fg.product = 'N-08 Titanium Bracket TB-500'
  AND NOT EXISTS (SELECT 1 FROM public.packing WHERE company_id = _company AND package_number = 'N-08-PKG-001');

  -- =============================================================
  -- SHIPMENTS (N-08) — matching order lifecycle
  -- =============================================================
  INSERT INTO public.shipments (company_id, shipment_number, sales_order_id, customer_id, carrier, tracking_number, destination, status, shipped_date, delivered_date)
  SELECT _company, 'N-08-SHP-001', so.id, _cust_aero, 'FedEx', 'N-08-TRK-7749102836451',
    'Detroit, MI -> Chicago, IL', 'delivered',
    now() - interval '6 days', now() - interval '4 days'
  FROM public.sales_orders so WHERE so.company_id = _company AND so.so_number = 'N-08-ORD-001'
  AND NOT EXISTS (SELECT 1 FROM public.shipments WHERE company_id = _company AND shipment_number = 'N-08-SHP-001');

  INSERT INTO public.shipments (company_id, shipment_number, sales_order_id, customer_id, carrier, tracking_number, destination, status, shipped_date)
  SELECT _company, 'N-08-SHP-002', so.id, _cust_aero, 'UPS', 'N-08-TRK-1Z999AA10123456784',
    'Detroit, MI -> Houston, TX', 'in_transit', now() - interval '2 days'
  FROM public.sales_orders so WHERE so.company_id = _company AND so.so_number = 'N-08-ORD-002'
  AND NOT EXISTS (SELECT 1 FROM public.shipments WHERE company_id = _company AND shipment_number = 'N-08-SHP-002');

  INSERT INTO public.shipments (company_id, shipment_number, sales_order_id, customer_id, carrier, tracking_number, destination, status)
  SELECT _company, 'N-08-SHP-003', so.id, _cust_volt, 'DHL', 'PENDING',
    'Detroit, MI -> Phoenix, AZ', 'pending'
  FROM public.sales_orders so WHERE so.company_id = _company AND so.so_number = 'N-08-ORD-004'
  AND NOT EXISTS (SELECT 1 FROM public.shipments WHERE company_id = _company AND shipment_number = 'N-08-SHP-003');

  -- =============================================================
  -- INVOICES (N-08)
  -- =============================================================
  INSERT INTO public.invoices (company_id, invoice_number, customer_id, sales_order_id, total_amount, tax_amount, status, issue_date, due_date, paid_date)
  SELECT _company, 'N-08-INV-001', _cust_aero, so.id, 42500.00, 3400.00, 'paid',
    now() - interval '7 days', now() + interval '23 days', now() - interval '3 days'
  FROM public.sales_orders so WHERE so.company_id = _company AND so.so_number = 'N-08-ORD-001'
  AND NOT EXISTS (SELECT 1 FROM public.invoices WHERE company_id = _company AND invoice_number = 'N-08-INV-001');

  INSERT INTO public.invoices (company_id, invoice_number, customer_id, sales_order_id, total_amount, tax_amount, status, issue_date, due_date)
  SELECT _company, 'N-08-INV-002', _cust_volt, so.id, 42200.00, 3376.00, 'sent',
    now() - interval '2 days', now() + interval '28 days'
  FROM public.sales_orders so WHERE so.company_id = _company AND so.so_number = 'N-08-ORD-004'
  AND NOT EXISTS (SELECT 1 FROM public.invoices WHERE company_id = _company AND invoice_number = 'N-08-INV-002');

  INSERT INTO public.invoices (company_id, invoice_number, customer_id, sales_order_id, total_amount, tax_amount, status, issue_date, due_date)
  SELECT _company, 'N-08-INV-003', _cust_medi, so.id, 16275.00, 1302.00, 'draft',
    now(), now() + interval '30 days'
  FROM public.sales_orders so WHERE so.company_id = _company AND so.so_number = 'N-08-ORD-006'
  AND NOT EXISTS (SELECT 1 FROM public.invoices WHERE company_id = _company AND invoice_number = 'N-08-INV-003');

  -- =============================================================
  -- PAYMENTS (N-08)
  -- =============================================================
  INSERT INTO public.payments (company_id, payment_number, invoice_id, amount, method, reference, status, paid_at)
  SELECT _company, 'N-08-PAY-001', inv.id, 8500.00, 'bank_transfer', 'N-08-TXN-AERO-ADV',
    'completed', now() - interval '15 days'
  FROM public.invoices inv WHERE inv.company_id = _company AND inv.invoice_number = 'N-08-INV-001'
  AND NOT EXISTS (SELECT 1 FROM public.payments WHERE company_id = _company AND payment_number = 'N-08-PAY-001');

  INSERT INTO public.payments (company_id, payment_number, invoice_id, amount, method, reference, status, paid_at)
  SELECT _company, 'N-08-PAY-002', inv.id, 37400.00, 'wire', 'N-08-TXN-AERO-BAL',
    'completed', now() - interval '3 days'
  FROM public.invoices inv WHERE inv.company_id = _company AND inv.invoice_number = 'N-08-INV-001'
  AND NOT EXISTS (SELECT 1 FROM public.payments WHERE company_id = _company AND payment_number = 'N-08-PAY-002');

  INSERT INTO public.payments (company_id, payment_number, invoice_id, amount, method, reference, status, paid_at)
  SELECT _company, 'N-08-PAY-003', inv.id, 10550.00, 'bank_transfer', 'N-08-TXN-VOLT-ADV',
    'completed', now() - interval '1 day'
  FROM public.invoices inv WHERE inv.company_id = _company AND inv.invoice_number = 'N-08-INV-002'
  AND NOT EXISTS (SELECT 1 FROM public.payments WHERE company_id = _company AND payment_number = 'N-08-PAY-003');

  -- =============================================================
  -- PURCHASE REQUISITIONS (N-08) — new table
  -- =============================================================
  IF NOT EXISTS (SELECT 1 FROM public.purchase_requisitions WHERE company_id = _company AND pr_number = 'N-08-PR-001') THEN
    INSERT INTO public.purchase_requisitions (company_id, pr_number, material_id, quantity, status, notes, created_at)
    VALUES (_company, 'N-08-PR-001', _mat_al, 2000, 'approved', 'Stock replenishment for N-08-ORD-004', now() - interval '10 days');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.purchase_requisitions WHERE company_id = _company AND pr_number = 'N-08-PR-002') THEN
    INSERT INTO public.purchase_requisitions (company_id, pr_number, material_id, quantity, status, notes, created_at)
    VALUES (_company, 'N-08-PR-002', _mat_ti, 500, 'pending', 'New material needed for upcoming aerospace orders', now() - interval '2 days');
  END IF;

  -- =============================================================
  -- SUPPLIERS (N-08)
  -- =============================================================
  IF NOT EXISTS (SELECT 1 FROM public.suppliers WHERE company_id = _company AND name = 'N-08 MetalWorks Supply Co') THEN
  INSERT INTO public.suppliers (company_id, name, contact_email, contact_phone, status) VALUES
    (_company, 'N-08 MetalWorks Supply Co', 'metalworks@n08-supplier.com', '+1 312-555-1001', 'active'),
    (_company, 'N-08 Precision Components Ltd', 'precision@n08-supplier.com', '+1 847-555-2002', 'active'),
    (_company, 'N-08 Raw Material Masters', 'rawmats@n08-supplier.com', '+1 313-555-3003', 'active'),
    (_company, 'N-08 Electronics & Sensors Inc', 'electronics@n08-supplier.com', '+1 480-555-4004', 'active');
END IF;

  -- =============================================================
  -- PURCHASE ORDERS (N-08)
  -- =============================================================
  INSERT INTO public.purchase_orders (company_id, po_number, supplier_id, status, total_amount, expected_date, created_at) VALUES
    (_company, 'N-08-PO-001',
      (SELECT id FROM public.suppliers WHERE company_id = _company AND name = 'N-08 MetalWorks Supply Co' LIMIT 1),
      'sent', 17500.00, now() + interval '7 days', now() - interval '8 days'),
    (_company, 'N-08-PO-002',
      (SELECT id FROM public.suppliers WHERE company_id = _company AND name = 'N-08 Precision Components Ltd' LIMIT 1),
      'accepted', 22500.00, now() + interval '12 days', now() - interval '5 days'),
    (_company, 'N-08-PO-003',
      (SELECT id FROM public.suppliers WHERE company_id = _company AND name = 'N-08 Electronics & Sensors Inc' LIMIT 1),
      'fulfilled', 9600.00, now() - interval '2 days', now() - interval '14 days'),
    (_company, 'N-08-PO-004',
      (SELECT id FROM public.suppliers WHERE company_id = _company AND name = 'N-08 Raw Material Masters' LIMIT 1),
      'modified', 8200.00, now() + interval '21 days', now() - interval '3 days')
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- EMPLOYEES (N-08)
  -- =============================================================
  INSERT INTO public.employees (company_id, employee_code, full_name, email, job_title, department, status, hire_date) VALUES
    (_company, 'N-08-EMP-001', 'Rajesh Kumar', 'rajesh.k@n08-demo.com', 'Plant Manager', 'N-08 Production', 'active', now() - interval '3 years'),
    (_company, 'N-08-EMP-002', 'Priya Sharma', 'priya.s@n08-demo.com', 'Production Manager', 'N-08 Production', 'active', now() - interval '2 years'),
    (_company, 'N-08-EMP-003', 'Amit Patel', 'amit.p@n08-demo.com', 'Quality Inspector', 'N-08 Quality', 'active', now() - interval '18 months'),
    (_company, 'N-08-EMP-004', 'Vikram Singh', 'vikram.s@n08-demo.com', 'Maintenance Engineer', 'N-08 Maintenance', 'active', now() - interval '2 years'),
    (_company, 'N-08-EMP-005', 'Neha Gupta', 'neha.g@n08-demo.com', 'Warehouse Manager', 'N-08 Warehouse', 'active', now() - interval '15 months'),
    (_company, 'N-08-EMP-006', 'Suresh Reddy', 'suresh.r@n08-demo.com', 'Finance Manager', 'N-08 Finance', 'active', now() - interval '4 years'),
    (_company, 'N-08-EMP-007', 'Anjali Nair', 'anjali.n@n08-demo.com', 'HR Manager', 'N-08 HR', 'active', now() - interval '3 years'),
    (_company, 'N-08-EMP-008', 'Deepak Verma', 'deepak.v@n08-demo.com', 'CNC Operator', 'N-08 Production', 'active', now() - interval '8 months'),
    (_company, 'N-08-EMP-009', 'Kavita Joshi', 'kavita.j@n08-demo.com', 'Procurement Specialist', 'N-08 Procurement', 'active', now() - interval '1 year'),
    (_company, 'N-08-EMP-010', 'Ravi Kumar', 'ravi.k@n08-demo.com', 'Assembly Technician', 'N-08 Production', 'active', now() - interval '6 months')
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- ATTENDANCE (N-08) — last 5 days
  -- =============================================================
  INSERT INTO public.attendance (company_id, employee_id, date, check_in, check_out, hours_worked, status)
  SELECT _company, e.id, now()::date - interval '1 day',
    now()::date - interval '1 day' + time '07:30' + (random() * interval '30 minutes'),
    now()::date - interval '1 day' + time '16:00' + (random() * interval '30 minutes'),
    8 + random() * 1.5, 'present'
  FROM public.employees e
  WHERE e.company_id = _company AND e.employee_code LIKE 'N-08-%'
  AND NOT EXISTS (SELECT 1 FROM public.attendance a WHERE a.company_id = _company AND a.employee_id = e.id AND a.date = now()::date - interval '1 day')
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- PAYROLL (N-08)
  -- =============================================================
  INSERT INTO public.payroll (company_id, employee_id, period, gross_amount, deductions, net_amount, status, paid_at)
  SELECT _company, e.id, to_char(now(), 'YYYY-MM'),
    CASE e.job_title
      WHEN 'Plant Manager' THEN 8500.00
      WHEN 'Production Manager' THEN 7800.00
      WHEN 'Quality Inspector' THEN 6500.00
      WHEN 'Maintenance Engineer' THEN 7200.00
      WHEN 'Warehouse Manager' THEN 6200.00
      WHEN 'Finance Manager' THEN 8000.00
      WHEN 'HR Manager' THEN 7500.00
      WHEN 'CNC Operator' THEN 5200.00
      WHEN 'Procurement Specialist' THEN 6000.00
      WHEN 'Assembly Technician' THEN 4800.00
      ELSE 5000.00
    END,
    CASE e.job_title
      WHEN 'Plant Manager' THEN 1275.00
      WHEN 'Production Manager' THEN 1170.00
      WHEN 'Quality Inspector' THEN 975.00
      WHEN 'Maintenance Engineer' THEN 1080.00
      WHEN 'Warehouse Manager' THEN 930.00
      WHEN 'Finance Manager' THEN 1200.00
      WHEN 'HR Manager' THEN 1125.00
      WHEN 'CNC Operator' THEN 780.00
      WHEN 'Procurement Specialist' THEN 900.00
      WHEN 'Assembly Technician' THEN 720.00
      ELSE 750.00
    END,
    CASE e.job_title
      WHEN 'Plant Manager' THEN 7715.00
      WHEN 'Production Manager' THEN 7134.00
      WHEN 'Quality Inspector' THEN 5679.00
      WHEN 'Maintenance Engineer' THEN 6360.00
      WHEN 'Warehouse Manager' THEN 5340.00
      WHEN 'Finance Manager' THEN 6800.00
      WHEN 'HR Manager' THEN 6495.00
      WHEN 'CNC Operator' THEN 4720.00
      WHEN 'Procurement Specialist' THEN 5352.00
      WHEN 'Assembly Technician' THEN 4564.00
      ELSE 4500.00
    END,
    'pending', NULL
  FROM public.employees e
  WHERE e.company_id = _company AND e.employee_code LIKE 'N-08-%'
  AND NOT EXISTS (SELECT 1 FROM public.payroll p WHERE p.company_id = _company AND p.employee_id = e.id AND p.period = to_char(now(), 'YYYY-MM'))
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- DOCUMENTS (N-08)
  -- =============================================================
  INSERT INTO public.documents (company_id, title, category, file_type, version, status) VALUES
    (_company, 'N-08 ISO 9001:2015 Quality Manual', 'compliance', 'pdf', 'v4.2', 'published'),
    (_company, 'N-08 CNC Mill Operating Procedure', 'maintenance', 'pdf', 'v2.1', 'published'),
    (_company, 'N-08 AeroSpace Dynamics Agreement', 'contracts', 'pdf', 'v1.0', 'published'),
    (_company, 'N-08 VoltDrive Supply Contract', 'contracts', 'pdf', 'v2.0', 'published'),
    (_company, 'N-08 MediCore Purchase Terms', 'contracts', 'pdf', 'v1.1', 'published'),
    (_company, 'N-08 Safety Data Sheet — Titanium', 'safety', 'pdf', 'v3.0', 'published'),
    (_company, 'N-08 Q3 Financial Summary', 'finance', 'xlsx', 'v1.0', 'draft'),
    (_company, 'N-08 Employee Handbook 2026', 'hr', 'pdf', 'v2.0', 'published'),
    (_company, 'N-08 Machine Maintenance Checklist', 'maintenance', 'pdf', 'v1.5', 'published'),
    (_company, 'N-08 Warehouse Safety Procedures', 'safety', 'pdf', 'v2.1', 'published')
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- KNOWLEDGE ARTICLES (N-08)
  -- =============================================================
  INSERT INTO public.knowledge_articles (company_id, title, category, body, views, status) VALUES
    (_company, 'N-08 CNC Mill Alpha-1 Setup Guide', 'machines', 'Complete setup guide for 5-axis CNC Mill Alpha-1 including tool calibration and first-article inspection.', 156, 'published'),
    (_company, 'N-08 Titanium Bracket TB-500 Assembly', 'products', 'Step-by-step assembly for TB-500 titanium bracket including torque specs and quality checkpoints.', 89, 'published'),
    (_company, 'N-08 Quality Inspection — Aerospace', 'quality', 'Incoming and final inspection standards for aerospace-grade components per AS9100D.', 234, 'published'),
    (_company, 'N-08 Preventive Maintenance Schedule', 'maintenance', 'Monthly and quarterly PM schedules for all machines in Detroit Assembly Plant.', 312, 'published'),
    (_company, 'N-08 New Employee Onboarding', 'hr', 'Complete onboarding checklist and training modules for new hires.', 67, 'published'),
    (_company, 'N-08 Supplier Evaluation Criteria', 'procurement', 'Standard criteria and scoring methodology for supplier qualification.', 45, 'published'),
    (_company, 'N-08 Emergency Shutdown Procedures', 'safety', 'Step-by-step emergency shutdown protocols for all production lines.', 278, 'published'),
    (_company, 'N-08 Warehouse Cycle Counting Guide', 'warehouse', 'Monthly cycle counting procedures for inventory accuracy.', 112, 'published')
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- SUPPORT TICKETS (N-08)
  -- =============================================================
  INSERT INTO public.support_tickets (company_id, ticket_number, subject, customer_id, status, priority, created_at) VALUES
    (_company, 'N-08-TKT-001', 'N-08 AeroSpace — Dimensional tolerance inquiry on TB-500',
      _cust_aero, 'resolved', 'medium', now() - interval '10 days'),
    (_company, 'N-08-TKT-002', 'N-08 VoltDrive — Request for updated material certificates',
      _cust_volt, 'resolved', 'low', now() - interval '5 days'),
    (_company, 'N-08-TKT-003', 'N-08 MediCore — In-process defect investigation',
      _cust_medi, 'open', 'critical', now() - interval '1 day'),
    (_company, 'N-08-TKT-004', 'N-08 MediCore — Updated shipping timeline request',
      _cust_medi, 'open', 'high', now())
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- TASKS (N-08)
  -- =============================================================
  INSERT INTO public.tasks (company_id, title, status, priority, due_date, entity) VALUES
    (_company, 'N-08 Prepare AeroSpace shipment docs', 'completed', 'high', now() - interval '7 days', 'dispatch'),
    (_company, 'N-08 Verify VoltDrive quality report', 'completed', 'medium', now() - interval '4 days', 'quality'),
    (_company, 'N-08 Schedule MediCore assembly run', 'in_progress', 'critical', now() + interval '2 days', 'production'),
    (_company, 'N-08 Order materials for MediCore order', 'todo', 'high', now() + interval '5 days', 'procurement'),
    (_company, 'N-08 Robotic Assembly R-7 maintenance', 'in_progress', 'medium', now() + interval '1 day', 'maintenance'),
    (_company, 'N-08 Weekly cycle count WH-MAIN', 'todo', 'medium', now() + interval '7 days', 'warehouse'),
    (_company, 'N-08 Process pending VoltDrive invoices', 'in_progress', 'high', now(), 'finance'),
    (_company, 'N-08 Update CNC Mill Alpha-1 tool offsets', 'todo', 'low', now() + interval '3 days', 'maintenance')
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- DASHBOARD NOTES (N-08) — only if root user exists
  -- =============================================================
  IF _root_user IS NOT NULL THEN
    INSERT INTO public.dashboard_notes (company_id, user_id, dashboard_type, content, source)
    SELECT _company, _root_user, 'company_admin',
      'N-08 Production at 87% OEE this week — 2% improvement over last month. Maintenance downtime reduced by 15%.', 'ai'
    WHERE NOT EXISTS (SELECT 1 FROM public.dashboard_notes WHERE company_id = _company AND content LIKE 'N-08 Production at 87% OEE%');

    INSERT INTO public.dashboard_notes (company_id, user_id, dashboard_type, content, source)
    SELECT _company, _root_user, 'company_admin',
      'N-08 Inventory turnover rate is 4.2x — Titanium Bracket stock is running low, consider reordering at 200 units.', 'ai'
    WHERE NOT EXISTS (SELECT 1 FROM public.dashboard_notes WHERE company_id = _company AND content LIKE 'N-08 Inventory turnover%');

    INSERT INTO public.dashboard_notes (company_id, user_id, dashboard_type, content, source)
    SELECT _company, _root_user, 'production',
      'N-08 Work order WO-003 is at 45% — ahead of schedule by 0.5 days. MediCore order is on track for delivery.', 'ai'
    WHERE NOT EXISTS (SELECT 1 FROM public.dashboard_notes WHERE company_id = _company AND content LIKE 'N-08 Work order WO-003%');

    INSERT INTO public.dashboard_notes (company_id, user_id, dashboard_type, content, source)
    SELECT _company, _root_user, 'production',
      'N-08 Machine R-7 (Robotic Assembly) has been running for 16 days without maintenance — schedule PM soon.', 'ai'
    WHERE NOT EXISTS (SELECT 1 FROM public.dashboard_notes WHERE company_id = _company AND content LIKE 'N-08 Machine R-7%');
  END IF;

  -- =============================================================
  -- PROFILE CHANGE REQUESTS (N-08)
  -- =============================================================
  IF NOT EXISTS (SELECT 1 FROM public.profile_change_requests WHERE company_id = _company AND field_name = 'job_title') THEN
    INSERT INTO public.profile_change_requests (company_id, user_id, field_name, current_value, requested_value, status, created_at)
    VALUES (_company, _root_user, 'job_title', 'CNC Operator', 'Senior CNC Operator', 'pending', now() - interval '2 days');
  END IF;

  -- =============================================================
  -- COMPANY REGISTRATIONS (N-08)
  -- =============================================================
  IF NOT EXISTS (SELECT 1 FROM public.company_registrations WHERE company_name = 'N-08 New Manufacturing Co') THEN
    INSERT INTO public.company_registrations (company_name, email, phone, country, industry, status, created_at)
    VALUES ('N-08 New Manufacturing Co', 'founder@n08-newco.com', '+1 555-9999', 'US', 'Manufacturing', 'pending', now() - interval '1 day');
  END IF;

  -- =============================================================
  -- PLATFORM SETTINGS (N-08)
  -- =============================================================
  INSERT INTO public.platform_settings (key, value, description) VALUES
    ('default_advance_percent', '{"value": 20}', 'Default advance payment percentage for customer orders'),
    ('invoice_trigger_at', '{"value": "dispatch_ready"}', 'When to auto-generate invoices: order_approval or dispatch_ready'),
    ('po_approval_threshold', '{"value": 10000}', 'Purchase orders above this amount require Company Admin approval'),
    ('o_auth_enabled', '{"value": true}', 'Enable OAuth login (Google/GitHub)'),
    ('feature_ai_copilot', '{"value": true}', 'Enable AI Copilot features'),
    ('demo_mode', '{"value": true}', 'Show demo data across all modules')
  ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, description = EXCLUDED.description, updated_at = now();

  -- =============================================================
  -- NOTIFICATIONS (N-08) — targeted per role
  -- =============================================================
  -- Company Admin notifications
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = _company AND title LIKE 'N-08%' AND to_role = 'company_admin') THEN
    INSERT INTO public.notifications (company_id, to_role, title, body, severity, related_entity_type, is_read, created_at) VALUES
      (_company, 'company_admin', 'N-08 New Customer Order Received', 'Order N-08-ORD-003 from AeroSpace Dynamics is pending your approval.', 'info', 'customer_orders', false, now() - interval '2 hours'),
      (_company, 'company_admin', 'N-08 Customer Request Pending', 'New Buyer Corp has requested customer access — review in Customer Requests tab.', 'info', 'customer_requests', false, now() - interval '1 day'),
      (_company, 'company_admin', 'N-08 Production Milestone', 'VoltDrive order N-08-ORD-004 is now 45% complete — ahead of schedule.', 'success', 'production_planning', true, now() - interval '6 hours');
  END IF;

  -- Production Manager notifications
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = _company AND title LIKE 'N-08%' AND to_role = 'production_manager') THEN
    INSERT INTO public.notifications (company_id, to_role, title, body, severity, related_entity_type, created_at) VALUES
      (_company, 'production_manager', 'N-08 New Order to Plan', 'Order N-08-ORD-004 (VoltDrive) has been approved. Create a production plan.', 'info', 'customer_orders', now() - interval '12 hours'),
      (_company, 'production_manager', 'N-08 Material Confirmation Needed', 'Order N-08-ORD-005 needs material confirmation and advance percentage set.', 'warning', 'customer_orders', now() - interval '6 hours'),
      (_company, 'production_manager', 'N-08 Advance Payment Received', 'MediCore advance payment of $6,975 received for N-08-ORD-006. Start production.', 'success', 'customer_orders', now() - interval '1 day'),
      (_company, 'production_manager', 'N-08 Work Order Complete', 'Work order N-08-WO-001 (CNC Machining) is 100% complete — awaiting inspection.', 'info', 'work_orders', now() - interval '2 days'),
      (_company, 'production_manager', 'N-08 Machine Issue Flagged', 'EDM Machine ED-6 flagged for maintenance — work order paused.', 'warning', 'machines', now() - interval '3 days');
  END IF;

  -- Warehouse Manager notifications
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = _company AND title LIKE 'N-08%' AND to_role = 'warehouse_manager') THEN
    INSERT INTO public.notifications (company_id, to_role, title, body, severity, related_entity_type, created_at) VALUES
      (_company, 'warehouse_manager', 'N-08 Material Reservation Needed', 'Material Aluminum 6061 needed for production order N-08-PO-004.', 'warning', 'production_planning', now() - interval '1 day'),
      (_company, 'warehouse_manager', 'N-08 Finished Goods Ready', 'Finished goods from work order N-08-WO-001 ready for packing.', 'info', 'finished_goods', now() - interval '5 days'),
      (_company, 'warehouse_manager', 'N-08 Low Stock Alert', 'Servo Motor SM-400 is below reorder level (85 units remaining).', 'warning', 'inventory', now() - interval '1 day');
  END IF;

  -- Quality Inspector notifications
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = _company AND title LIKE 'N-08%' AND to_role = 'quality_inspector') THEN
    INSERT INTO public.notifications (company_id, to_role, title, body, severity, related_entity_type, created_at) VALUES
      (_company, 'quality_inspector', 'N-08 Batch Ready for Inspection', 'Work order N-08-WO-001 (250 units) completed and awaiting quality inspection.', 'info', 'work_orders', now() - interval '3 days');
  END IF;

  -- Procurement Manager notifications
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = _company AND title LIKE 'N-08%' AND to_role = 'procurement_manager') THEN
    INSERT INTO public.notifications (company_id, to_role, title, body, severity, related_entity_type, created_at) VALUES
      (_company, 'procurement_manager', 'N-08 Purchase Requisition Created', 'PR N-08-PR-002 for Titanium Grade 5 (500kg) is pending your action.', 'info', 'purchase_requisitions', now() - interval '2 days'),
      (_company, 'procurement_manager', 'N-08 PO Status Update', 'Purchase order N-08-PO-003 from Electronics & Sensors Inc has been fulfilled.', 'success', 'purchase_orders', now() - interval '3 days'),
      (_company, 'procurement_manager', 'N-08 Supplier Modified PO', 'Raw Material Masters has modified PO N-08-PO-004 — review changes.', 'warning', 'purchase_orders', now() - interval '1 day');
  END IF;

  -- Maintenance Engineer notifications
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = _company AND title LIKE 'N-08%' AND to_role = 'maintenance_engineer') THEN
    INSERT INTO public.notifications (company_id, to_role, title, body, severity, related_entity_type, created_at) VALUES
      (_company, 'maintenance_engineer', 'N-08 Machine Issue Flagged', 'EDM Machine ED-6 flagged by production — requires maintenance.', 'warning', 'machines', now() - interval '3 days'),
      (_company, 'maintenance_engineer', 'N-08 Preventive Maintenance Due', 'Robotic Assembly R-7 PM is due within 2 days — schedule inspection.', 'warning', 'machines', now() - interval '1 day');
  END IF;

  -- Finance Manager notifications
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = _company AND title LIKE 'N-08%' AND to_role = 'finance_manager') THEN
    INSERT INTO public.notifications (company_id, to_role, title, body, severity, related_entity_type, created_at) VALUES
      (_company, 'finance_manager', 'N-08 Invoice Generated', 'Invoice N-08-INV-002 for VoltDrive ($42,200) is ready to send.', 'info', 'invoices', now() - interval '2 days'),
      (_company, 'finance_manager', 'N-08 Supplier Payment Due', 'Payment for fulfilled PO N-08-PO-003 ($9,600) is ready for release.', 'info', 'purchase_orders', now() - interval '1 day');
  END IF;

  -- Customer notifications (targeted by customer_id)
  IF NOT EXISTS (SELECT 1 FROM public.notifications WHERE company_id = _company AND title LIKE 'N-08%' AND to_role = 'customer_portal') THEN
    INSERT INTO public.notifications (company_id, to_role, to_user, title, body, severity, related_entity_type, is_read, created_at) VALUES
      (_company, 'customer_portal', NULL, 'N-08 Order Approved', 'Your order N-08-ORD-001 has been approved and is now in production.', 'success', 'customer_orders', true, now() - interval '10 days'),
      (_company, 'customer_portal', NULL, 'N-08 Order Shipped', 'Your order N-08-ORD-001 has been shipped via FedEx. Track: N-08-TRK-7749102836451', 'success', 'shipments', true, now() - interval '5 days'),
      (_company, 'customer_portal', NULL, 'N-08 Order Delivered', 'Your order N-08-ORD-001 has been delivered to Chicago, IL.', 'success', 'shipments', false, now() - interval '3 days');
  END IF;

  -- =============================================================
  -- AUDIT LOGS (N-08)
  -- =============================================================
  INSERT INTO public.audit_logs (company_id, action, entity, metadata) VALUES
    (_company, 'N-08 order_approved', 'customer_orders', '{"order":"N-08-ORD-001","customer":"AeroSpace Dynamics","amount":42500}'),
    (_company, 'N-08 production_started', 'production_orders', '{"order":"N-08-PO-001","product":"Titanium Bracket","qty":250}'),
    (_company, 'N-08 quality_passed', 'quality_inspections', '{"inspection":"N-08-QI-002","result":"pass","qty":248}'),
    (_company, 'N-08 shipment_delivered', 'shipments', '{"shipment":"N-08-SHP-001","carrier":"FedEx","destination":"Chicago, IL"}'),
    (_company, 'N-08 payment_received', 'payments', '{"payment":"N-08-PAY-001","amount":8500,"type":"advance"}'),
    (_company, 'N-08 invoice_sent', 'invoices', '{"invoice":"N-08-INV-002","customer":"VoltDrive","amount":42200}'),
    (_company, 'N-08 low_stock_alert', 'inventory', '{"product":"Servo Motor SM-400","qty":85,"reorder":50}'),
    (_company, 'N-08 machine_maintenance', 'machines', '{"machine":"EDM ED-6","issue":"Flagged by production operator"}')
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- BOM (N-08)
  -- =============================================================
  INSERT INTO public.bom (company_id, product_id, version, status, notes)
  SELECT _company, p.id, 'N-08 v1.0', 'active', 'N-08 assembly BOM'
  FROM public.products p
  WHERE p.company_id = _company AND p.sku IN ('N-08-SKU-001','N-08-SKU-002','N-08-SKU-005')
  AND NOT EXISTS (SELECT 1 FROM public.bom b WHERE b.company_id = _company AND b.product_id = p.id)
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- ORDER STATUS HISTORY (N-08) — new table
  -- =============================================================
  INSERT INTO public.order_status_history (company_id, order_id, order_type, from_status, to_status, notes, created_at)
  SELECT _company, co.id, 'customer_order', 'pending_approval', 'approved',
    'Approved by Company Admin', now() - interval '12 days'
  FROM public.customer_orders co
  WHERE co.company_id = _company AND co.order_number = 'N-08-ORD-001'
  AND NOT EXISTS (SELECT 1 FROM public.order_status_history osh WHERE osh.company_id = _company AND osh.order_id = co.id AND osh.from_status = 'pending_approval')
  ON CONFLICT DO NOTHING;

  INSERT INTO public.order_status_history (company_id, order_id, order_type, from_status, to_status, notes, created_at)
  SELECT _company, co.id, 'customer_order', 'approved', 'in_production',
    'Production started by Production Manager', now() - interval '8 days'
  FROM public.customer_orders co
  WHERE co.company_id = _company AND co.order_number = 'N-08-ORD-001'
  AND NOT EXISTS (SELECT 1 FROM public.order_status_history osh WHERE osh.company_id = _company AND osh.order_id = co.id AND osh.from_status = 'approved')
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- QR CODES (N-08) — new table
  -- =============================================================
  INSERT INTO public.qr_codes (company_id, entity_type, entity_id, qr_data, qr_url)
  SELECT _company, 'invoice', inv.id,
    'https://factoryos.ai/invoice/' || inv.id,
    'https://factoryos.ai/qr/invoice/' || inv.id
  FROM public.invoices inv
  WHERE inv.company_id = _company AND inv.invoice_number IN ('N-08-INV-001','N-08-INV-002')
  AND NOT EXISTS (SELECT 1 FROM public.qr_codes qr WHERE qr.company_id = _company AND qr.entity_id = inv.id)
  ON CONFLICT DO NOTHING;

  -- =============================================================
  -- CUSTOMER DOCUMENTS (N-08) — new table
  -- =============================================================
  INSERT INTO public.customer_documents (company_id, customer_id, title, description, file_url, file_type)
  SELECT _company, _cust_aero, 'N-08 AeroSpace Master Agreement', 'Signed master supply agreement', 'https://factoryos.ai/docs/aerospace_agreement.pdf', 'pdf'
  WHERE NOT EXISTS (SELECT 1 FROM public.customer_documents WHERE company_id = _company AND customer_id = _cust_aero AND title = 'N-08 AeroSpace Master Agreement');

  INSERT INTO public.customer_documents (company_id, customer_id, title, description, file_url, file_type)
  SELECT _company, _cust_volt, 'N-08 VoltDrive Material Cert', 'Material certificates for aluminum housing', 'https://factoryos.ai/docs/voltdrive_cert.pdf', 'pdf'
  WHERE NOT EXISTS (SELECT 1 FROM public.customer_documents WHERE company_id = _company AND customer_id = _cust_volt AND title = 'N-08 VoltDrive Material Cert');

  -- =============================================================
  -- MAINTENANCE TICKETS (N-08) — only if table exists
  -- =============================================================
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'maintenance_tickets') THEN
    INSERT INTO public.maintenance_tickets (company_id, machine_id, issue, status, priority, created_at, resolved_at)
    SELECT _company, _prod_a3, 'N-08 EDM machine spindle misalignment detected', 'in_progress', 'high', now() - interval '3 days', NULL
    WHERE NOT EXISTS (SELECT 1 FROM public.maintenance_tickets WHERE company_id = _company AND machine_id = _prod_a3);
  END IF;

  -- =============================================================
  -- APPROVALS (N-08)
  -- =============================================================
  INSERT INTO public.approvals (company_id, entity, status, notes, created_at, resolved_at) VALUES
    (_company, 'purchase_requests', 'approved', 'N-08 PR-001 for 2000kg Aluminum 6061 — approved', now() - interval '10 days', now() - interval '9 days'),
    (_company, 'purchase_requests', 'pending', 'N-08 PR-002 for 500kg Titanium Grade 5 — awaiting approval', now() - interval '2 days', NULL),
    (_company, 'budgets', 'approved', 'N-08 Q3 maintenance budget — $45,000 approved', now() - interval '14 days', now() - interval '12 days'),
    (_company, 'budgets', 'pending', 'N-08 Q3 training budget — $12,000 pending HR approval', now() - interval '3 days', NULL)
  ON CONFLICT DO NOTHING;

END;
END $$;
