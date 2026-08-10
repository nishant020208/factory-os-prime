import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/shipments")({
  head: () => ({
    meta: [
      { title: "Shipments — FactoryOS AI" },
      { name: "description", content: "Track your shipments in real time" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Shipments" sub="Track your shipments in real time" />
  ),
});
