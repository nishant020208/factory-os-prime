-- 1. Harden helper functions (fixed search_path, definer where needed)
CREATE OR REPLACE FUNCTION public.current_company_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT company_id FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_auditor()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'auditor');
$$;

CREATE OR REPLACE FUNCTION public.is_root_admin(_user_id uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'root_super_admin');
$$;

CREATE OR REPLACE FUNCTION public.in_company(_cid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_root_admin(auth.uid())
      OR (_cid IS NOT NULL AND _cid = public.current_company_id());
$$;

GRANT EXECUTE ON FUNCTION public.in_company(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_status_transition(_company_id uuid, _order_id uuid, _order_type text, _from_status text, _to_status text, _changed_by uuid, _notes text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.order_status_history (company_id, order_id, order_type, from_status, to_status, changed_by, notes)
  VALUES (_company_id, _order_id, _order_type, _from_status, _to_status, _changed_by, _notes);
END; $$;

CREATE OR REPLACE FUNCTION public.create_order_notification(_company_id uuid, _user_id uuid, _title text, _body text, _severity text DEFAULT 'info'::text, _entity text DEFAULT NULL::text, _entity_id uuid DEFAULT NULL::uuid, _action text DEFAULT NULL::text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.notifications (company_id, user_id, title, body, severity)
  VALUES (_company_id, _user_id, _title, _body, _severity);
  IF _action IS NOT NULL THEN
    INSERT INTO public.audit_logs (company_id, user_id, action, entity, entity_id, metadata)
    VALUES (_company_id, _user_id, _action, _entity, _entity_id, jsonb_build_object('title', _title, 'body', _body));
  END IF;
END; $$;

-- 2. Revoke direct API access to internal / trigger-only SECURITY DEFINER functions
DO $$
DECLARE fn text;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('handle_new_user','rls_auto_enable','trg_low_inventory','trg_machine_status_change',
                        'trg_po_received','trg_production_completed','emit_notification','create_order_notification',
                        'create_targeted_notification','record_status_transition')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn);
  END LOOP;
  -- helpers used inside RLS: signed-in only, never anonymous
  FOR fn IN
    SELECT p.oid::regprocedure::text
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname IN ('has_role','is_auditor','is_root_admin','current_company_id','in_company','is_main_admin')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
  END LOOP;
END $$;

-- 3. Replace permissive USING(true) SELECT policies with company scoping
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'approvals','attendance','audit_logs','bom','bom_items','customers','departments','documents',
    'employees','inventory','invoices','knowledge_articles','machines','notifications','payments',
    'payroll','plants','product_categories','production_orders','products','purchase_orders',
    'quality_inspections','sales_order_items','sales_orders','shipments','suppliers','support_tickets',
    'tasks','warehouses','whitelist','work_orders'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_auditor_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_scoped', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (public.in_company(company_id))',
      t || '_select_scoped', t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS shipping_auditor_select ON public.shipments;

-- profiles: self, same company, or root
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_auditor_select ON public.profiles;
DROP POLICY IF EXISTS profiles_select_scoped ON public.profiles;
CREATE POLICY profiles_select_scoped ON public.profiles FOR SELECT TO authenticated
USING (id = auth.uid() OR public.in_company(company_id));

-- user_roles: own rows, same company, or root
DROP POLICY IF EXISTS user_roles_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_auditor_select ON public.user_roles;
DROP POLICY IF EXISTS user_roles_select_scoped ON public.user_roles;
CREATE POLICY user_roles_select_scoped ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.in_company(company_id));

-- companies: own company or root
DROP POLICY IF EXISTS companies_select ON public.companies;
DROP POLICY IF EXISTS companies_auditor_select ON public.companies;
DROP POLICY IF EXISTS companies_select_scoped ON public.companies;
CREATE POLICY companies_select_scoped ON public.companies FOR SELECT TO authenticated
USING (public.is_root_admin(auth.uid()) OR id = public.current_company_id());

-- platform_settings: root admins only
DROP POLICY IF EXISTS ps_select ON public.platform_settings;
DROP POLICY IF EXISTS ps_select_root ON public.platform_settings;
CREATE POLICY ps_select_root ON public.platform_settings FOR SELECT TO authenticated
USING (public.is_root_admin(auth.uid()));

-- 4. Remove anonymous read access to registration / customer request PII
DROP POLICY IF EXISTS cr_anon_select ON public.company_registrations;
DROP POLICY IF EXISTS cr_anon_select ON public.customer_requests;
DROP POLICY IF EXISTS cr_select ON public.company_registrations;
DROP POLICY IF EXISTS cr_select_root ON public.company_registrations;
CREATE POLICY cr_select_root ON public.company_registrations FOR SELECT TO authenticated
USING (public.is_root_admin(auth.uid()));

-- submissions stay open but may only create pending requests
DROP POLICY IF EXISTS cr_anon_insert ON public.company_registrations;
CREATE POLICY cr_anon_insert ON public.company_registrations FOR INSERT TO anon
WITH CHECK (status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL);

DROP POLICY IF EXISTS cr_anon_insert ON public.customer_requests;
CREATE POLICY cr_anon_insert ON public.customer_requests FOR INSERT TO anon
WITH CHECK (status = 'pending');

DROP POLICY IF EXISTS cr_insert_auth ON public.customer_requests;
CREATE POLICY cr_insert_auth ON public.customer_requests FOR INSERT TO authenticated
WITH CHECK (status = 'pending');

-- 5. Storage: private export bucket reachable only by root admins
DROP POLICY IF EXISTS "db_export_root_select" ON storage.objects;
DROP POLICY IF EXISTS "db_export_root_write" ON storage.objects;
DROP POLICY IF EXISTS "db_export_root_update" ON storage.objects;
DROP POLICY IF EXISTS "db_export_root_delete" ON storage.objects;
CREATE POLICY "db_export_root_select" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'database_export_26_07_26' AND public.is_root_admin(auth.uid()));
CREATE POLICY "db_export_root_write" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'database_export_26_07_26' AND public.is_root_admin(auth.uid()));
CREATE POLICY "db_export_root_update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'database_export_26_07_26' AND public.is_root_admin(auth.uid()))
WITH CHECK (bucket_id = 'database_export_26_07_26' AND public.is_root_admin(auth.uid()));
CREATE POLICY "db_export_root_delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'database_export_26_07_26' AND public.is_root_admin(auth.uid()));