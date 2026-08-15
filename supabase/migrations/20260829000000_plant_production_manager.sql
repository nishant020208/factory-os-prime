-- ════════════════════════════════════════════════════════════════════
-- Plant Manager + Production Manager — RLS hardening & daily reports
-- 1. Work Order UPDATE: remove plant_manager (view-only; PM/Admin/Quality/Plant-Admin edit)
-- 2. production_planning: kill customer/supplier portal leak + restrict writes to PM/Admin
-- 3. sales_orders: only Company Admin / Root may transition to status='approved'
-- 4. NEW daily_reports table (Plant Manager authored, Company Admin receives)
-- ════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. Work Orders — Plant Manager is read-only. The SELECT policy keeps
--    plant_manager (oversight). The UPDATE policy drops plant_manager.
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS work_orders_update_scoped ON public.work_orders;
CREATE POLICY work_orders_update_scoped ON public.work_orders
FOR UPDATE TO authenticated
USING (
  is_root_admin(auth.uid())
  OR (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = ANY (ARRAY[
          'company_admin'::app_role,
          'plant_admin'::app_role,
          'production_manager'::app_role,
          'quality_inspector'::app_role
        ])
    )
  )
)
WITH CHECK (
  is_root_admin(auth.uid())
  OR (operator_id = auth.uid())
  OR (
    company_id = current_company_id()
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = ANY (ARRAY[
          'company_admin'::app_role,
          'plant_admin'::app_role,
          'production_manager'::app_role,
          'quality_inspector'::app_role
        ])
    )
  )
);

-- ────────────────────────────────────────────────────────────────────
-- 2. production_planning — customer/supplier portals have a profile
--    company_id, so the old bare company match leaked the internal
--    schedule to them. Reads are company-internal only; writes are
--    Production Manager / Company Admin only.
-- ────────────────────────────────────────────────────────────────────
DROP POLICY IF EXISTS pp_select_company ON public.production_planning;
DROP POLICY IF EXISTS pp_insert_company ON public.production_planning;
DROP POLICY IF EXISTS pp_update_company ON public.production_planning;

CREATE POLICY pp_select_ops ON public.production_planning
FOR SELECT TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
);

CREATE POLICY pp_insert_manager ON public.production_planning
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND (has_role(auth.uid(), 'production_manager') OR has_role(auth.uid(), 'company_admin'))
);

CREATE POLICY pp_update_manager ON public.production_planning
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND (has_role(auth.uid(), 'production_manager') OR has_role(auth.uid(), 'company_admin'))
)
WITH CHECK (
  company_id = current_company_id()
  AND (has_role(auth.uid(), 'production_manager') OR has_role(auth.uid(), 'company_admin'))
);

-- ────────────────────────────────────────────────────────────────────
-- 3. sales_orders — only Company Admin / Root may mark an order
--    approved. Prevents Production Manager (or any ops role that the
--    company-scoped UPDATE policy admits) from self-approving.
-- ────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.block_non_admin_order_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (public.has_role(auth.uid(), 'company_admin') OR public.is_root_admin(auth.uid())) THEN
      RAISE EXCEPTION 'Only a Company Admin can approve a customer order';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_sales_order_approval_guard ON public.sales_orders;
CREATE TRIGGER trg_sales_order_approval_guard
BEFORE UPDATE OF status ON public.sales_orders
FOR EACH ROW EXECUTE FUNCTION public.block_non_admin_order_approval();

-- ────────────────────────────────────────────────────────────────────
-- 4. daily_reports — Plant Manager's end-of-day record.
--    Plant Manager / Plant Admin / Company Admin create; Company Admin
--    acknowledges; all internal company roles read; external portals
--    never see it.
-- ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  plant_id uuid REFERENCES public.plants(id) ON DELETE SET NULL,
  submitted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  units_completed integer NOT NULL DEFAULT 0,
  attendance_summary text,
  downtime_minutes numeric NOT NULL DEFAULT 0,
  issues text,
  notes text,
  status text NOT NULL DEFAULT 'submitted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS daily_reports_company_date_idx
  ON public.daily_reports (company_id, report_date DESC);

ALTER TABLE public.daily_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_reports TO authenticated;
GRANT ALL ON public.daily_reports TO service_role;

DROP POLICY IF EXISTS daily_reports_select_ops ON public.daily_reports;
CREATE POLICY daily_reports_select_ops ON public.daily_reports
FOR SELECT TO authenticated
USING (
  company_id = current_company_id()
  AND NOT is_customer_portal()
  AND NOT is_supplier_portal()
);

DROP POLICY IF EXISTS daily_reports_insert_plant ON public.daily_reports;
CREATE POLICY daily_reports_insert_plant ON public.daily_reports
FOR INSERT TO authenticated
WITH CHECK (
  company_id = current_company_id()
  AND (has_role(auth.uid(), 'plant_manager')
    OR has_role(auth.uid(), 'plant_admin')
    OR has_role(auth.uid(), 'company_admin'))
);

DROP POLICY IF EXISTS daily_reports_update_ops ON public.daily_reports;
CREATE POLICY daily_reports_update_ops ON public.daily_reports
FOR UPDATE TO authenticated
USING (
  company_id = current_company_id()
  AND (
    has_role(auth.uid(), 'company_admin')
    OR (submitted_by = auth.uid() AND status = 'submitted')
  )
)
WITH CHECK (
  company_id = current_company_id()
  AND (
    has_role(auth.uid(), 'company_admin')
    OR (submitted_by = auth.uid() AND status = 'submitted')
  )
);

DROP POLICY IF EXISTS daily_reports_delete_admin ON public.daily_reports;
CREATE POLICY daily_reports_delete_admin ON public.daily_reports
FOR DELETE TO authenticated
USING (
  company_id = current_company_id() AND has_role(auth.uid(), 'company_admin')
);

-- Audit trail + cross-tenant + auditor-write guards, same as every other
-- operational table in the app.
DROP TRIGGER IF EXISTS trg_audit_write ON public.daily_reports;
CREATE TRIGGER trg_audit_write
AFTER INSERT OR DELETE OR UPDATE ON public.daily_reports
FOR EACH ROW EXECUTE FUNCTION audit_write_event();

DROP TRIGGER IF EXISTS trg_cross_tenant_guard ON public.daily_reports;
CREATE TRIGGER trg_cross_tenant_guard
BEFORE INSERT OR DELETE OR UPDATE ON public.daily_reports
FOR EACH ROW EXECUTE FUNCTION block_cross_tenant_writes();

DROP TRIGGER IF EXISTS trg_block_auditor_write ON public.daily_reports;
CREATE TRIGGER trg_block_auditor_write
BEFORE INSERT OR DELETE OR UPDATE ON public.daily_reports
FOR EACH ROW EXECUTE FUNCTION block_auditor_writes();
