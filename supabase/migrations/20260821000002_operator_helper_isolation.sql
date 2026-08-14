-- Production Operators are internal employees, but not broad operations users.
-- All operator access must be explicitly own-record scoped; this prevents any
-- legacy table using in_company_ops() from leaking inventory, procurement,
-- finance, planning, or other operators' data.
CREATE OR REPLACE FUNCTION public.in_company_ops(_cid uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = _cid
      AND ur.role NOT IN ('customer_portal'::public.app_role, 'supplier_portal'::public.app_role, 'production_operator'::public.app_role)
  );
$$;
