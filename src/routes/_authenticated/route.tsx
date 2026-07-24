import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { canAccess, homeForRole, primaryRole } from "@/lib/route-access";
import type { AppRole } from "@/lib/roles";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    // Load roles to enforce role-based routing.
    const { data: rolesData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    const roles = (rolesData ?? []).map(r => r.role as AppRole);
    const role = primaryRole(roles);

    // Root Super Admin is platform-only — force redirect off ERP paths.
    if (role === "root_super_admin" && !location.pathname.startsWith("/platform")) {
      throw redirect({ to: "/platform" });
    }
    // Non-root trying to access /platform → send to their dashboard.
    if (role !== "root_super_admin" && location.pathname.startsWith("/platform")) {
      throw redirect({ to: homeForRole(role) });
    }
    // General role-gate for other paths.
    if (!canAccess(location.pathname, roles)) {
      throw redirect({ to: homeForRole(role) });
    }
    return { user: data.user, roles, role };
  },
  component: Layout,
});

function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
