-- TEMP: introspection helper for the Root-admin RLS restriction work.
-- Will be dropped by a later migration in the same batch.
CREATE OR REPLACE FUNCTION public.tmp_dump_policies()
RETURNS jsonb
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(jsonb_agg(
    jsonb_build_object(
      'tbl', schemaname || '.' || tablename,
      'pol', policyname,
      'cmd', cmd,
      'roles', roles::text,
      'qual', qual,
      'wc', with_check
    ) ORDER BY tablename, policyname
  ), '[]'::jsonb)
  FROM pg_policies
  WHERE schemaname = 'public';
$$;

GRANT EXECUTE ON FUNCTION public.tmp_dump_policies() TO service_role;
