-- Assignment can occur either during work-order creation or later in the
-- manager's assignment dialog; both paths notify only the assigned operator.
CREATE OR REPLACE FUNCTION public.operator_workflow_notifications()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recipient uuid;
BEGIN
  IF ((TG_OP = 'INSERT' AND NEW.operator_id IS NOT NULL)
    OR (TG_OP = 'UPDATE' AND NEW.operator_id IS DISTINCT FROM OLD.operator_id AND NEW.operator_id IS NOT NULL)) THEN
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

DROP TRIGGER IF EXISTS trg_operator_work_order_notify ON public.work_orders;
CREATE TRIGGER trg_operator_work_order_notify
  AFTER INSERT OR UPDATE ON public.work_orders
  FOR EACH ROW EXECUTE FUNCTION operator_workflow_notifications();
