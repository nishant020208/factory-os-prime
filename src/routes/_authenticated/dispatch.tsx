import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/dispatch")({
  head: () => ({ meta: [
    { title: "Dispatch — FactoryOS AI" },
    { name: "description", content: "Outbound dispatch and shipping" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Dispatch" sub="Outbound dispatch and shipping" />,
});
