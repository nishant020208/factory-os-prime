-- =============================================================
-- FACTORYOS AI — DROP BACKUP-ERA PERMISSIVE POLICIES
-- The live DB was restored from an older schema backup which left
-- generic permissive policies (named <table>_insert/_update/_delete/
-- _select_scoped with `NOT is_auditor()` or `in_company()` checks)
-- in place. RLS ORs all policies for a command together, so these
-- old policies OVERRODE the role-scoped ones and re-opened leaks:
--   • any authenticated user (operator, supplier, customer) could
--     INSERT work_orders / purchase_orders
--   • any non-auditor could INSERT a notification targeted at
--     root_super_admin (bypassing the MAIN-ADMIN-only rule)
--   • any company user could SELECT every notification in the company
-- This migration drops ONLY the old permissive policies on the
-- affected tables; the scoped policies created in
-- 20260802000001_rls_hardening_audit.sql remain authoritative.
-- =============================================================

-- ───────────── WORK ORDERS — drop backup-era policies ────────────────
DROP POLICY IF EXISTS work_orders_insert    ON public.work_orders;
DROP POLICY IF EXISTS work_orders_update    ON public.work_orders;
DROP POLICY IF EXISTS work_orders_delete    ON public.work_orders;
DROP POLICY IF EXISTS work_orders_select_scoped ON public.work_orders;

-- ───────────── PURCHASE ORDERS — drop backup-era policies ────────────
DROP POLICY IF EXISTS purchase_orders_insert ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_update ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_delete ON public.purchase_orders;
DROP POLICY IF EXISTS purchase_orders_select_scoped ON public.purchase_orders;

-- ───────────── NOTIFICATIONS — drop backup-era policies ──────────────
DROP POLICY IF EXISTS notifications_insert  ON public.notifications;
DROP POLICY IF EXISTS notifications_delete  ON public.notifications;
DROP POLICY IF EXISTS notifications_select_scoped ON public.notifications;

-- Scoped DELETE for notifications: users may delete their own rows
-- (to_user = auth.uid() / legacy user_id = auth.uid()); Company Admins
-- and Root may delete any notification in their company.
DROP POLICY IF EXISTS notifications_delete_own ON public.notifications;
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated
  USING (
    to_user = auth.uid()
    OR user_id = auth.uid()
    OR is_root_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.role = 'company_admin'
        AND ur.company_id = public.notifications.company_id
    )
  );
