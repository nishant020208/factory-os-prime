-- =============================================================
-- FACTORYOS AI — FIX get_active_companies RPC
-- The original RPC used ORDER BY c.name after jsonb_agg(...)
-- without a GROUP BY clause, causing a SQL error.
-- Fix: move ORDER BY inside jsonb_agg(... ORDER BY c.name)
-- which is valid Postgres aggregate syntax.
-- =============================================================
CREATE OR REPLACE FUNCTION public.get_active_companies()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'name', c.name,
    'industry', c.industry,
    'country', c.country
  ) ORDER BY c.name), '[]'::jsonb)
  INTO _rows
  FROM public.companies c
  WHERE c.status = 'active';
  RETURN _rows;
END $$;

GRANT EXECUTE ON FUNCTION public.get_active_companies() TO anon, authenticated;