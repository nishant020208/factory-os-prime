
-- ============ MAINTENANCE ============
CREATE TABLE public.maintenance_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  work_order_id uuid REFERENCES public.work_orders(id) ON DELETE SET NULL,
  ticket_number text,
  issue_description text NOT NULL,
  priority text NOT NULL DEFAULT 'medium',
  status text NOT NULL DEFAULT 'open',
  reported_by uuid,
  assigned_to uuid,
  resolution_notes text,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.maintenance_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE CASCADE,
  recurrence text NOT NULL DEFAULT 'monthly',
  assigned_to uuid,
  next_due date,
  last_done date,
  status text NOT NULL DEFAULT 'scheduled',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.machine_breakdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE CASCADE,
  downtime_start timestamptz NOT NULL DEFAULT now(),
  downtime_end timestamptz,
  cause text NOT NULL,
  reported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.machine_status_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  machine_id uuid REFERENCES public.machines(id) ON DELETE CASCADE,
  from_status text,
  to_status text NOT NULL,
  reason text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.spare_parts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  part_code text,
  quantity numeric NOT NULL DEFAULT 0,
  reorder_threshold numeric NOT NULL DEFAULT 0,
  unit_cost numeric,
  machine_ids uuid[] DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============ FINANCE ============
CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT current_date,
  description text,
  receipt_url text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  period text NOT NULL,
  allocated_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  period text NOT NULL,
  tax_type text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  filing_status text NOT NULL DEFAULT 'pending',
  filed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ HR ============
CREATE TABLE public.leaves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  leave_type text NOT NULL DEFAULT 'casual',
  reason text,
  status text NOT NULL DEFAULT 'pending',
  approver_id uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.job_openings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'open',
  description text,
  openings integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.trainings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  course_name text NOT NULL,
  completion_date date,
  status text NOT NULL DEFAULT 'assigned',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.performance_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  employee_id uuid REFERENCES public.employees(id) ON DELETE CASCADE,
  period text NOT NULL,
  rating numeric,
  notes text,
  reviewer_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ PROCUREMENT ============
CREATE TABLE public.rfqs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  rfq_number text,
  title text NOT NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  supplier_ids uuid[] DEFAULT '{}',
  response_deadline date,
  status text NOT NULL DEFAULT 'open',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.purchase_order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  description text,
  quantity numeric NOT NULL DEFAULT 0,
  unit_price numeric NOT NULL DEFAULT 0,
  line_total numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.goods_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  purchase_order_id uuid REFERENCES public.purchase_orders(id) ON DELETE SET NULL,
  grn_number text,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  quantity_received numeric NOT NULL DEFAULT 0,
  condition_notes text,
  received_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ WAREHOUSE ============
CREATE TABLE public.stock_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  from_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  to_warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  quantity numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'completed',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cycle_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  warehouse_id uuid REFERENCES public.warehouses(id) ON DELETE SET NULL,
  count_date date NOT NULL DEFAULT current_date,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.cycle_count_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  cycle_count_id uuid NOT NULL REFERENCES public.cycle_counts(id) ON DELETE CASCADE,
  material_id uuid REFERENCES public.materials(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  expected_qty numeric NOT NULL DEFAULT 0,
  actual_qty numeric NOT NULL DEFAULT 0,
  discrepancy numeric GENERATED ALWAYS AS (actual_qty - expected_qty) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ QUALITY ============
CREATE TABLE public.quality_certificates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  certificate_number text NOT NULL,
  inspection_id uuid REFERENCES public.quality_inspections(id) ON DELETE SET NULL,
  finished_goods_id uuid REFERENCES public.finished_goods(id) ON DELETE SET NULL,
  customer_order_id uuid REFERENCES public.customer_orders(id) ON DELETE SET NULL,
  qr_data text,
  qr_url text,
  issued_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ PLANT OPS ============
CREATE TABLE public.shift_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id uuid REFERENCES public.plants(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL,
  shift text NOT NULL DEFAULT 'morning',
  shift_date date NOT NULL DEFAULT current_date,
  operator_ids uuid[] DEFAULT '{}',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ COMPLIANCE ============
CREATE TABLE public.compliance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title text NOT NULL,
  standard text,
  status text NOT NULL DEFAULT 'compliant',
  valid_from date,
  expires_at date,
  document_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============ COLUMN ADDITIONS ============
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS progress_percent integer NOT NULL DEFAULT 0;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;
ALTER TABLE public.work_orders ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS payment_terms text;
ALTER TABLE public.suppliers ADD COLUMN IF NOT EXISTS category text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS requisition_id uuid REFERENCES public.purchase_requisitions(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS carrier text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS tracking_number text;
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS supplier_note text;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE public.machines ADD COLUMN IF NOT EXISTS status_reason text;

-- ============ GRANTS + RLS + POLICIES (uniform tenant model) ============
DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY[
  'maintenance_tickets','maintenance_schedules','machine_breakdowns','machine_status_log','spare_parts',
  'expenses','budgets','taxes',
  'leaves','job_openings','trainings','performance_reviews',
  'rfqs','purchase_order_items','goods_receipts',
  'stock_transfers','cycle_counts','cycle_count_items',
  'quality_certificates','shift_schedules','compliance_records'
];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format($f$CREATE POLICY "%1$s_select" ON public.%1$I FOR SELECT TO authenticated
      USING (public.in_company(company_id) OR public.is_auditor())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_insert" ON public.%1$I FOR INSERT TO authenticated
      WITH CHECK (public.in_company(company_id) AND NOT public.is_auditor())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_update" ON public.%1$I FOR UPDATE TO authenticated
      USING (public.in_company(company_id) AND NOT public.is_auditor())
      WITH CHECK (public.in_company(company_id) AND NOT public.is_auditor())$f$, t);
    EXECUTE format($f$CREATE POLICY "%1$s_delete" ON public.%1$I FOR DELETE TO authenticated
      USING (public.in_company(company_id) AND NOT public.is_auditor())$f$, t);
  END LOOP;
END $$;

-- updated_at trigger for tables that carry it
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE t text;
DECLARE tables text[] := ARRAY['maintenance_tickets','maintenance_schedules','spare_parts','budgets','job_openings'];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('CREATE TRIGGER %1$s_set_updated_at BEFORE UPDATE ON public.%1$I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;
