import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/deliveries")({
  head: () => ({
    meta: [
      { title: "Deliveries — FactoryOS AI" },
      { name: "description", content: "Deliveries you owe and their status" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Deliveries" sub="Deliveries you owe and their status" />
  ),
});
