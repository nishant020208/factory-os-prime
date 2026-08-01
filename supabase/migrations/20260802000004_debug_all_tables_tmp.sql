-- TEMP: expand policy introspection to ALL public tables (will be dropped later)
CREATE OR REPLACE FUNCTION public.debug_policies()
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table', tablename,
      'policy', policyname,
      'cmd', cmd,
      'roles', roles,
      'qual', qual,
      'with_check', with_check
    ) ORDER BY tablename, policyname), '[]'::jsonb)
  FROM pg_policies
  WHERE schemaname = 'public'
$$;

GRANT EXECUTE ON FUNCTION public.debug_policies() TO service_role;
