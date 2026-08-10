import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/production-planning")({
  head: () => ({
    meta: [
      { title: "Production Planning — FactoryOS AI" },
      { name: "description", content: "Rolling schedule and capacity plan" },
    ],
  }),
  component: () => (
    <StubModule
      eyebrow="Module"
      title="Production Planning"
      sub="Rolling schedule and capacity plan"
    />
  ),
});
