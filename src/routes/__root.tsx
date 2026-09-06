import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, lazy, Suspense, type ReactNode } from "react";

const TargetCursor = lazy(() => import("../components/TargetCursor"));

import appCss from "../styles.css?url";
import { reportRuntimeError } from "../lib/runtime-error";
import { ThemeProvider } from "@/hooks/use-theme";
import { SoundProvider, GlobalClickSoundLayer } from "@/hooks/use-click-sound";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center aurora-bg px-4">
      <div className="glass-strong rounded-2xl px-10 py-14 max-w-md text-center shadow-elegant">
        <div className="text-7xl font-bold gradient-text">404</div>
        <h2 className="mt-4 text-xl font-semibold">Signal lost</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for isn't on the factory floor.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            Return to FactoryOS
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const [showDetails, setShowDetails] = useState(false);
  useEffect(() => {
    reportRuntimeError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  // Extract meaningful error info
  const errorMessage = error?.message || "Unknown error";
  const errorName = error?.name || "Error";
  const errorStack = error?.stack || "";
  const isAuthError =
    errorMessage.includes("supabase") ||
    errorMessage.includes("auth") ||
    errorMessage.includes("session") ||
    errorMessage.includes("JWT");
  const isNetworkError =
    errorMessage.includes("fetch") ||
    errorMessage.includes("network") ||
    errorMessage.includes("Failed to fetch") ||
    errorMessage.includes("networkerror");
  const isTableMissing =
    errorMessage.includes("relation") ||
    errorMessage.includes("does not exist") ||
    errorMessage.includes("42P01") ||
    errorMessage.includes("not found");
  const isRlsError =
    errorMessage.includes("permission") ||
    errorMessage.includes("policy") ||
    errorMessage.includes("violates row-level");
  const isQueryError =
    errorMessage.includes("query") ||
    errorMessage.includes("Database") ||
    errorMessage.includes("select") ||
    errorName === "PostgrestError" ||
    errorMessage.includes("column");

  let hint = "";
  if (isAuthError)
    hint =
      "🔑 Your session may have expired. Try signing out and back in. If the issue persists, clear your browser cache.";
  else if (isTableMissing)
    hint =
      "🗄️ A database table wasn't found. This usually means a migration hasn't been applied yet or the data is loading from a different source. Try navigating to another tab and back.";
  else if (isNetworkError)
    hint =
      "🌐 A network request failed. Check your connection and try again. If you're using a VPN, try disabling it.";
  else if (isRlsError)
    hint =
      "🔒 Your role may not have permission to access this data. Try signing in with a different role or contact your system administrator.";
  else if (isQueryError)
    hint =
      "📊 A database query failed. The page you're trying to access may reference a table or column that doesn't match the current schema. The development team has been notified.";
  else if (
    errorMessage.includes("transform") ||
    errorMessage.includes("parse") ||
    errorMessage.includes("JSON")
  )
    hint =
      "🔄 Data format mismatch detected. This is usually a temporary issue — retrying should resolve it.";
  else
    hint =
      "⚠️ An unexpected error occurred. Retrying usually resolves it. If not, try navigating to another section and coming back.";

  return (
    <div className="flex min-h-screen items-center justify-center aurora-bg px-4">
      <div className="glass-strong rounded-2xl px-10 py-14 max-w-md text-center shadow-elegant">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
        <div className="mt-3 text-xs text-muted-foreground/50 font-mono bg-card/50 rounded-lg px-3 py-2 truncate max-w-full">
          {errorName}: {errorMessage.substring(0, 100)}
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-all"
          >
            Retry
          </button>
          <a
            href="/"
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-all"
          >
            Home
          </a>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-all"
          >
            {showDetails ? "Hide details" : "Details"}
          </button>
        </div>
        {showDetails && errorStack && (
          <div className="mt-4 text-left">
            <pre className="text-[10px] text-muted-foreground/60 bg-card/80 rounded-lg p-3 overflow-auto max-h-40 whitespace-pre-wrap break-all">
              {errorStack}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "FactoryOS AI — Factory Command Center" },
      {
        name: "description",
        content:
          "Enterprise Smart Manufacturing Operating System. Production, inventory, warehouses, procurement, quality, maintenance, finance, HR and AI — in one control room.",
      },
      { name: "author", content: "FactoryOS AI" },
      { name: "theme-color", content: "#0F172A" },
      { property: "og:title", content: "FactoryOS AI — Factory Command Center" },
      {
        property: "og:description",
        content:
          "Enterprise Smart Manufacturing Operating System. Production, inventory, warehouses, procurement, quality, maintenance, finance, HR and AI — in one control room.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "FactoryOS AI — Factory Command Center" },
      {
        name: "twitter:description",
        content:
          "Enterprise Smart Manufacturing Operating System. Production, inventory, warehouses, procurement, quality, maintenance, finance, HR and AI — in one control room.",
      },
      {
        property: "og:image",
        content: "/images/hero-banner.png",
      },
      {
        name: "twitter:image",
        content: "/images/hero-banner.png",
      },
    ],
    links: [
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", type: "image/png", href: "/favicon.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => {
    // Cross-module realtime sync: any change in a core table invalidates
    // every dashboard/report the user has open. RLS filters what they see.
    // ⚠️ Crash-proof: entire subscription is wrapped in try-catch so a missing
    //    table or RLS error never triggers the error boundary.
    const TABLES = [
      "notifications",
      "whitelist",
      "production_orders",
      "machines",
      "inventory",
      "purchase_orders",
      "sales_orders",
      "shipments",
      "invoices",
      "payments",
      "quality_inspections",
      "work_orders",
      "support_tickets",
      "tasks",
      "documents",
      "employees",
      "attendance",
      "payroll",
      "approvals",
      "knowledge_articles",
      // Master/catalog data — supplier-added raw materials and BOM edits must
      // appear live in Production Planning, Procurement and the catalogs.
      "materials",
      "products",
      "bom",
      "bom_items",
      "supplier_materials",
      "purchase_requisitions",
      // Auto-RFQs raised from production shortfalls must appear live in
      // Procurement's RFQ tab without a manual reload.
      "rfqs",
      "rfq_responses",
    ];
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    import("@/integrations/supabase/client")
      .then(({ supabase }) => {
        if (cancelled) return;
        try {
          let ch = supabase.channel("factoryos-sync");
          for (const t of TABLES) {
            ch = ch.on("postgres_changes", { event: "*", schema: "public", table: t }, () => {
              try {
                queryClient.invalidateQueries({ queryKey: [t] });
                queryClient.invalidateQueries({
                  predicate: (q: { queryKey: readonly unknown[] }) => q.queryKey?.[0] === t,
                });
              } catch {
                // Silently ignore callback errors — invalidations are best-effort
              }
            });
          }
          const channel = ch.subscribe();
          cleanup = () => {
            try {
              void supabase.removeChannel(channel);
            } catch {
              /* ignore */
            }
          };
        } catch {
          // Realtime subscription failed (table may not exist yet)
          // No user-facing impact — queries will still work on navigation
        }
      })
      .catch(() => {
        // Failed to import supabase client — no crash
      });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [queryClient]);
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <SoundProvider>
          {/* Global target cursor — desktop only, returns null on touch/mobile automatically */}
          <Suspense fallback={null}>
            <TargetCursor
              targetSelector='a, button, [role="button"], input, select, label, .cursor-target'
              spinDuration={2}
              hideDefaultCursor={true}
              parallaxOn={true}
              cursorColor="#ffffff"
              cursorColorOnTarget="oklch(0.72 0.19 145)"
            />
          </Suspense>
          {/* Subtle mechanical click feedback on every button/link (muted state
              is shared app-wide via SoundProvider/localStorage) */}
          <GlobalClickSoundLayer onHoverToggle={() => {}} hoverEnabled={false} />
          <Outlet />
          <Toaster position="top-right" richColors closeButton />
        </SoundProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
