import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/supplier-performance")({
  head: () => ({
    meta: [
      { title: "Performance — FactoryOS AI" },
      { name: "description", content: "Your OTIF, quality and pricing score" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Performance" sub="Your OTIF, quality and pricing score" />
  ),
});
