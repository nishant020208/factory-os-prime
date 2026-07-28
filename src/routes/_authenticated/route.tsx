import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { canAccess, homeForRole, primaryRole } from "@/lib/route-access";
import type { AppRole } from "@/lib/roles";
import { I18nProvider } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesData ?? []).map(r => r.role as AppRole);
    const role = primaryRole(roles);

    if (role === "root_super_admin" && !location.pathname.startsWith("/platform")) {
      throw redirect({ to: "/platform" });
    }
    if (role !== "root_super_admin" && location.pathname.startsWith("/platform")) {
      throw redirect({ to: homeForRole(role) });
    }
    if (!canAccess(location.pathname, roles)) {
      throw redirect({ to: homeForRole(role) });
    }
    return { user: data.user, roles, role };
  },
  component: Layout,
});

function Layout() {
  const { role } = Route.useRouteContext();
  // Root Super Admin is locked to English — language switch cannot affect
  // other companies or the platform console.
  const forceLocale = role === "root_super_admin" ? ("en" as const) : undefined;
  return (
    <I18nProvider forceLocale={forceLocale}>
      <AppShell>
        <Outlet />
      </AppShell>
    </I18nProvider>
  );
}
