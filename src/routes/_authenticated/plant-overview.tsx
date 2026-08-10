import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/plant-overview")({
  head: () => ({
    meta: [
      { title: "Plant Overview — FactoryOS AI" },
      { name: "description", content: "Complete view of your plant operations" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Plant Overview"
      sub="Complete view of your plant operations"
    />
  ),
});
