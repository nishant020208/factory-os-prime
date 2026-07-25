-- ============================================================
-- DEMO DATA: 3 Customers with Complete Order Lifecycles
-- For ABC Manufacturing (company_id: 11111111-...)
-- ============================================================

-- ============================================================
-- CUSTOMER 1: AeroSpace Dynamics (COMPLETED ORDER)
-- ============================================================
INSERT INTO public.customers (company_id, name, contact_email, contact_phone, segment, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'AeroSpace Dynamics', 'orders@aerospacedynamics.com', '+1 313-555-0101', 'Aerospace', 'active')
ON CONFLICT DO NOTHING;

-- Customer 1: Completed Production Orders
INSERT INTO public.production_orders (company_id, order_number, quantity, status, priority, progress, due_date, start_date)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'SO-2026-001', 250, 'completed', 'high', 100, now() - interval '5 days', now() - interval '15 days'),
  ('11111111-1111-1111-1111-111111111111', 'SO-2026-002', 100, 'completed', 'normal', 100, now() - interval '3 days', now() - interval '10 days')
ON CONFLICT DO NOTHING;

-- Customer 1: Purchase Orders for materials
INSERT INTO public.purchase_orders (company_id, po_number, status, total_amount, expected_date)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'PUR-2026-0101', 'received', 42500.00, now() - interval '12 days'),
  ('11111111-1111-1111-1111-111111111111', 'PUR-2026-0102', 'received', 18750.00, now() - interval '8 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CUSTOMER 2: VoltDrive Electric (COMPLETED ORDER)
-- ============================================================
INSERT INTO public.customers (company_id, name, contact_email, contact_phone, segment, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'VoltDrive Electric', 'procurement@voltdrive.com', '+1 512-555-0202', 'Automotive', 'active')
ON CONFLICT DO NOTHING;

-- Customer 2: Completed Production Orders
INSERT INTO public.production_orders (company_id, order_number, quantity, status, priority, progress, due_date, start_date)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'SO-2026-003', 500, 'completed', 'critical', 100, now() - interval '2 days', now() - interval '20 days'),
  ('11111111-1111-1111-1111-111111111111', 'SO-2026-004', 200, 'completed', 'normal', 100, now() - interval '1 day', now() - interval '12 days')
ON CONFLICT DO NOTHING;

-- Customer 2: Purchase Orders for materials
INSERT INTO public.purchase_orders (company_id, po_number, status, total_amount, expected_date)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'PUR-2026-0103', 'received', 63200.00, now() - interval '18 days'),
  ('11111111-1111-1111-1111-111111111111', 'PUR-2026-0104', 'received', 21000.00, now() - interval '10 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- CUSTOMER 3: MediCore HealthTech (IN PROGRESS)
-- ============================================================
INSERT INTO public.customers (company_id, name, contact_email, contact_phone, segment, status)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'MediCore HealthTech', 'buying@medicore.health', '+1 408-555-0303', 'Medical', 'active')
ON CONFLICT DO NOTHING;

-- Customer 3: In-Progress Production Orders
INSERT INTO public.production_orders (company_id, order_number, quantity, status, priority, progress, due_date, start_date)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'SO-2026-005', 150, 'in_progress', 'critical', 45, now() + interval '7 days', now() - interval '3 days'),
  ('11111111-1111-1111-1111-111111111111', 'SO-2026-006', 300, 'planned', 'high', 0, now() + interval '14 days', null)
ON CONFLICT DO NOTHING;

-- Customer 3: Purchase Orders for materials (in progress)
INSERT INTO public.purchase_orders (company_id, po_number, status, total_amount, expected_date)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'PUR-2026-0105', 'approved', 35400.00, now() + interval '5 days'),
  ('11111111-1111-1111-1111-111111111111', 'PUR-2026-0106', 'pending', 12800.00, now() + interval '10 days')
ON CONFLICT DO NOTHING;

-- ============================================================
-- AUDIT LOGS for all activities
-- ============================================================
INSERT INTO public.audit_logs (company_id, action, entity, entity_id, metadata)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'customer_created', 'customers', null, '{"name": "AeroSpace Dynamics"}'),
  ('11111111-1111-1111-1111-111111111111', 'customer_created', 'customers', null, '{"name": "VoltDrive Electric"}'),
  ('11111111-1111-1111-1111-111111111111', 'customer_created', 'customers', null, '{"name": "MediCore HealthTech"}'),
  ('11111111-1111-1111-1111-111111111111', 'production_completed', 'production_orders', null, '{"order": "SO-2026-001", "customer": "AeroSpace Dynamics"}'),
  ('11111111-1111-1111-1111-111111111111', 'production_completed', 'production_orders', null, '{"order": "SO-2026-003", "customer": "VoltDrive Electric"}'),
  ('11111111-1111-1111-1111-111111111111', 'production_in_progress', 'production_orders', null, '{"order": "SO-2026-005", "customer": "MediCore HealthTech", "progress": 45}')
ON CONFLICT DO NOTHING;

-- ============================================================
-- NOTIFICATIONS for all activities
-- ============================================================
INSERT INTO public.notifications (company_id, title, body, severity)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Order Completed', 'SO-2026-001 for AeroSpace Dynamics completed (250 units)', 'success'),
  ('11111111-1111-1111-1111-111111111111', 'Order Completed', 'SO-2026-003 for VoltDrive Electric completed (500 units)', 'success'),
  ('11111111-1111-1111-1111-111111111111', 'Production In Progress', 'SO-2026-005 for MediCore HealthTech at 45% completion', 'info'),
  ('11111111-1111-1111-1111-111111111111', 'PO Received', 'PUR-2026-0101 received ($42,500)', 'success'),
  ('11111111-1111-1111-1111-111111111111', 'PO Received', 'PUR-2026-0103 received ($63,200)', 'success'),
  ('11111111-1111-1111-1111-111111111111', 'PO Pending Approval', 'PUR-2026-0106 for $12,800 needs approval', 'warning')
ON CONFLICT DO NOTHING;
