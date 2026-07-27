-- =============================================================
-- FACTORYOS AI — EXTERNAL SUPABASE CONNECTION FIX
-- Run this in your new Supabase project's SQL Editor
-- Creates missing tables, functions, RLS policies for full functionality
-- =============================================================

-- ===================== MISSING TABLES ============================

-- 1. Profile change requests
CREATE TABLE IF NOT EXISTS public.profile_change_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  field_name text NOT NULL,
  current_value text,
  requested_value text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  approver_id uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.profile_change_requests TO authenticated;
GRANT ALL ON public.profile_change_requests TO service_role;
ALTER TABLE public.profile_change_requests ENABLE ROW LEVEL SECURITY;

-- 2. Order status history
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  order_id uuid NOT NULL,
  order_type text NOT NULL DEFAULT 'sales_order',
  from_status text,
  to_status text NOT NULL,
  changed_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.order_status_history TO authenticated;
GRANT ALL ON public.order_status_history TO service_role;
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

-- 3. QR codes
CREATE TABLE IF NOT EXISTS public.qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  qr_data text NOT NULL,
  qr_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
GRANT SELECT, INSERT ON public.qr_codes TO authenticated;
GRANT ALL ON public.qr_codes TO service_role;
ALTER TABLE public.qr_codes ENABLE ROW LEVEL SECURITY;

-- 4. Company registrations (for Register your company flow)
CREATE TABLE IF NOT EXISTS public.company_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  legal_name text,
  email text NOT NULL,
  phone text,
  country text DEFAULT 'US',
  industry text,
  registration_data jsonb,
  status text NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.company_registrations TO authenticated;
GRANT ALL ON public.company_registrations TO service_role;
ALTER TABLE public.company_registrations ENABLE ROW LEVEL SECURITY;

-- 5. Platform settings
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.platform_settings TO authenticated;
GRANT ALL ON public.platform_settings TO service_role;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- 6. Customer documents
CREATE TABLE IF NOT EXISTS public.customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  customer_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  file_url text NOT NULL,
  file_type text,
  file_size integer,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.customer_documents TO authenticated;
GRANT ALL ON public.customer_documents TO service_role;
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

-- 7. Employee department assignments (many-to-many)
CREATE TABLE IF NOT EXISTS public.employee_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  employee_id uuid NOT NULL,
  department_id uuid NOT NULL,
  is_primary boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(employee_id, department_id)
);
GRANT SELECT, INSERT, DELETE ON public.employee_departments TO authenticated;
GRANT ALL ON public.employee_departments TO service_role;
ALTER TABLE public.employee_departments ENABLE ROW LEVEL SECURITY;

-- 8. Inventory adjustment log
CREATE TABLE IF NOT EXISTS public.inventory_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  product_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  old_quantity numeric NOT NULL,
  new_quantity numeric NOT NULL,
  delta numeric NOT NULL,
  reason text NOT NULL,
  adjusted_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.inventory_adjustments TO authenticated;
GRANT ALL ON public.inventory_adjustments TO service_role;
ALTER TABLE public.inventory_adjustments ENABLE ROW LEVEL SECURITY;

-- 9. Dashboard notes (AI Copilot notes)
CREATE TABLE IF NOT EXISTS public.dashboard_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  user_id uuid NOT NULL,
  dashboard_type text NOT NULL,
  content text NOT NULL,
  source text DEFAULT 'ai',
  is_pinned boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.dashboard_notes TO authenticated;
GRANT ALL ON public.dashboard_notes TO service_role;
ALTER TABLE public.dashboard_notes ENABLE ROW LEVEL SECURITY;

-- ===================== MISSING COLUMNS ===========================

ALTER TABLE public.production_orders ADD COLUMN IF NOT EXISTS sales_order_id uuid;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS qr_code_url text;
ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS qr_code_data text;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS approved_by uuid;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS approved_at timestamptz;
ALTER TABLE public.sales_orders ADD COLUMN IF NOT EXISTS rejection_reason text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS invoice_qr_at_approval boolean DEFAULT true;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS registration_number text;
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS plan_tier text DEFAULT 'starter';
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS address text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferences jsonb DEFAULT '{}'::jsonb;

-- ===================== MISSING FUNCTIONS ===========================

-- Check if current user is an auditor
CREATE OR REPLACE FUNCTION public.is_auditor() RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'auditor'
  );
$$ LANGUAGE sql STABLE;

-- Check if current user is root admin
CREATE OR REPLACE FUNCTION public.is_root_admin(_user_id uuid DEFAULT auth.uid()) RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'root_super_admin'
  );
$$ LANGUAGE sql STABLE;

-- Get current company ID
CREATE OR REPLACE FUNCTION public.current_company_id() RETURNS uuid AS $$
  SELECT company_id FROM public.user_roles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$ LANGUAGE sql STABLE;

-- Notification + audit log helper
CREATE OR REPLACE FUNCTION public.create_order_notification(
  _company_id uuid,
  _user_id uuid,
  _title text,
  _body text,
  _severity text DEFAULT 'info',
  _entity text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _action text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.notifications (company_id, user_id, title, body, severity)
  VALUES (_company_id, _user_id, _title, _body, _severity);
  IF _action IS NOT NULL THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_id, metadata)
    VALUES (_company_id, _user_id, _action, _entity, _entity_id,
      jsonb_build_object('title', _title, 'body', _body));
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Status transition recorder
CREATE OR REPLACE FUNCTION public.record_status_transition(
  _company_id uuid,
  _order_id uuid,
  _order_type text,
  _from_status text,
  _to_status text,
  _changed_by uuid,
  _notes text DEFAULT NULL
) RETURNS void AS $$
BEGIN
  INSERT INTO public.order_status_history (company_id, order_id, order_type, from_status, to_status, changed_by, notes)
  VALUES (_company_id, _order_id, _order_type, _from_status, _to_status, _changed_by, _notes);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ===================== RLS POLICIES ===========================

-- --- Company Registrations ---
-- PUBLIC POLICY: Allow anonymous users to submit registration requests
-- This is essential for the "Register your company" flow on the auth page
DROP POLICY IF EXISTS cr_anon_insert ON public.company_registrations;
CREATE POLICY cr_anon_insert ON public.company_registrations FOR INSERT TO anon
  WITH CHECK (true);

-- Allow authenticated users to read registrations (for pending queue)
DROP POLICY IF EXISTS cr_select ON public.company_registrations;
CREATE POLICY cr_select ON public.company_registrations FOR SELECT TO authenticated USING (true);

-- Allow authenticated users (non-auditor) to insert
DROP POLICY IF EXISTS cr_insert ON public.company_registrations;
CREATE POLICY cr_insert ON public.company_registrations FOR INSERT TO authenticated
  WITH CHECK (NOT is_auditor());

-- Allow root admin to update registrations (approve/reject)
DROP POLICY IF EXISTS cr_update ON public.company_registrations;
CREATE POLICY cr_update ON public.company_registrations FOR UPDATE TO authenticated
  USING (is_root_admin() AND NOT is_auditor());

-- --- Profile Change Requests ---
DROP POLICY IF EXISTS pcr_select ON public.profile_change_requests;
CREATE POLICY pcr_select ON public.profile_change_requests FOR SELECT TO authenticated
  USING (is_root_admin() OR company_id = current_company_id());
DROP POLICY IF EXISTS pcr_insert ON public.profile_change_requests;
CREATE POLICY pcr_insert ON public.profile_change_requests FOR INSERT TO authenticated
  WITH CHECK ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());
DROP POLICY IF EXISTS pcr_update ON public.profile_change_requests;
CREATE POLICY pcr_update ON public.profile_change_requests FOR UPDATE TO authenticated
  USING ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor())
  WITH CHECK ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());

-- --- Order Status History ---
DROP POLICY IF EXISTS osh_select ON public.order_status_history;
CREATE POLICY osh_select ON public.order_status_history FOR SELECT TO authenticated
  USING (is_root_admin() OR company_id = current_company_id());
DROP POLICY IF EXISTS osh_insert ON public.order_status_history;
CREATE POLICY osh_insert ON public.order_status_history FOR INSERT TO authenticated
  WITH CHECK ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());

-- --- QR Codes ---
DROP POLICY IF EXISTS qr_select ON public.qr_codes;
CREATE POLICY qr_select ON public.qr_codes FOR SELECT TO authenticated
  USING (is_root_admin() OR company_id = current_company_id());
DROP POLICY IF EXISTS qr_insert ON public.qr_codes;
CREATE POLICY qr_insert ON public.qr_codes FOR INSERT TO authenticated
  WITH CHECK ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());

-- --- Platform Settings ---
DROP POLICY IF EXISTS ps_select ON public.platform_settings;
CREATE POLICY ps_select ON public.platform_settings FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS ps_all ON public.platform_settings;
CREATE POLICY ps_all ON public.platform_settings FOR ALL TO authenticated
  USING (is_root_admin())
  WITH CHECK (is_root_admin());

-- --- Dashboard Notes ---
DROP POLICY IF EXISTS dn_select ON public.dashboard_notes;
CREATE POLICY dn_select ON public.dashboard_notes FOR SELECT TO authenticated
  USING (is_root_admin() OR company_id = current_company_id());
DROP POLICY IF EXISTS dn_insert ON public.dashboard_notes;
CREATE POLICY dn_insert ON public.dashboard_notes FOR INSERT TO authenticated
  WITH CHECK ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());
DROP POLICY IF EXISTS dn_update ON public.dashboard_notes;
CREATE POLICY dn_update ON public.dashboard_notes FOR UPDATE TO authenticated
  USING ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());
DROP POLICY IF EXISTS dn_delete ON public.dashboard_notes;
CREATE POLICY dn_delete ON public.dashboard_notes FOR DELETE TO authenticated
  USING ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());

-- --- Inventory Adjustments ---
DROP POLICY IF EXISTS ia_select ON public.inventory_adjustments;
CREATE POLICY ia_select ON public.inventory_adjustments FOR SELECT TO authenticated
  USING (is_root_admin() OR company_id = current_company_id());
DROP POLICY IF EXISTS ia_insert ON public.inventory_adjustments;
CREATE POLICY ia_insert ON public.inventory_adjustments FOR INSERT TO authenticated
  WITH CHECK ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());

-- --- Customer Documents ---
DROP POLICY IF EXISTS cd_select ON public.customer_documents;
CREATE POLICY cd_select ON public.customer_documents FOR SELECT TO authenticated
  USING (is_root_admin() OR company_id = current_company_id());
DROP POLICY IF EXISTS cd_insert ON public.customer_documents;
CREATE POLICY cd_insert ON public.customer_documents FOR INSERT TO authenticated
  WITH CHECK ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());
DROP POLICY IF EXISTS cd_delete ON public.customer_documents;
CREATE POLICY cd_delete ON public.customer_documents FOR DELETE TO authenticated
  USING ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());

-- --- Employee Departments ---
DROP POLICY IF EXISTS ed_select ON public.employee_departments;
CREATE POLICY ed_select ON public.employee_departments FOR SELECT TO authenticated
  USING (is_root_admin() OR company_id = current_company_id());
DROP POLICY IF EXISTS ed_insert ON public.employee_departments;
CREATE POLICY ed_insert ON public.employee_departments FOR INSERT TO authenticated
  WITH CHECK ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());
DROP POLICY IF EXISTS ed_delete ON public.employee_departments;
CREATE POLICY ed_delete ON public.employee_departments FOR DELETE TO authenticated
  USING ((is_root_admin() OR company_id = current_company_id()) AND NOT is_auditor());

-- ===================== AUDITOR READ-ONLY ON EXISTING TABLES ====================

-- Apply read-only policies to all existing operational tables for Auditor role
DO $$
DECLARE
  tables_list text[] := ARRAY[
    'companies', 'profiles', 'user_roles', 'plants', 'departments',
    'products', 'product_categories', 'bom', 'bom_items',
    'inventory', 'warehouses',
    'sales_orders', 'sales_order_items', 'production_orders', 'work_orders',
    'purchase_orders', 'suppliers',
    'quality_inspections', 'machines',
    'invoices', 'payments', 'payroll',
    'employees', 'attendance',
    'notifications', 'audit_logs', 'documents', 'whitelist',
    'customers', 'support_tickets', 'tasks',
    'knowledge_articles', 'shipments'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables_list
  LOOP
    EXECUTE format('
      DROP POLICY IF EXISTS %I ON public.%I',
      t || '_auditor_select', t
    );
    EXECUTE format('
      CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)',
      t || '_auditor_select', t
    );
  END LOOP;
END $$;

-- ===================== REALTIME PUBLICATION ===================
DO $$ BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname='supabase_realtime';
  IF FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.profile_change_requests';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.order_status_history';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.qr_codes';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.company_registrations';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.platform_settings';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_documents';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.employee_departments';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory_adjustments';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.dashboard_notes';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
