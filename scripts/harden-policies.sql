DO $harden$
DECLARE
  r record;
  new_qual text;
  new_wc   text;
  using_sql text;
  check_sql text;
  roles_sql text;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, roles, qual, with_check
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        COALESCE(qual::text, '') ILIKE '%is_auditor()%'
        OR COALESCE(with_check::text, '') ILIKE '%is_auditor()%'
      )
      AND NOT (
        COALESCE(qual::text, '') ILIKE '%is_customer_portal()%'
        OR COALESCE(with_check::text, '') ILIKE '%is_customer_portal()%'
      )
      AND NOT (
        COALESCE(qual::text, '') ILIKE '%is_supplier_portal()%'
        OR COALESCE(with_check::text, '') ILIKE '%is_supplier_portal()%'
      )
  LOOP
    new_qual := NULLIF(replace(
      COALESCE(r.qual::text, ''),
      'is_auditor()',
      'is_auditor() AND NOT is_customer_portal() AND NOT is_supplier_portal()'
    ), '');
    new_wc := NULLIF(replace(
      COALESCE(r.with_check::text, ''),
      'is_auditor()',
      'is_auditor() AND NOT is_customer_portal() AND NOT is_supplier_portal()'
    ), '');

    SELECT string_agg(quote_ident(x), ', ') INTO roles_sql FROM unnest(r.roles) AS x;

    using_sql := CASE WHEN new_qual IS NOT NULL THEN format(' USING (%s)', new_qual) ELSE '' END;
    check_sql := CASE WHEN new_wc IS NOT NULL THEN format(' WITH CHECK (%s)', new_wc) ELSE '' END;

    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR %s TO %s%s%s',
      r.policyname, r.tablename, r.cmd, roles_sql, using_sql, check_sql
    );
  END LOOP;
END
$harden$;
