import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { RouteLoading } from "@/components/route-loading";
import { canAccess, homeForRole, primaryRole } from "@/lib/route-access";
import type { AppRole } from "@/lib/roles";
import { I18nProvider } from "@/lib/i18n";
import { PreferencesProvider } from "@/lib/preferences";
import { CurrencyProvider } from "@/lib/currency";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  pendingComponent: () => (
    <AppShell>
      <RouteLoading label="Loading module..." />
    </AppShell>
  ),
  // Only show loading UI if route takes > 300ms; dismiss it instantly when ready
  pendingMs: 300,
  pendingMinMs: 0,
  beforeLoad: async ({ location }) => {
    // Direct URL entry / new tab / refresh must route through landing page first.
    // The flag is set by in-app navigation (sidebar clicks, login flow) and cleared
    // on beforeunload so fresh loads always hit the landing page.
    const hasNavigated = sessionStorage.getItem("factoryos-navigated");
    if (!hasNavigated) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth", search: { redirect: location.href } });
    }
    const { data: rolesData, error: rolesError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id);
    // Graceful fallback: if roles query fails, try profiles
    let roles: AppRole[] = [];
    if (!rolesError && rolesData) {
      roles = rolesData.map((r) => r.role as AppRole);
    }
    // Deactivated accounts (Company Admin set profiles.status = 'inactive')
    // are blocked from the app entirely — not just hidden behind a button.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("status")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileRow?.status === "inactive") {
      await supabase.auth.signOut();
      throw redirect({
        to: "/auth",
        search: { redirect: location.href, deactivated: "1" },
      });
    }
    const role = primaryRole(roles);

    if (
      role === "root_super_admin" &&
      !location.pathname.startsWith("/platform") &&
      !location.pathname.startsWith("/notifications")
    ) {
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
  errorComponent: AuthErrorBoundary,
});

function AuthErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const msg = error?.message || "Unknown error";
  const isAuthError = msg.includes("auth") || msg.includes("session") || msg.includes("JWT");
  const isNotFound =
    msg.includes("relation") || msg.includes("does not exist") || msg.includes("42P01");
  const hint = isAuthError
    ? "🔑 Your session may have expired. Try signing out and back in."
    : isNotFound
      ? "🗄️ A database table wasn't found. The data may be loading from a different source or the page is still being set up. Try navigating to another tab and back."
      : "⚠️ An unexpected error occurred. Retrying usually resolves it.";

  return (
    <AppShell>
      <div className="max-w-[600px] mx-auto py-20 px-4 text-center">
        <div className="glass rounded-2xl p-10 shadow-card">
          <h2 className="text-lg font-semibold mb-2">This module didn't load</h2>
          <p className="text-sm text-muted-foreground mb-4">{hint}</p>
          <div className="flex justify-center gap-3 mb-4">
            <button
              onClick={() => {
                reset();
              }}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-all"
            >
              Retry
            </button>
            <button
              onClick={() => window.history.back()}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-all"
            >
              Go back
            </button>
            <button
              onClick={() => setExpanded(!expanded)}
              className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-all"
            >
              {expanded ? "Hide" : "Details"}
            </button>
          </div>
          {expanded && (
            <div className="text-left">
              <pre className="text-[10px] text-muted-foreground/60 bg-card/80 rounded-lg p-3 overflow-auto max-h-32 whitespace-pre-wrap break-all">
                {msg.slice(0, 500)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Layout() {
  const { role } = Route.useRouteContext();

  // Clear the navigation flag on page unload so fresh loads (new tab, refresh,
  // typed URL) always route through the landing page first.
  useEffect(() => {
    const unloadHandler = () => sessionStorage.removeItem("factoryos-navigated");
    window.addEventListener("beforeunload", unloadHandler);

    // Set the flag on any in-app click so sidebar/link navigation works
    const clickHandler = (e: MouseEvent) => {
      const target = (e.target as HTMLElement).closest("a, button[data-to], [role='menuitem']");
      if (target) sessionStorage.setItem("factoryos-navigated", "1");
    };
    document.addEventListener("click", clickHandler, true);

    return () => {
      window.removeEventListener("beforeunload", unloadHandler);
      document.removeEventListener("click", clickHandler, true);
    };
  }, []);

  // Root Super Admin is locked to English — language switch cannot affect
  // other companies or the platform console.
  const forceLocale = role === "root_super_admin" ? ("en" as const) : undefined;
  return (
    <I18nProvider forceLocale={forceLocale}>
      <CurrencyProvider>
        <PreferencesProvider>
          <AppShell>
            <Outlet />
          </AppShell>
        </PreferencesProvider>
      </CurrencyProvider>
    </I18nProvider>
  );
}
