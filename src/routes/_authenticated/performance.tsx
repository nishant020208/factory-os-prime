import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/performance")({
  head: () => ({ meta: [
    { title: "Performance — FactoryOS AI" },
    { name: "description", content: "Reviews, OKRs and 360 feedback" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Performance" sub="Reviews, OKRs and 360 feedback" />,
});
