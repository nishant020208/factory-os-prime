-- ============================================================================
-- Profile Portal — Root resolution for Company Admin escalation
--
-- When a Company Admin submits a profile change request, it escalates to the
-- single Root Super Admin. Notifications must target that specific user
-- (to_user), never broadcast. But user_roles RLS hides the root's row from
-- non-root users (root has no company, so in_company() is false), so the app
-- cannot resolve the root user id directly. This SECURITY DEFINER RPC returns
-- the root user id safely — it is read-only and exposes only a user id.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_root_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT user_id FROM public.user_roles WHERE role = 'root_super_admin' LIMIT 1;
$function$;

GRANT EXECUTE ON FUNCTION public.get_root_user_id() TO authenticated;
