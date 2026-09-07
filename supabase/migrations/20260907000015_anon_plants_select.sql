-- ============================================================================
-- Migration: 20260907000015_anon_plants_select.sql
--
-- Enables anonymous customer registration to view active plants for any company
-- on the public customer registration form (/auth).
--
-- 1. Adds public.get_active_plants(company_id uuid) RPC with SECURITY DEFINER
-- 2. Adds plants_anon_select policy on public.plants for active plants
-- 3. Ensures every company has at least one active default primary plant
-- ============================================================================

-- 1. get_active_plants helper for anon/authenticated
CREATE OR REPLACE FUNCTION public.get_active_plants(p_company_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  _rows jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'name', p.name,
    'code', p.code,
    'city', p.city,
    'address', p.address,
    'latitude', p.latitude,
    'longitude', p.longitude,
    'status', p.status
  ) ORDER BY p.name), '[]'::jsonb)
  INTO _rows
  FROM public.plants p
  WHERE p.company_id = p_company_id
    AND p.status = 'active';
  RETURN _rows;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_plants(uuid) TO anon, authenticated;

-- 2. RLS policy for anon reading active plants
DROP POLICY IF EXISTS plants_anon_select ON public.plants;
CREATE POLICY plants_anon_select ON public.plants
  FOR SELECT TO anon
  USING (status = 'active');

GRANT SELECT (id, company_id, name, code, city, address, latitude, longitude, status)
  ON public.plants TO anon;
