import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/capacity-planning")({
  head: () => ({ meta: [
    { title: "Capacity Planning — FactoryOS AI" },
    { name: "description", content: "Long-term capacity vs. demand" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Capacity Planning" sub="Long-term capacity vs. demand" />,
});
