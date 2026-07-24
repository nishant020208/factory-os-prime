import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/platform/profile")({
  head: () => ({ meta: [{ title: "Profile — FactoryOS AI" }] }),
  component: () => <StubModule eyebrow="Platform" title="Your Profile" sub="Root Super Admin profile, MFA and security preferences." />,
});
