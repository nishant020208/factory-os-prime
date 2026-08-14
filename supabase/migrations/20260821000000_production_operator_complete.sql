-- FactoryOS AI: Production Operator own-work workflow and RLS hardening.
-- This migration deliberately scopes operator access to records assigned to auth.uid().

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS materials jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS design_image_url text,
  ADD COLUMN IF NOT EXISTS assigned_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_date date;

CREATE TABLE IF NOT EXISTS public.production_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  work_order_id uuid NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  operator_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress_percent integer NOT NULL CHECK (progress_percent BETWEEN 0 AND 100),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.production_progress ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT ON public.production_progress TO authenticated;
GRANT ALL ON public.production_progress TO service_role;

ALTER TABLE public.maintenance_tickets
  ADD COLUMN IF NOT EXISTS issue_type text NOT NULL DEFAULT 'machine'
    CHECK (issue_type IN ('machine','material','general')),
  ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

-- Replace the previous company-wide policies on operator-facing tables.
DROP POLICY IF EXISTS wo_select_ops ON public.work_orders;
DROP POLICY IF EXISTS wo_insert_roles ON public.work_orders;
DROP POLICY IF EXISTS wo_update_roles ON public.work_orders;
DROP POLICY IF EXISTS wo_delete_admin ON public.work_orders;
CREATE POLICY work_orders_select_scoped ON public.work_orders FOR SELECT TO authenticated
  USING (
    is_root_admin(auth.uid())
    OR operator_id = auth.uid()
    OR (company_id = current_company_id() AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('company_admin','plant_admin','plant_manager','production_manager','quality_inspector','maintenance_engineer')
    ))
  );
CREATE POLICY work_orders_insert_manager ON public.work_orders FOR INSERT TO authenticated
  WITH CHECK (company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('company_admin','production_manager')
  ));
CREATE POLICY work_orders_update_scoped ON public.work_orders FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid()) OR operator_id = auth.uid() OR
    (company_id = current_company_id() AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('company_admin','plant_admin','plant_manager','production_manager','quality_inspector','maintenance_engineer')
    ))
  )
  WITH CHECK (
    is_root_admin(auth.uid()) OR operator_id = auth.uid() OR
    (company_id = current_company_id() AND EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('company_admin','plant_admin','plant_manager','production_manager','quality_inspector','maintenance_engineer')
    ))
  );
CREATE POLICY work_orders_delete_admin ON public.work_orders FOR DELETE TO authenticated
  USING (company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'company_admin'
  ));

DROP POLICY IF EXISTS attendance_select_ops ON public.attendance;
DROP POLICY IF EXISTS attendance_insert ON public.attendance;
DROP POLICY IF EXISTS attendance_update ON public.attendance;
DROP POLICY IF EXISTS attendance_delete ON public.attendance;
CREATE POLICY attendance_select_scoped ON public.attendance FOR SELECT TO authenticated
  USING (employee_id = auth.uid() OR (company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('company_admin','hr_manager','plant_manager')
  )));
CREATE POLICY attendance_insert_own ON public.attendance FOR INSERT TO authenticated
  WITH CHECK (employee_id = auth.uid() AND company_id = current_company_id());
CREATE POLICY attendance_update_own ON public.attendance FOR UPDATE TO authenticated
  USING (employee_id = auth.uid()) WITH CHECK (employee_id = auth.uid() AND company_id = current_company_id());
CREATE POLICY attendance_delete_manager ON public.attendance FOR DELETE TO authenticated
  USING (company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('company_admin','hr_manager')
  ));

DROP POLICY IF EXISTS maintenance_tickets_select_ops ON public.maintenance_tickets;
DROP POLICY IF EXISTS maintenance_tickets_insert ON public.maintenance_tickets;
DROP POLICY IF EXISTS maintenance_tickets_update ON public.maintenance_tickets;
DROP POLICY IF EXISTS maintenance_tickets_delete ON public.maintenance_tickets;
CREATE POLICY maintenance_tickets_select_scoped ON public.maintenance_tickets FOR SELECT TO authenticated
  USING (reported_by = auth.uid() OR assigned_to = auth.uid() OR target_user_id = auth.uid() OR
    (company_id = current_company_id() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
      AND role IN ('company_admin','production_manager','maintenance_engineer','warehouse_manager'))));
CREATE POLICY maintenance_tickets_insert_scoped ON public.maintenance_tickets FOR INSERT TO authenticated
  WITH CHECK (company_id = current_company_id() AND reported_by = auth.uid());
CREATE POLICY maintenance_tickets_update_receiver ON public.maintenance_tickets FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR target_user_id = auth.uid() OR (company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('company_admin','production_manager','maintenance_engineer','warehouse_manager')
  ))) WITH CHECK (company_id = current_company_id());
CREATE POLICY maintenance_tickets_delete_manager ON public.maintenance_tickets FOR DELETE TO authenticated
  USING (company_id = current_company_id() AND EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('company_admin','production_manager')));

CREATE POLICY production_progress_select_own ON public.production_progress FOR SELECT TO authenticated
  USING (operator_id = auth.uid() OR EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()
    AND role IN ('company_admin','plant_admin','plant_manager','production_manager','auditor')));
CREATE POLICY production_progress_insert_own ON public.production_progress FOR INSERT TO authenticated
  WITH CHECK (operator_id = auth.uid() AND company_id = current_company_id() AND EXISTS (
    SELECT 1 FROM public.work_orders wo WHERE wo.id = work_order_id AND wo.operator_id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.operator_work_order_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'production_operator') THEN
    IF OLD.operator_id IS DISTINCT FROM auth.uid()
      OR NEW.company_id IS DISTINCT FROM OLD.company_id
      OR NEW.wo_number IS DISTINCT FROM OLD.wo_number
      OR NEW.production_order_id IS DISTINCT FROM OLD.production_order_id
      OR NEW.machine_id IS DISTINCT FROM OLD.machine_id
      OR NEW.operator_id IS DISTINCT FROM OLD.operator_id
      OR NEW.operation IS DISTINCT FROM OLD.operation
      OR NEW.quantity IS DISTINCT FROM OLD.quantity
      OR NEW.department_id IS DISTINCT FROM OLD.department_id
      OR NEW.notes IS DISTINCT FROM OLD.notes
      OR NEW.checklist IS DISTINCT FROM OLD.checklist
      OR NEW.materials IS DISTINCT FROM OLD.materials
      OR NEW.design_image_url IS DISTINCT FROM OLD.design_image_url
      OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
      OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at
      OR NEW.due_date IS DISTINCT FROM OLD.due_date THEN
      RAISE EXCEPTION 'Operators may update progress only on their own assigned work orders';
    END IF;
    IF NEW.progress_percent < OLD.progress_percent OR NEW.progress_percent > 100
      OR NEW.status NOT IN ('assigned','in_progress','completed') THEN
      RAISE EXCEPTION 'Invalid operator work-order progress update';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.operator_attendance_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'production_operator') THEN
    IF TG_OP = 'INSERT' AND (NEW.employee_id <> auth.uid() OR NEW.date <> CURRENT_DATE OR NEW.check_in IS NULL OR NEW.check_out IS NOT NULL) THEN
      RAISE EXCEPTION 'Operators may only check themselves in for today';
    ELSIF TG_OP = 'UPDATE' AND (OLD.employee_id <> auth.uid() OR NEW.employee_id <> OLD.employee_id
      OR NEW.date <> OLD.date OR NEW.check_in <> OLD.check_in OR NEW.check_out IS NULL) THEN
      RAISE EXCEPTION 'Operators may only check themselves out';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.operator_write_audit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE actor uuid := auth.uid();
BEGIN
  IF actor IS NOT NULL THEN
    INSERT INTO audit_logs(company_id, user_id, action, entity, entity_id, metadata)
    VALUES (
      COALESCE(NEW.company_id, OLD.company_id), actor,
      lower(TG_OP) || '_' || TG_TABLE_NAME, TG_TABLE_NAME,
      COALESCE(NEW.id, OLD.id),
      jsonb_build_object('old', CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE to_jsonb(OLD) END,
                         'new', CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE to_jsonb(NEW) END)
    );
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

CREATE OR REPLACE FUNCTION public.operator_workflow_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.operator_id IS DISTINCT FROM OLD.operator_id AND NEW.operator_id IS NOT NULL THEN
    INSERT INTO notifications(company_id, title, body, to_user, related_entity_id, related_entity_type, severity)
    VALUES (NEW.company_id, 'Work order assigned', 'You have been assigned ' || NEW.wo_number,
      NEW.operator_id, NEW.id, 'work_orders', 'info');
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.progress_percent = 100 AND OLD.progress_percent < 100 THEN
    recipient := COALESCE(NEW.assigned_by, (SELECT user_id FROM user_roles
      WHERE company_id = NEW.company_id AND role = 'production_manager' ORDER BY created_at NULLS LAST LIMIT 1));
    IF recipient IS NOT NULL THEN
      INSERT INTO notifications(company_id, title, body, to_user, related_entity_id, related_entity_type, severity)
      VALUES (NEW.company_id, 'Work order completed', NEW.wo_number || ' reached 100% completion',
        recipient, NEW.id, 'work_orders', 'success');
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.operator_issue_workflow()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient uuid; target_role app_role;
BEGIN
  IF TG_OP = 'INSERT' THEN
    target_role := CASE NEW.issue_type WHEN 'machine' THEN 'maintenance_engineer'::app_role
      WHEN 'material' THEN 'warehouse_manager'::app_role ELSE 'production_manager'::app_role END;
    recipient := COALESCE(NEW.target_user_id, (SELECT user_id FROM user_roles WHERE company_id = NEW.company_id
      AND role = target_role ORDER BY created_at NULLS LAST LIMIT 1));
    IF recipient IS NULL THEN RAISE EXCEPTION 'No assigned recipient is available for this issue type'; END IF;
    NEW.target_user_id := recipient;
    NEW.assigned_to := recipient;
    UPDATE work_orders SET status = 'blocked' WHERE id = NEW.work_order_id AND company_id = NEW.company_id;
    INSERT INTO notifications(company_id, title, body, to_user, related_entity_id, related_entity_type, severity)
    VALUES (NEW.company_id, 'Operator issue reported', NEW.issue_type || ' issue: ' || NEW.issue_description,
      recipient, NEW.id, 'maintenance_tickets', 'warning');
  ELSIF TG_OP = 'UPDATE' AND NEW.status IN ('resolved','closed') AND OLD.status NOT IN ('resolved','closed') THEN
    IF NEW.reported_by IS NOT NULL THEN
      INSERT INTO notifications(company_id, title, body, to_user, related_entity_id, related_entity_type, severity)
      VALUES (NEW.company_id, 'Issue resolved', 'Your issue has been resolved. You may resume work.',
        NEW.reported_by, NEW.id, 'maintenance_tickets', 'success');
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_operator_work_order_guard ON public.work_orders;
DROP TRIGGER IF EXISTS trg_operator_work_order_audit ON public.work_orders;
DROP TRIGGER IF EXISTS trg_operator_work_order_notify ON public.work_orders;
CREATE TRIGGER trg_operator_work_order_guard BEFORE UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION operator_work_order_guard();
CREATE TRIGGER trg_operator_work_order_audit AFTER INSERT OR UPDATE OR DELETE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION operator_write_audit();
CREATE TRIGGER trg_operator_work_order_notify AFTER UPDATE ON public.work_orders FOR EACH ROW EXECUTE FUNCTION operator_workflow_notifications();
DROP TRIGGER IF EXISTS trg_operator_attendance_guard ON public.attendance;
DROP TRIGGER IF EXISTS trg_operator_attendance_audit ON public.attendance;
CREATE TRIGGER trg_operator_attendance_guard BEFORE INSERT OR UPDATE ON public.attendance FOR EACH ROW EXECUTE FUNCTION operator_attendance_guard();
CREATE TRIGGER trg_operator_attendance_audit AFTER INSERT OR UPDATE OR DELETE ON public.attendance FOR EACH ROW EXECUTE FUNCTION operator_write_audit();
DROP TRIGGER IF EXISTS trg_operator_issue_workflow ON public.maintenance_tickets;
DROP TRIGGER IF EXISTS trg_operator_issue_audit ON public.maintenance_tickets;
CREATE TRIGGER trg_operator_issue_workflow BEFORE INSERT OR UPDATE ON public.maintenance_tickets FOR EACH ROW EXECUTE FUNCTION operator_issue_workflow();
CREATE TRIGGER trg_operator_issue_audit AFTER INSERT OR UPDATE OR DELETE ON public.maintenance_tickets FOR EACH ROW EXECUTE FUNCTION operator_write_audit();

-- A durable, real assigned work order for the demo operator.  It is intentionally
-- a normal work_orders row, not a UI fixture.
INSERT INTO public.work_orders (company_id, wo_number, operator_id, operation, status, quantity, progress_percent,
  notes, checklist, materials, assigned_by, assigned_at, due_date)
SELECT '11111111-1111-1111-1111-111111111111', 'DEMO-OP-20260821-001',
  'c6468023-3d75-4686-9474-ac4d2280afc3', 'Carpentry', 'assigned', 1, 0,
  'Demo work order assigned to the Production Operator.',
  '[{"label":"Rough cutting","completed":false},{"label":"Shaping","completed":false},{"label":"Joinery","completed":false}]'::jsonb,
  '[{"name":"Teak Wood","quantity":4,"unit":"boards"}]'::jsonb,
  'b2e3cbd8-8624-46d3-a6c3-f9c94f1be604', now(), CURRENT_DATE + 7
WHERE NOT EXISTS (SELECT 1 FROM public.work_orders WHERE wo_number = 'DEMO-OP-20260821-001');
