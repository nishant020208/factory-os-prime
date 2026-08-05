DROP POLICY IF EXISTS "cr_anon_select" ON public.company_registrations;
DROP POLICY IF EXISTS "cr_anon_select" ON public.customer_requests;

REVOKE EXECUTE ON FUNCTION public.block_auditor_writes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_cross_tenant_writes() FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.in_company_ops(uuid) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.in_company_ops(uuid) TO authenticated;

DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_mark_read" ON public.notifications;
CREATE POLICY "notifications_select_own" ON public.notifications
  FOR SELECT TO authenticated
  USING (
    public.in_company(company_id)
    AND (user_id IS NULL OR user_id = auth.uid() OR to_user = auth.uid())
  );
CREATE POLICY "notifications_update_mark_read" ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR to_user = auth.uid())
  WITH CHECK (user_id = auth.uid() OR to_user = auth.uid());

DROP POLICY IF EXISTS "customer_orders_delete" ON public.customer_orders;
CREATE POLICY "customer_orders_delete" ON public.customer_orders
  FOR DELETE TO authenticated
  USING (
    public.in_company(company_id)
    AND (
      public.is_root_admin(auth.uid())
      OR public.has_role(auth.uid(), 'company_admin')
      OR public.has_role(auth.uid(), 'production_manager')
    )
  );