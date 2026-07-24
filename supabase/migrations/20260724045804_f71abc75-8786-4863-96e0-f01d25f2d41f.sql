-- Ensure notifications policy allows inserts from triggers (security definer will bypass anyway)
-- but keep an insert policy for direct app writes.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='notifications' AND policyname='notifications_insert_own_company') THEN
    CREATE POLICY notifications_insert_own_company ON public.notifications
      FOR INSERT TO authenticated
      WITH CHECK (company_id = public.current_company_id());
  END IF;
END $$;

-- Helper to insert a company-wide notification
CREATE OR REPLACE FUNCTION public.emit_notification(
  _company_id uuid, _title text, _body text, _severity text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF _company_id IS NULL THEN RETURN; END IF;
  INSERT INTO public.notifications (company_id, user_id, title, body, severity)
  VALUES (_company_id, NULL, _title, _body, _severity);
END $$;

-- Production completed
CREATE OR REPLACE FUNCTION public.trg_production_completed()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
    PERFORM public.emit_notification(NEW.company_id, 'Production order completed',
      concat('Order ', NEW.order_number, ' completed (qty ', NEW.quantity, ')'), 'success');
    INSERT INTO public.audit_logs(company_id, action, entity, entity_id, metadata)
    VALUES (NEW.company_id, 'production_completed', 'production_orders', NEW.id, jsonb_build_object('order_number', NEW.order_number));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_production_completed ON public.production_orders;
CREATE TRIGGER on_production_completed
AFTER UPDATE ON public.production_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_production_completed();

-- Machine down / maintenance
CREATE OR REPLACE FUNCTION public.trg_machine_status_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('down','maintenance') AND (OLD.status IS DISTINCT FROM NEW.status) THEN
    PERFORM public.emit_notification(NEW.company_id,
      CASE NEW.status WHEN 'down' THEN 'Machine breakdown' ELSE 'Machine in maintenance' END,
      concat(NEW.name, ' is now ', NEW.status),
      CASE NEW.status WHEN 'down' THEN 'critical' ELSE 'warning' END);
    INSERT INTO public.audit_logs(company_id, action, entity, entity_id, metadata)
    VALUES (NEW.company_id, 'machine_status_change', 'machines', NEW.id, jsonb_build_object('name', NEW.name, 'status', NEW.status));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_machine_status ON public.machines;
CREATE TRIGGER on_machine_status
AFTER UPDATE ON public.machines
FOR EACH ROW EXECUTE FUNCTION public.trg_machine_status_change();

-- Purchase order received
CREATE OR REPLACE FUNCTION public.trg_po_received()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'received' AND (OLD.status IS DISTINCT FROM 'received') THEN
    PERFORM public.emit_notification(NEW.company_id, 'Purchase order received',
      concat('PO ', COALESCE(NEW.po_number, NEW.id::text), ' received · $', COALESCE(NEW.total_amount, 0)), 'success');
    INSERT INTO public.audit_logs(company_id, action, entity, entity_id, metadata)
    VALUES (NEW.company_id, 'po_received', 'purchase_orders', NEW.id, jsonb_build_object('po_number', NEW.po_number));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_po_received ON public.purchase_orders;
CREATE TRIGGER on_po_received
AFTER UPDATE ON public.purchase_orders
FOR EACH ROW EXECUTE FUNCTION public.trg_po_received();

-- Low inventory alert
CREATE OR REPLACE FUNCTION public.trg_low_inventory()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  reorder numeric;
  sku text;
BEGIN
  SELECT p.reorder_level, p.sku INTO reorder, sku
  FROM public.products p WHERE p.id = NEW.product_id;
  IF reorder IS NOT NULL AND NEW.quantity <= reorder AND
     (TG_OP = 'INSERT' OR OLD.quantity > reorder) THEN
    PERFORM public.emit_notification(NEW.company_id, 'Low stock',
      concat('SKU ', COALESCE(sku, NEW.product_id::text), ' is at or below reorder level (', NEW.quantity, ' remaining)'),
      'warning');
    INSERT INTO public.audit_logs(company_id, action, entity, entity_id, metadata)
    VALUES (NEW.company_id, 'low_inventory', 'inventory', NEW.id, jsonb_build_object('sku', sku, 'qty', NEW.quantity));
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_inventory_low ON public.inventory;
CREATE TRIGGER on_inventory_low
AFTER INSERT OR UPDATE OF quantity ON public.inventory
FOR EACH ROW EXECUTE FUNCTION public.trg_low_inventory();

-- Enable realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER TABLE public.production_orders REPLICA IDENTITY FULL;
ALTER TABLE public.machines REPLICA IDENTITY FULL;
ALTER TABLE public.purchase_orders REPLICA IDENTITY FULL;
ALTER TABLE public.inventory REPLICA IDENTITY FULL;

DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.production_orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.machines; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.purchase_orders; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.inventory; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;