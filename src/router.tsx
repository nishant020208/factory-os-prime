import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // 5 minutes: data served from cache on tab switches, no re-fetch shimmer
        staleTime: 5 * 60_000,
        // Keep data in memory for 30 minutes
        gcTime: 30 * 60_000,
        // Don't re-fetch just because user switched browser tabs
        refetchOnWindowFocus: false,
        // Retry once on failure, not 3 times (reduces perceived latency on errors)
        retry: 1,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: "intent",
    // Preload data immediately when user hovers a nav link
    defaultPreloadStaleTime: 30_000,
    // Show pending UI only after 300ms (avoids flicker for fast loads)
    defaultPendingMs: 300,
    // Minimum time to show pending UI if it appears (0 = dismiss instantly when ready)
    defaultPendingMinMs: 0,
  });

  return router;
};
