
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_root_admin(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.current_company_id() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_root_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_company_id() TO authenticated;
