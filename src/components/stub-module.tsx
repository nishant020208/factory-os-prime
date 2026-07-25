import { useRouterState } from "@tanstack/react-router";
import { PageHeader, Panel, EmptyState } from "@/components/ui-parts";
import { LiveModule } from "@/components/live-module";
import { moduleForPath } from "@/lib/module-registry";

/**
 * Backwards-compatible entry point used by every legacy route file.
 * If the current route is registered in MODULE_REGISTRY, we render the
 * real data-driven LiveModule. Otherwise we still render a clean page
 * header — no more "Scaffolded / Interconnection / Copilot" placeholder cards.
 */
export function StubModule({
  eyebrow, title, sub,
}: { eyebrow: string; title: string; sub?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const cfg = moduleForPath(pathname);
  if (cfg) return <LiveModule config={cfg} />;

  return (
    <div className="max-w-[1600px] mx-auto">
      <PageHeader eyebrow={eyebrow} title={title} sub={sub} />
      <Panel title={title}>
        <EmptyState
          title="Nothing here yet"
          sub="This surface is enabled for your role. Records will appear here as your team or connected modules create them."
        />
      </Panel>
    </div>
  );
}
