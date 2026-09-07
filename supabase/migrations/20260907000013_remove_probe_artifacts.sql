-- Remove the temporary trigger-firing probe added in 20260907000012.
DROP TRIGGER IF EXISTS _probe_incoming_update ON public.incoming_material_inspections;
DROP FUNCTION IF EXISTS public._probe_incoming_update();
DROP TABLE IF EXISTS public._probe_trg_log;
