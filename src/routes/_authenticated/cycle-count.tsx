import { createFileRoute } from "@tanstack/react-router";
import { StubModule } from "@/components/stub-module";

export const Route = createFileRoute("/_authenticated/cycle-count")({
  head: () => ({
    meta: [
      { title: "Cycle Count — FactoryOS AI" },
      { name: "description", content: "Perpetual cycle counting and variance" },
    ],
  }),
  component: () => (
    <StubModule eyebrow="Module" title="Cycle Count" sub="Perpetual cycle counting and variance" />
  ),
});
