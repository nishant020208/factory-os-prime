import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/plant-performance")({
  head: () => ({
    meta: [
      { title: "Plant Performance — FactoryOS AI" },
      { name: "description", content: "Live OEE, throughput and reliability" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Plant Performance"
      sub="Live OEE, throughput and reliability"
    />
  ),
});
