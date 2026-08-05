-- =============================================================
-- FACTORYOS AI — ROOT NOTIFICATION MARK-READ FIX + CLEANUP
-- 1. notifications_update_mark_read is company-scoped (company_id =
--    current_company_id()), so Root (who has NO company) could never
--    mark root-targeted notifications as read — the "Mark all as
--    read" button silently did nothing for Root.
--    Add a root-only policy: Root may UPDATE rows targeted at the
--    root_super_admin role (they carry company_id = null).
-- 2. Drop the temporary tmp_dump_policies() introspection helper used
--    while planning the Root RLS restriction.
-- =============================================================

-- ───────────── 1. ROOT CAN MARK ROOT-TARGETED NOTIFICATIONS READ ─────────────
DROP POLICY IF EXISTS notifications_update_root ON public.notifications;
CREATE POLICY notifications_update_root ON public.notifications
  FOR UPDATE TO authenticated
  USING (
    is_root_admin(auth.uid()) AND to_role = 'root_super_admin'
  )
  WITH CHECK (
    is_root_admin(auth.uid()) AND to_role = 'root_super_admin'
  );

-- ───────────── 2. DROP TEMP INTROSPECTION RPC ─────────────
DROP FUNCTION IF EXISTS public.tmp_dump_policies();
