import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/support")({
  head: () => ({ meta: [
    { title: "Support — FactoryOS AI" },
    { name: "description", content: "Raise support tickets" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Support" sub="Raise support tickets" />,
});
