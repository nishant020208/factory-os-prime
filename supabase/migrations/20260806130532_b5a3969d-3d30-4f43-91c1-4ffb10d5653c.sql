-- Remove the permissive policy that leaked role-targeted notifications to
-- every authenticated user in the company (RLS policies are OR-combined).
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;

-- Rebuild the targeted policy: recipient-only, role-exact, company-scoped.
DROP POLICY IF EXISTS notif_select_targeted ON public.notifications;

CREATE POLICY notif_select_targeted
ON public.notifications
FOR SELECT
TO authenticated
USING (
  -- Addressed to me personally
  to_user = auth.uid()
  OR user_id = auth.uid()
  -- Addressed to my exact role, inside my own company
  OR (
    to_role IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role::text = notifications.to_role
        AND ur.company_id IS NOT DISTINCT FROM notifications.company_id
    )
  )
  -- Company Admin oversight, but never private customer/supplier messages
  OR (
    to_role IS DISTINCT FROM 'customer_portal'
    AND to_role IS DISTINCT FROM 'supplier_portal'
    AND to_user IS NULL
    AND EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'company_admin'::app_role
        AND ur.company_id = notifications.company_id
    )
  )
);