-- TEMPORARY diagnostic (removed by 20260904000004): report RLS status and
-- policy names for key tables so we can confirm ground truth from the app.
CREATE OR REPLACE FUNCTION public.diag_rls_state()
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT jsonb_build_object(
    'rls_disabled_tables', (
      SELECT jsonb_agg(relname)
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public'
        AND c.relrowsecurity = false
        AND c.relkind = 'r'
        AND c.relname IN ('whitelist','employees','sales_orders','customers','customer_requests','plants','user_roles','profiles')
    ),
    'policies', (
      SELECT jsonb_agg(
        jsonb_build_object('table', p.tablename, 'policy', p.policyname, 'cmd', p.cmd)
      )
      FROM pg_policies p
      WHERE p.schemaname = 'public'
        AND p.tablename IN ('whitelist','employees','sales_orders')
    )
  );
$function$;
GRANT EXECUTE ON FUNCTION public.diag_rls_state() TO authenticated;
GRANT EXECUTE ON FUNCTION public.diag_rls_state() TO service_role;