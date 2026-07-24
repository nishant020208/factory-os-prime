import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/vendor-comparison")({
  head: () => ({ meta: [
    { title: "Vendor Comparison — FactoryOS AI" },
    { name: "description", content: "Side-by-side supplier price and terms" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Vendor Comparison" sub="Side-by-side supplier price and terms" />,
});
