-- TEMP probe (to be reverted) — verify AFTER UPDATE OF status triggers fire on
-- incoming_material_inspections via PostgREST and whether the real function runs.
CREATE TABLE IF NOT EXISTS public._probe_trg_log(
  id serial PRIMARY KEY,
  msg text,
  created_at timestamptz DEFAULT now()
);
GRANT ALL ON public._probe_trg_log TO service_role;
GRANT SELECT ON public._probe_trg_log TO authenticated;

CREATE OR REPLACE FUNCTION public._probe_incoming_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public._probe_trg_log(msg)
  VALUES ('fired status=' || COALESCE(NEW.status,'null') || ' po=' || COALESCE(NEW.purchase_order_id::text,'null'));
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS _probe_incoming_update ON public.incoming_material_inspections;
CREATE TRIGGER _probe_incoming_update
AFTER UPDATE OF status ON public.incoming_material_inspections
FOR EACH ROW EXECUTE FUNCTION public._probe_incoming_update();
