
-- =========================
-- ENUMS
-- =========================
CREATE TYPE public.app_role AS ENUM (
  'root_super_admin','company_admin','plant_admin','plant_manager',
  'production_manager','warehouse_manager','procurement_manager',
  'quality_inspector','maintenance_engineer','finance_manager',
  'hr_manager','production_operator','customer_portal','supplier_portal','auditor'
);

CREATE TYPE public.whitelist_status AS ENUM ('pending','accepted','revoked','expired');

-- =========================
-- CORE MULTI-TENANT TABLES
-- =========================
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  legal_name TEXT,
  industry TEXT DEFAULT 'Manufacturing',
  country TEXT,
  currency TEXT DEFAULT 'USD',
  timezone TEXT DEFAULT 'UTC',
  logo_url TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  address TEXT,
  city TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE public.departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  job_title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role, company_id)
);

CREATE TABLE public.whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  role public.app_role NOT NULL,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  status public.whitelist_status NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at TIMESTAMPTZ,
  UNIQUE (email, role)
);
CREATE INDEX whitelist_email_idx ON public.whitelist (lower(email));

-- =========================
-- BUSINESS TABLES (core skeleton)
-- =========================
CREATE TABLE public.product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  sku TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES public.product_categories(id) ON DELETE SET NULL,
  unit TEXT DEFAULT 'pcs',
  unit_cost NUMERIC(14,2) DEFAULT 0,
  unit_price NUMERIC(14,2) DEFAULT 0,
  reorder_level NUMERIC(14,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, sku)
);

CREATE TABLE public.warehouses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE public.inventory (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id UUID NOT NULL REFERENCES public.warehouses(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (warehouse_id, product_id)
);

CREATE TABLE public.suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  rating NUMERIC(3,2) DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  contact_email TEXT,
  contact_phone TEXT,
  segment TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  type TEXT,
  status TEXT NOT NULL DEFAULT 'operational',
  utilization NUMERIC(5,2) DEFAULT 0,
  last_maintenance TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, code)
);

CREATE TABLE public.production_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id UUID REFERENCES public.plants(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'planned',
  priority TEXT DEFAULT 'medium',
  start_date TIMESTAMPTZ,
  due_date TIMESTAMPTZ,
  progress NUMERIC(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, order_number)
);

CREATE TABLE public.purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  po_number TEXT NOT NULL,
  supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_amount NUMERIC(14,2) DEFAULT 0,
  expected_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (company_id, po_number)
);

CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  severity TEXT DEFAULT 'info',
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id UUID,
  metadata JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =========================
-- GRANTS
-- =========================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whitelist TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.product_categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.production_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- =========================
-- SECURITY DEFINER FUNCTIONS
-- =========================
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_root_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'root_super_admin');
$$;

CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.profiles WHERE id = auth.uid();
$$;

-- =========================
-- SIGNUP TRIGGER: enforce whitelist
-- =========================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  wl RECORD;
BEGIN
  SELECT * INTO wl FROM public.whitelist
   WHERE lower(email) = lower(NEW.email)
     AND status = 'pending'
     AND (expires_at IS NULL OR expires_at > now())
   ORDER BY created_at DESC
   LIMIT 1;

  IF wl.id IS NULL THEN
    RAISE EXCEPTION 'Email % is not whitelisted for FactoryOS registration', NEW.email;
  END IF;

  INSERT INTO public.profiles (id, company_id, plant_id, email, full_name)
  VALUES (NEW.id, wl.company_id, wl.plant_id, NEW.email,
          COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)));

  INSERT INTO public.user_roles (user_id, role, company_id, plant_id)
  VALUES (NEW.id, wl.role, wl.company_id, wl.plant_id);

  UPDATE public.whitelist SET status='accepted', accepted_at=now() WHERE id = wl.id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================
-- RLS
-- =========================
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warehouses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.production_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Companies: root sees all, others see their own
CREATE POLICY "companies_select" ON public.companies FOR SELECT TO authenticated
USING (public.is_root_admin(auth.uid()) OR id = public.current_company_id());
CREATE POLICY "companies_root_all" ON public.companies FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid())) WITH CHECK (public.is_root_admin(auth.uid()));

-- Plants
CREATE POLICY "plants_select" ON public.plants FOR SELECT TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());
CREATE POLICY "plants_write" ON public.plants FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'company_admin')))
WITH CHECK (public.is_root_admin(auth.uid()) OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'company_admin')));

-- Departments
CREATE POLICY "departments_select" ON public.departments FOR SELECT TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());
CREATE POLICY "departments_write" ON public.departments FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

-- Profiles: user reads own; company members see each other; root sees all
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated
USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- User roles: users see own; root sees all; company_admin sees company
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.is_root_admin(auth.uid()) OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'company_admin')));

-- Whitelist: root manages platform-wide; company_admin manages own company
CREATE POLICY "whitelist_select" ON public.whitelist FOR SELECT TO authenticated
USING (public.is_root_admin(auth.uid()) OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'company_admin')));
CREATE POLICY "whitelist_write" ON public.whitelist FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'company_admin')))
WITH CHECK (public.is_root_admin(auth.uid()) OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'company_admin')));

-- Generic company-scoped policies helper macro (repeated)
CREATE POLICY "product_categories_all" ON public.product_categories FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "products_all" ON public.products FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "warehouses_all" ON public.warehouses FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "inventory_all" ON public.inventory FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "suppliers_all" ON public.suppliers FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "customers_all" ON public.customers FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "machines_all" ON public.machines FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "production_orders_all" ON public.production_orders FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "purchase_orders_all" ON public.purchase_orders FOR ALL TO authenticated
USING (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id())
WITH CHECK (public.is_root_admin(auth.uid()) OR company_id = public.current_company_id());

CREATE POLICY "notifications_select" ON public.notifications FOR SELECT TO authenticated
USING (user_id = auth.uid() OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'company_admin')));
CREATE POLICY "notifications_update" ON public.notifications FOR UPDATE TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE POLICY "audit_logs_select" ON public.audit_logs FOR SELECT TO authenticated
USING (public.is_root_admin(auth.uid()) OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'auditor')) OR (company_id = public.current_company_id() AND public.has_role(auth.uid(),'company_admin')));
CREATE POLICY "audit_logs_insert" ON public.audit_logs FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

-- =========================
-- DEMO SEED
-- =========================
INSERT INTO public.companies (id, name, legal_name, industry, country, currency)
VALUES ('11111111-1111-1111-1111-111111111111','ABC Manufacturing','ABC Manufacturing Inc.','Precision Manufacturing','United States','USD');

INSERT INTO public.plants (id, company_id, name, code, city, country)
VALUES ('22222222-2222-2222-2222-222222222222','11111111-1111-1111-1111-111111111111','Detroit Assembly Plant','DET-01','Detroit','United States');

-- Whitelist demo entries. Root does NOT have a company link.
INSERT INTO public.whitelist (email, role, company_id, plant_id) VALUES
('root@factoryos.demo','root_super_admin', NULL, NULL),
('admin@abcmfg.demo','company_admin','11111111-1111-1111-1111-111111111111', NULL),
('plantadmin@abcmfg.demo','plant_admin','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),
('plantmanager@abcmfg.demo','plant_manager','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),
('production@abcmfg.demo','production_manager','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),
('warehouse@abcmfg.demo','warehouse_manager','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),
('procurement@abcmfg.demo','procurement_manager','11111111-1111-1111-1111-111111111111', NULL),
('quality@abcmfg.demo','quality_inspector','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),
('maintenance@abcmfg.demo','maintenance_engineer','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),
('finance@abcmfg.demo','finance_manager','11111111-1111-1111-1111-111111111111', NULL),
('hr@abcmfg.demo','hr_manager','11111111-1111-1111-1111-111111111111', NULL),
('operator@abcmfg.demo','production_operator','11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222'),
('customer@abcmfg.demo','customer_portal','11111111-1111-1111-1111-111111111111', NULL),
('supplier@abcmfg.demo','supplier_portal','11111111-1111-1111-1111-111111111111', NULL),
('auditor@abcmfg.demo','auditor','11111111-1111-1111-1111-111111111111', NULL);

-- Seed demo business data
INSERT INTO public.product_categories (company_id, name, description) VALUES
('11111111-1111-1111-1111-111111111111','Precision Components','CNC-machined precision parts'),
('11111111-1111-1111-1111-111111111111','Assemblies','Multi-part sub-assemblies'),
('11111111-1111-1111-1111-111111111111','Raw Materials','Steel, aluminum, alloys');

INSERT INTO public.products (company_id, sku, name, unit_cost, unit_price, reorder_level) VALUES
('11111111-1111-1111-1111-111111111111','SKU-A1001','Titanium Bracket TB-500', 42.50, 89.00, 200),
('11111111-1111-1111-1111-111111111111','SKU-A1002','Aluminum Housing AH-220', 18.75, 42.00, 500),
('11111111-1111-1111-1111-111111111111','SKU-A1003','Precision Bearing PB-88',  6.20, 15.50, 1200),
('11111111-1111-1111-1111-111111111111','SKU-A1004','Servo Motor SM-3000', 210.00, 465.00, 40),
('11111111-1111-1111-1111-111111111111','SKU-A1005','Control Board CB-X1', 88.00, 199.00, 120);

INSERT INTO public.warehouses (company_id, plant_id, name, code) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Main Warehouse','WH-MAIN'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Raw Materials Store','WH-RAW');

INSERT INTO public.suppliers (company_id, name, contact_email, rating) VALUES
('11111111-1111-1111-1111-111111111111','Nordic Steel AB','sales@nordicsteel.com', 4.7),
('11111111-1111-1111-1111-111111111111','Kyoto Precision Ltd','info@kyotoprecision.jp', 4.9),
('11111111-1111-1111-1111-111111111111','Bavarian Alloys GmbH','contact@bavarianalloys.de', 4.5);

INSERT INTO public.customers (company_id, name, contact_email, segment) VALUES
('11111111-1111-1111-1111-111111111111','Aeronova Systems','procurement@aeronova.com','Aerospace'),
('11111111-1111-1111-1111-111111111111','Volt Motors Inc.','supply@voltmotors.com','Automotive'),
('11111111-1111-1111-1111-111111111111','MediTek Devices','buyers@meditek.com','Medical');

INSERT INTO public.machines (company_id, plant_id, name, code, type, status, utilization) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','CNC Mill Alpha-1','MC-A1','5-axis CNC','operational', 87.4),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','CNC Lathe Beta-2','MC-B2','Turning Center','operational', 76.2),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Robotic Assembly R-7','MC-R7','6-axis Robot','maintenance', 0),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Injection Molder IM-3','MC-I3','Molding','operational', 92.1),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','Laser Cutter LC-9','MC-L9','Fiber Laser','operational', 68.5);

INSERT INTO public.production_orders (company_id, plant_id, order_number, quantity, status, priority, progress, due_date) VALUES
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PO-2026-0001', 500,'in_progress','high', 62, now()+interval '5 days'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PO-2026-0002', 1200,'planned','medium', 0, now()+interval '12 days'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PO-2026-0003', 300,'in_progress','critical', 88, now()+interval '2 days'),
('11111111-1111-1111-1111-111111111111','22222222-2222-2222-2222-222222222222','PO-2026-0004', 800,'completed','medium', 100, now()-interval '1 days');

INSERT INTO public.purchase_orders (company_id, po_number, status, total_amount, expected_date) VALUES
('11111111-1111-1111-1111-111111111111','PUR-2026-0001','approved', 48250.00, now()+interval '7 days'),
('11111111-1111-1111-1111-111111111111','PUR-2026-0002','pending', 12800.00, now()+interval '14 days'),
('11111111-1111-1111-1111-111111111111','PUR-2026-0003','received', 87400.00, now()-interval '2 days');
