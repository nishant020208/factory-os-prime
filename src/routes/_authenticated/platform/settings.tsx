import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/platform/settings")({
  head: () => ({ meta: [{ title: "Platform Settings — FactoryOS AI" }] }),
  component: () => <StubModule eyebrow="Platform" title="Platform Settings" sub="Configure branding, sign-in policies, retention windows and platform-wide feature flags." />,
});
