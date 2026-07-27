-- =============================================================
-- FACTORYOS AI — CUSTOMER ORDER LIFECYCLE (COMPLETE)
-- Tables, RLS policies, functions for the end-to-end flow
-- =============================================================

-- ===================== 1. CUSTOMER REQUESTS ===================
-- Company-specific pre-approval signup
CREATE TABLE IF NOT EXISTS public.customer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  business_name text NOT NULL,
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text,
  gst_number text,
  address text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','rejected')),
  rejection_reason text,
  created_at timestamptz DEFAULT now(),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz
);
GRANT SELECT, INSERT, UPDATE ON public.customer_requests TO authenticated;
GRANT ALL ON public.customer_requests TO service_role;
ALTER TABLE public.customer_requests ENABLE ROW LEVEL SECURITY;

-- Customer can INSERT and SELECT their own pending request; Company Admin sees all for their company
CREATE POLICY cr_insert_own ON public.customer_requests FOR INSERT TO authenticated
  WITH CHECK (email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin' AND company_id = customer_requests.company_id)));
CREATE POLICY cr_select_company ON public.customer_requests FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR
    email = (SELECT email FROM auth.users WHERE id = auth.uid()));
CREATE POLICY cr_update_company ON public.customer_requests FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin')))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin')));

-- ===================== 2. CUSTOMERS TABLE (ALTER existing) =====
-- The customers table already exists from migration 1 with columns:
-- id, company_id, name, contact_email, contact_phone, segment, status, created_at
-- We ADD new columns needed for the lifecycle and create new RLS policies.
-- Do NOT CREATE TABLE — ALTER the existing one.

ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS business_name text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS contact_person text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS gst_number text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS billing_address text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS shipping_address text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS credit_limit numeric(14,2) DEFAULT 0;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Add email and phone columns FIRST, before using them
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS phone text;

-- Copy existing name → business_name if business_name is null
UPDATE public.customers SET business_name = name WHERE business_name IS NULL AND name IS NOT NULL;
UPDATE public.customers SET email = contact_email WHERE email IS NULL AND contact_email IS NOT NULL;
UPDATE public.customers SET phone = contact_phone WHERE phone IS NULL AND contact_phone IS NOT NULL;

GRANT SELECT, INSERT, UPDATE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;

-- Drop old RLS policies and recreate
DROP POLICY IF EXISTS "customers_all" ON public.customers;
DROP POLICY IF EXISTS "customers_select" ON public.customers;
DROP POLICY IF EXISTS cust_select_own ON public.customers;
DROP POLICY IF EXISTS cust_insert_company ON public.customers;
DROP POLICY IF EXISTS cust_update_company ON public.customers;

CREATE POLICY cust_select_own ON public.customers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY cust_insert_company ON public.customers FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY cust_update_company ON public.customers FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ===================== 3. MATERIALS ============================
-- Company Admin owned master list for customer dropdown + PM confirmation
CREATE TABLE IF NOT EXISTS public.materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  unit text NOT NULL DEFAULT 'pcs',
  unit_cost numeric(12,2) DEFAULT 0,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.materials TO authenticated;
GRANT ALL ON public.materials TO service_role;
ALTER TABLE public.materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY mat_select_company ON public.materials FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY mat_write_company ON public.materials FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','production_manager'))));
CREATE POLICY mat_update_company ON public.materials FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','production_manager'))))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','production_manager'))));
CREATE POLICY mat_delete_company ON public.materials FOR DELETE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) AND
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin')));

-- Add material_id column to existing inventory table if not present
ALTER TABLE public.inventory ADD COLUMN IF NOT EXISTS material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL;

-- ===================== 4. CUSTOMER ORDERS ======================
-- Full lifecycle order tracking
CREATE TABLE IF NOT EXISTS public.customer_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  product text NOT NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL DEFAULT 1,
  delivery_date date,
  priority text DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  file_upload_url text,
  notes text,
  status text NOT NULL DEFAULT 'pending_approval'
    CHECK (status IN (
      'pending_approval','approved','rejected','changes_requested',
      'material_confirmed','awaiting_advance_payment',
      'advance_paid','in_production','material_reserved',
      'procurement_pending','quality_failed','dispatch_ready',
      'out_for_delivery','delivered','completed',
      'cancelled','refund_pending'
    )),
  rejection_reason text,
  order_total numeric(12,2),
  advance_payment_percent numeric(5,2) DEFAULT 20.00,
  advance_amount numeric(12,2),
  advance_payment_status text DEFAULT 'unpaid'
    CHECK (advance_payment_status IN ('unpaid','paid','refund_pending','refunded')),
  advance_qr_url text,
  balance_due numeric(12,2),
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.customer_orders TO authenticated;
GRANT ALL ON public.customer_orders TO service_role;
ALTER TABLE public.customer_orders ENABLE ROW LEVEL SECURITY;

-- Customer: INSERT + SELECT own; Company Admin/PM: SELECT + UPDATE their company's
CREATE POLICY co_insert_customer ON public.customer_orders FOR INSERT TO authenticated
  WITH CHECK (customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
CREATE POLICY co_select_company ON public.customer_orders FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()) OR
    customer_id IN (SELECT id FROM public.customers WHERE user_id = auth.uid()));
CREATE POLICY co_update_company ON public.customer_orders FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ===================== 5. NOTIFICATIONS (extend existing) ======
-- The notifications table already exists. Add new columns for targeted delivery.
-- Old column `user_id` was the recipient; new `to_user` serves the same purpose.
-- Keep `user_id` for backward compat with existing code.
DO $$ BEGIN
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS from_user uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS to_role text;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS to_user uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_type text;
  ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS related_entity_id uuid;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Each user sees only notifications meant for them
DROP POLICY IF EXISTS "notifications_select" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update" ON public.notifications;
DROP POLICY IF EXISTS "notifications_insert_own_company" ON public.notifications;

CREATE POLICY notif_select_targeted ON public.notifications FOR SELECT TO authenticated
  USING (
    to_user = auth.uid() OR
    (to_role IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role::text = notifications.to_role AND company_id = notifications.company_id
    )) OR
    (SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin' AND company_id = notifications.company_id)) OR
    user_id = auth.uid()  -- backward compat: old-style notifications where user_id is set directly
  );
CREATE POLICY notif_insert_company ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY notif_update_own ON public.notifications FOR UPDATE TO authenticated
  USING (to_user = auth.uid() OR user_id = auth.uid())
  WITH CHECK (to_user = auth.uid() OR user_id = auth.uid());

-- Indexes moved to migration 20260727000003 (notifications_role_target) which
-- creates them after all columns are added in the correct order.

-- ===================== 6. PRODUCTION PLANNING ==================
CREATE TABLE IF NOT EXISTS public.production_planning (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_order_id uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  order_number text NOT NULL,
  status text NOT NULL DEFAULT 'planned'
    CHECK (status IN ('planned','material_reserved','procurement_pending','in_progress','completed')),
  priority text DEFAULT 'normal',
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity numeric(12,2),
  start_date date,
  due_date date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.production_planning TO authenticated;
GRANT ALL ON public.production_planning TO service_role;
ALTER TABLE public.production_planning ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_select_company ON public.production_planning FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY pp_insert_company ON public.production_planning FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY pp_update_company ON public.production_planning FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ===================== 7. FINISHED GOODS =======================
CREATE TABLE IF NOT EXISTS public.finished_goods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  work_order_id uuid,
  production_planning_id uuid REFERENCES public.production_planning(id) ON DELETE SET NULL,
  customer_order_id uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  product text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  quality_certificate_url text,
  qr_code_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT ON public.finished_goods TO authenticated;
GRANT ALL ON public.finished_goods TO service_role;
ALTER TABLE public.finished_goods ENABLE ROW LEVEL SECURITY;

CREATE POLICY fg_select_company ON public.finished_goods FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY fg_insert_company ON public.finished_goods FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ===================== 8. PACKING ==============================
CREATE TABLE IF NOT EXISTS public.packing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  finished_goods_id uuid REFERENCES public.finished_goods(id) ON DELETE SET NULL,
  package_number text NOT NULL,
  quantity numeric(12,2) NOT NULL,
  package_qr_url text,
  notes text,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT ON public.packing TO authenticated;
GRANT ALL ON public.packing TO service_role;
ALTER TABLE public.packing ENABLE ROW LEVEL SECURITY;

CREATE POLICY pck_select_company ON public.packing FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY pck_insert_company ON public.packing FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- ===================== 9. PURCHASE REQUISITIONS ================
CREATE TABLE IF NOT EXISTS public.purchase_requisitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  production_planning_id uuid REFERENCES public.production_planning(id) ON DELETE SET NULL,
  pr_number text NOT NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','ordered')),
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.purchase_requisitions TO authenticated;
GRANT ALL ON public.purchase_requisitions TO service_role;
ALTER TABLE public.purchase_requisitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY pr_select_company ON public.purchase_requisitions FOR SELECT TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY pr_insert_company ON public.purchase_requisitions FOR INSERT TO authenticated
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY pr_update_company ON public.purchase_requisitions FOR UPDATE TO authenticated
  USING (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()))
  WITH CHECK (company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid()));

-- Composite index for customer_orders queries (filtered by company_id + status)
CREATE INDEX IF NOT EXISTS idx_customer_orders_status ON public.customer_orders (company_id, status);
CREATE INDEX IF NOT EXISTS idx_customer_requests_company ON public.customer_requests (company_id, status);

-- ===================== 10. REALTIME PUBLICATION =================
DO $$ BEGIN
  PERFORM 1 FROM pg_publication WHERE pubname='supabase_realtime';
  IF FOUND THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_orders';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.customer_requests';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.materials';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.production_planning';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.finished_goods';
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.packing';
  END IF;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ===================== 11. SEED DATA ============================
-- Seed materials for ABC Manufacturing
DO $$
DECLARE
  abc uuid := '11111111-1111-1111-1111-111111111111';
BEGIN
  -- Only seed if materials table is empty for this company
  IF NOT EXISTS (SELECT 1 FROM public.materials WHERE company_id = abc) THEN
    INSERT INTO public.materials (company_id, name, unit, unit_cost, is_active) VALUES
      (abc, 'Stainless Steel 304', 'kg', 12.50, true),
      (abc, 'Aluminum 6061', 'kg', 8.75, true),
      (abc, 'Titanium Grade 5', 'kg', 45.00, true),
      (abc, 'Brass C360', 'kg', 15.20, true),
      (abc, 'Carbon Steel A36', 'kg', 6.80, true),
      (abc, 'Copper C110', 'kg', 22.40, true),
      (abc, 'Nylon PA6', 'kg', 4.50, true),
      (abc, 'Delrin Acetal', 'kg', 7.90, true);
  END IF;

  -- Seed a test customer request
  IF NOT EXISTS (SELECT 1 FROM public.customer_requests WHERE company_id = abc AND email = 'testcustomer@abcmfg.demo') THEN
    INSERT INTO public.customer_requests (company_id, business_name, contact_person, email, phone, status)
    VALUES (abc, 'Test Customer Corp', 'Test User', 'testcustomer@abcmfg.demo', '+1 555-0123', 'pending');
  END IF;

  -- Seed customer orders if none exist (with FOUND guard)
  IF NOT EXISTS (SELECT 1 FROM public.customer_orders WHERE company_id = abc) THEN
    DECLARE
      cust_id uuid;
    BEGIN
      SELECT c.id INTO cust_id FROM public.customers c WHERE c.company_id = abc LIMIT 1;
      IF FOUND THEN
        INSERT INTO public.customer_orders (order_number, company_id, customer_id, product, material_id, quantity, delivery_date, priority, status, order_total, advance_payment_percent, advance_amount, balance_due)
        VALUES (
          'ORD-ABC-001', abc, cust_id, 'CNC Machined Bracket Set',
          (SELECT id FROM public.materials WHERE company_id = abc AND name = 'Aluminum 6061' LIMIT 1),
          100, CURRENT_DATE + 30, 'high', 'pending_approval',
          12500.00, 20.00, 2500.00, 10000.00
        );
      END IF;
    END;
  END IF;
END $$;

-- ===================== 12. FUNCTION: CREATE ORDER NOTIFICATION =====
CREATE OR REPLACE FUNCTION public.create_targeted_notification(
  _company_id uuid,
  _from_user uuid,
  _to_role text,
  _to_user uuid,
  _entity_type text,
  _entity_id uuid,
  _message text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (company_id, from_user, to_role, to_user, related_entity_type, related_entity_id, message)
  VALUES (_company_id, _from_user, _to_role, _to_user, _entity_type, _entity_id, _message);
END $$;
