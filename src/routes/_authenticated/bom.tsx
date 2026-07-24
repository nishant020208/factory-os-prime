import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/bom")({
  head: () => ({ meta: [
    { title: "Bill of Materials — FactoryOS AI" },
    { name: "description", content: "Multi-level BOMs, cost rollups and where-used analysis" },
  ]}),
  component: () => <StubModule eyebrow="Module" title="Bill of Materials" sub="Multi-level BOMs, cost rollups and where-used analysis" />,
});
