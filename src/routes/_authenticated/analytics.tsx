import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/analytics")({
  head: () => ({ meta: [
    { title: "Analytics — FactoryOS AI" },
    { name: "description", content: "Cross-module BI, KPIs and executive analytics" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Analytics" sub="Cross-module BI, KPIs and executive analytics" />,
});
