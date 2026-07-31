-- =============================================================
-- FACTORYOS AI — RE-SEED DEMO WHITELIST ENTRIES
-- The whitelist table was seeded in migration 20260723172804
-- but got wiped during DB resets. Re-seed all 15 demo accounts
-- with their correct roles, company_id, and plant_id.
-- Uses ON CONFLICT (email, role) DO NOTHING for idempotency.
-- This exact SQL was already applied to the remote DB.
-- =============================================================
INSERT INTO public.whitelist (email, role, company_id, plant_id) VALUES
  ('root@factoryos.demo',    'root_super_admin',     NULL,                                                       NULL),
  ('admin@abcmfg.demo',      'company_admin',        '11111111-1111-1111-1111-111111111111',                     NULL),
  ('plantadmin@abcmfg.demo', 'plant_admin',           '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('plantmanager@abcmfg.demo', 'plant_manager',       '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('production@abcmfg.demo', 'production_manager',    '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('warehouse@abcmfg.demo',  'warehouse_manager',     '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('procurement@abcmfg.demo', 'procurement_manager',  '11111111-1111-1111-1111-111111111111', NULL),
  ('quality@abcmfg.demo',    'quality_inspector',     '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('maintenance@abcmfg.demo', 'maintenance_engineer', '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('finance@abcmfg.demo',    'finance_manager',       '11111111-1111-1111-1111-111111111111', NULL),
  ('hr@abcmfg.demo',         'hr_manager',            '11111111-1111-1111-1111-111111111111', NULL),
  ('operator@abcmfg.demo',   'production_operator',   '11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222'),
  ('customer@abcmfg.demo',   'customer_portal',       '11111111-1111-1111-1111-111111111111', NULL),
  ('supplier@abcmfg.demo',   'supplier_portal',       '11111111-1111-1111-1111-111111111111', NULL),
  ('auditor@abcmfg.demo',    'auditor',               '11111111-1111-1111-1111-111111111111', NULL)
ON CONFLICT (email, role) DO NOTHING;