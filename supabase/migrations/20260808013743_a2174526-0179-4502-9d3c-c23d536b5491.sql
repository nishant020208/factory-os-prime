DROP POLICY IF EXISTS user_roles_insert ON public.user_roles;
DROP POLICY IF EXISTS user_roles_update ON public.user_roles;
DROP POLICY IF EXISTS user_roles_delete ON public.user_roles;

CREATE POLICY user_roles_insert ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  (NOT public.is_auditor())
  AND (
    public.is_root_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'company_admin'::public.app_role)
      AND company_id IS NOT NULL
      AND company_id = public.current_company_id()
      AND role <> 'root_super_admin'::public.app_role
    )
  )
);

CREATE POLICY user_roles_update ON public.user_roles
FOR UPDATE TO authenticated
USING (
  (NOT public.is_auditor())
  AND (
    public.is_root_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'company_admin'::public.app_role)
      AND company_id = public.current_company_id()
      AND role <> 'root_super_admin'::public.app_role
    )
  )
)
WITH CHECK (
  (NOT public.is_auditor())
  AND (
    public.is_root_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'company_admin'::public.app_role)
      AND company_id = public.current_company_id()
      AND role <> 'root_super_admin'::public.app_role
    )
  )
);

CREATE POLICY user_roles_delete ON public.user_roles
FOR DELETE TO authenticated
USING (
  (NOT public.is_auditor())
  AND (
    public.is_root_admin(auth.uid())
    OR (
      public.has_role(auth.uid(), 'company_admin'::public.app_role)
      AND company_id = public.current_company_id()
      AND role <> 'root_super_admin'::public.app_role
    )
  )
);