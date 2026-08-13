-- =====================================================================
-- 20260814000000_audit_logs_demo_seed.sql
-- Seeds a realistic demo audit trail for the ABC Manufacturing demo
-- company (11111111-1111-1111-1111-111111111111) so the Auditor role's
-- Audit Logs / Compliance / Data Export pages show meaningful, filterable
-- data out of the box.
--
-- Every event is attributed to a REAL demo user (profiles.user_id), so
-- the "Actor role" filter resolves through user_roles. Events use the
-- insert_/update_/delete_ action prefix convention so the Create /
-- Update / Delete action filter works. Events reference real record IDs
-- where they exist; otherwise they use generated UUIDs.
--
-- Idempotent: re-running deletes prior demo-seeded rows first.
-- =====================================================================

-- Clean up any previously seeded demo events (marked via metadata flag).
DELETE FROM public.audit_logs
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND metadata->>'demo_seed' = 'true';

-- Real demo actors (user_id) for company 11111111-1111-1111-1111-111111111111
-- company_admin      d28df7e5-1fe5-45ad-b03a-8801ab5c99c1  admin@abcmfg.demo
-- production_manager b2e3cbd8-8624-46d3-a6c3-f9c94f1be604  production@abcmfg.demo
-- warehouse_manager  6b23d215-610f-48e5-a6ff-18f4d7b5a6ab  warehouse@abcmfg.demo
-- procurement_manager 29d8d3ef-1606-4d47-b578-eb6bdd515ec0 procurement@abcmfg.demo
-- finance_manager    0eace4ab-8fec-4c2d-bf1a-ab5030f6c9cb  finance@abcmfg.demo
-- quality_inspector  f0441dcf-7426-4f4b-b6aa-80598f2c48ef  quality@abcmfg.demo
-- maintenance_engineer 4c77ba3b-be8f-45cb-804b-4bfecc1e965b maintenance@abcmfg.demo
-- hr_manager         b7a7b6bb-daaf-4faa-a275-fda15b3bda34  hr@abcmfg.demo
-- production_operator c6468023-3d75-4686-9474-ac4d2280afc3 operator@abcmfg.demo
-- plant_manager      017b4481-3769-4cd0-9eba-97f378f6bd30  plantmanager@abcmfg.demo
-- plant_admin        5af233f0-9a35-4ea3-a38e-7874053e9a09  plantadmin@abcmfg.demo
-- customer_portal    2accac04-8137-4728-bbd0-bb14ec13d81f  customer@abcmfg.demo
-- supplier_portal    4a4fec23-07cf-4aa3-8ccc-001a37eac179  supplier@abcmfg.demo

-- Real record IDs used below
-- SO-228064     01ded62a-360e-4b42-9e87-2da2c53805cc (sales_orders)
-- SO-DEMO-001   217a678a-a420-42f9-84ca-0329af099f2e (sales_orders)
-- SO-FRN-2026-001 98dec91f-8c16-4749-a198-d33c514f1e2d (sales_orders)
-- CNC Wood Router 5961897d-fc2a-4855-91b1-e517b4ea75ac (machines)
-- Panel Cutting Saw 66914add-5e94-47a1-aba9-e1c115e540b1 (machines)

INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_id, metadata, ip_address, created_at)
SELECT
  '11111111-1111-1111-1111-111111111111',
  user_id::uuid,
  action,
  entity,
  entity_id::uuid,
  metadata::jsonb,
  ip_address,
  created_at
FROM (VALUES
  -- Customer places a new order
  ('2accac04-8137-4728-bbd0-bb14ec13d81f', 'insert_sales_orders', 'sales_orders', '217a678a-a420-42f9-84ca-0329af099f2e',
   '{"demo_seed":"true","new_value":{"so_number":"SO-DEMO-001","status":"pending_approval","total_amount":12500}}', '192.168.1.24', now() - interval '3 days 2 hours'),

  -- Company Admin approves the order (order_approved semantic event)
  ('d28df7e5-1fe5-45ad-b03a-8801ab5c99c1', 'update_sales_orders', 'sales_orders', '217a678a-a420-42f9-84ca-0329af099f2e',
   '{"demo_seed":"true","old_value":{"status":"pending_approval"},"new_value":{"status":"approved"}}', '10.0.0.14', now() - interval '3 days 1 hour'),

  -- Production Manager confirms material + sets advance payment
  ('b2e3cbd8-8624-46d3-a6c3-f9c94f1be604', 'update_sales_orders', 'sales_orders', '217a678a-a420-42f9-84ca-0329af099f2e',
   '{"demo_seed":"true","old_value":{"status":"approved","advance_payment_status":"none"},"new_value":{"status":"awaiting_advance_payment","advance_payment_percent":20,"advance_amount":2500}}', '10.0.0.20', now() - interval '3 days'),

  -- Production Manager starts production: creates production order
  ('b2e3cbd8-8624-46d3-a6c3-f9c94f1be604', 'insert_production_orders', 'production_orders', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"order_number":"N-08-PO-101","status":"in_progress","priority":"high"}}', '10.0.0.20', now() - interval '2 days 22 hours'),

  -- Production Manager assigns a work order to the operator
  ('b2e3cbd8-8624-46d3-a6c3-f9c94f1be604', 'insert_work_orders', 'work_orders', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"wo_number":"N-08-WO-101","status":"assigned","progress_percent":0}}', '10.0.0.20', now() - interval '2 days 20 hours'),

  -- Production Operator updates progress 25% -> 50%
  ('c6468023-3d75-4686-9474-ac4d2280afc3', 'update_work_orders', 'work_orders', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"progress_percent":25},"new_value":{"progress_percent":50}}', '192.168.1.31', now() - interval '2 days 6 hours'),

  -- Operator flags a machine issue -> maintenance ticket created
  ('c6468023-3d75-4686-9474-ac4d2280afc3', 'insert_maintenance_tickets', 'maintenance_tickets', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"machine":"CNC Wood Router","status":"open","priority":"high"}}', '192.168.1.31', now() - interval '2 days 4 hours'),

  -- Maintenance Engineer resolves the ticket
  ('4c77ba3b-be8f-45cb-804b-4bfecc1e965b', 'update_maintenance_tickets', 'maintenance_tickets', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"status":"open"},"new_value":{"status":"resolved","resolution":"Replaced spindle bearing"}}', '10.0.0.27', now() - interval '2 days 2 hours'),

  -- Warehouse records goods receipt -> inventory insert
  ('6b23d215-610f-48e5-a6ff-18f4d7b5a6ab', 'insert_inventory', 'inventory', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"product_id":null,"quantity":500,"status":"in_stock"}}', '10.0.0.16', now() - interval '2 days'),

  -- Warehouse adjusts stock (cycle count correction)
  ('6b23d215-610f-48e5-a6ff-18f4d7b5a6ab', 'update_inventory', 'inventory', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"quantity":480},"new_value":{"quantity":500,"reason":"cycle count correction"}}', '10.0.0.16', now() - interval '1 day 20 hours'),

  -- Procurement creates a purchase order
  ('29d8d3ef-1606-4d47-b578-eb6bdd515ec0', 'insert_purchase_orders', 'purchase_orders', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"po_number":"N-08-PO-201","status":"pending","total_amount":18000}}', '10.0.0.22', now() - interval '1 day 16 hours'),

  -- Supplier accepts the PO
  ('4a4fec23-07cf-4aa3-8ccc-001a37eac179', 'update_purchase_orders', 'purchase_orders', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"status":"pending"},"new_value":{"status":"accepted"}}', '203.0.113.9', now() - interval '1 day 12 hours'),

  -- Finance generates the invoice
  ('0eace4ab-8fec-4c2d-bf1a-ab5030f6c9cb', 'insert_invoices', 'invoices', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"invoice_number":"N-08-INV-301","status":"pending","total_amount":12500}}', '10.0.0.18', now() - interval '1 day 8 hours'),

  -- Finance records the advance payment received
  ('0eace4ab-8fec-4c2d-bf1a-ab5030f6c9cb', 'insert_payments', 'payments', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"payment_number":"N-08-PAY-401","amount":2500,"method":"bank_transfer","status":"completed"}}', '10.0.0.18', now() - interval '1 day 6 hours'),

  -- Finance marks the invoice paid
  ('0eace4ab-8fec-4c2d-bf1a-ab5030f6c9cb', 'update_invoices', 'invoices', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"status":"pending","amount_paid":2500},"new_value":{"status":"paid","amount_paid":12500}}', '10.0.0.18', now() - interval '1 day 5 hours'),

  -- Quality Inspector passes a batch -> finished goods ready
  ('f0441dcf-7426-4f4b-b6aa-80598f2c48ef', 'insert_quality_inspections', 'quality_inspections', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"inspection_number":"N-08-QC-501","result":"pass","defects":0}}', '10.0.0.25', now() - interval '1 day 4 hours'),

  -- Quality Inspector fails a batch (separate event)
  ('f0441dcf-7426-4f4b-b6aa-80598f2c48ef', 'update_quality_inspections', 'quality_inspections', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"result":"pending"},"new_value":{"result":"fail","rejection_reason":"Surface finish tolerance exceeded"}}', '10.0.0.25', now() - interval '1 day 3 hours'),

  -- Warehouse dispatches a shipment
  ('6b23d215-610f-48e5-a6ff-18f4d7b5a6ab', 'insert_shipments', 'shipments', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"shipment_number":"N-08-SHP-601","status":"shipped"}}', '10.0.0.16', now() - interval '1 day'),

  -- Plant Admin adds a machine to the fleet
  ('5af233f0-9a35-4ea3-a38e-7874053e9a09', 'insert_machines', 'machines', '5961897d-fc2a-4855-91b1-e517b4ea75ac',
   '{"demo_seed":"true","new_value":{"name":"CNC Wood Router","status":"operational"}}', '10.0.0.12', now() - interval '20 hours'),

  -- Plant Manager puts a machine into maintenance
  ('017b4481-3769-4cd0-9eba-97f378f6bd30', 'update_machines', 'machines', '66914add-5e94-47a1-aba9-e1c115e540b1',
   '{"demo_seed":"true","old_value":{"status":"operational"},"new_value":{"status":"maintenance","reason":"scheduled calibration"}}', '10.0.0.11', now() - interval '16 hours'),

  -- HR creates a new employee record
  ('b7a7b6bb-daaf-4faa-a275-fda15b3bda34', 'insert_employees', 'employees', gen_random_uuid(),
   '{"demo_seed":"true","new_value":{"full_name":"Demo Hire","department":"Production","status":"active"}}', '10.0.0.15', now() - interval '12 hours'),

  -- Company Admin updates a customer record
  ('d28df7e5-1fe5-45ad-b03a-8801ab5c99c1', 'update_customers', 'customers', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"credit_limit":10000},"new_value":{"credit_limit":25000}}', '10.0.0.14', now() - interval '8 hours'),

  -- Company Admin removes an inactive supplier
  ('d28df7e5-1fe5-45ad-b03a-8801ab5c99c1', 'delete_suppliers', 'suppliers', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"name":"Inactive Vendor Ltd","status":"inactive"}}', '10.0.0.14', now() - interval '6 hours'),

  -- Production Manager updates the production order progress
  ('b2e3cbd8-8624-46d3-a6c3-f9c94f1be604', 'update_production_orders', 'production_orders', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"progress":60},"new_value":{"progress":80}}', '10.0.0.20', now() - interval '4 hours'),

  -- Finance adjusts a payment record (refund)
  ('0eace4ab-8fec-4c2d-bf1a-ab5030f6c9cb', 'update_payments', 'payments', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"amount":2500,"status":"completed"},"new_value":{"amount":2500,"status":"refunded"}}', '10.0.0.18', now() - interval '2 hours'),

  -- Procurement deletes an obsolete purchase request
  ('29d8d3ef-1606-4d47-b578-eb6bdd515ec0', 'delete_purchase_requests', 'purchase_requests', gen_random_uuid(),
   '{"demo_seed":"true","old_value":{"pr_number":"N-08-PR-099","status":"draft"}}', '10.0.0.22', now() - interval '1 hour'),

  -- Production Manager creates a manual sales order (internal entry) so
  -- the Production Manager / Sales Orders / Create filter combo has data
  ('b2e3cbd8-8624-46d3-a6c3-f9c94f1be604', 'insert_sales_orders', 'sales_orders', '98dec91f-8c16-4749-a198-d33c514f1e2d',
   '{"demo_seed":"true","new_value":{"so_number":"SO-FRN-2026-001","status":"pending","total_amount":8900}}', '10.0.0.20', now() - interval '30 minutes')
) AS demo(user_id, action, entity, entity_id, metadata, ip_address, created_at);

-- Ensure the insert trigger that mirrors user-driven writes doesn't
-- double-log these (audit_logs has no write trigger on itself), and
-- confirm the seed landed.
SELECT count(*) AS seeded_demo_events
FROM public.audit_logs
WHERE company_id = '11111111-1111-1111-1111-111111111111'
  AND metadata->>'demo_seed' = 'true';
