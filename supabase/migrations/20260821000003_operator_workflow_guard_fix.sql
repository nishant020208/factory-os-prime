-- Allow the trusted issue-routing trigger to pause the work order, and allow
-- the operator's 100% update to set its completion timestamp.
CREATE OR REPLACE FUNCTION public.operator_work_order_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'production_operator')
     AND pg_trigger_depth() = 1 THEN
    IF OLD.operator_id IS DISTINCT FROM auth.uid()
      OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.wo_number IS DISTINCT FROM OLD.wo_number
      OR NEW.production_order_id IS DISTINCT FROM OLD.production_order_id OR NEW.machine_id IS DISTINCT FROM OLD.machine_id
      OR NEW.operator_id IS DISTINCT FROM OLD.operator_id OR NEW.operation IS DISTINCT FROM OLD.operation
      OR NEW.quantity IS DISTINCT FROM OLD.quantity OR NEW.department_id IS DISTINCT FROM OLD.department_id
      OR NEW.notes IS DISTINCT FROM OLD.notes OR NEW.materials IS DISTINCT FROM OLD.materials
      OR NEW.design_image_url IS DISTINCT FROM OLD.design_image_url OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
      OR NEW.assigned_at IS DISTINCT FROM OLD.assigned_at OR NEW.due_date IS DISTINCT FROM OLD.due_date
      OR (NEW.end_time IS DISTINCT FROM OLD.end_time AND NEW.progress_percent <> 100) THEN
      RAISE EXCEPTION 'Operators may update progress and checklist only on their own assigned work orders';
    END IF;
    IF NEW.progress_percent < OLD.progress_percent OR NEW.progress_percent > 100 OR NEW.status NOT IN ('assigned','in_progress','completed') THEN
      RAISE EXCEPTION 'Invalid operator work-order progress update';
    END IF;
  END IF;
  RETURN NEW;
END $$;
